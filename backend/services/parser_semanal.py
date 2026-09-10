"""Parser para el formato Excel semanal de rendimiento (RENDIMIENTO_SEMANAL).

Estructura del Excel (fila 1-indexed):
  Filas 1-5: encabezados multinivel (se saltan)
  Fila 6:    encabezados de columna (se salta — acceso por posición fija)
  Fila 7+:   datos (un colaborador por fila)

Columnas usadas (0-indexed):
  0  FECHA REPORTE NOMINA
  2  SEMANA
  3  LABOR
  4  CODIGO COLABORADOR
  5  NOMBRE DEL COLABORADOR
  Días (4 cols cada uno, usamos solo las 3 primeras):
  DOM: 6,7,8  LUN: 10,11,12  MAR: 14,15,16
  MIE: 18,19,20  JUE: 22,23,24  VIE: 26,27,28  SAB: 30,31,32
  69  % DE CALIDAD
"""
from __future__ import annotations

import io
import unicodedata
from datetime import date, timedelta
from difflib import SequenceMatcher
from typing import Optional

import pandas as pd

from services.utils_semana import festivos_colombia, normalizar_codigo_semana, rango_semana

# (dia_key, col_unidades, col_h_ord, col_h_extra, es_domingo_o_dominical)
DIAS_COLS = [
    ("dom", 6,  7,  8,  True),
    ("lun", 10, 11, 12, False),
    ("mar", 14, 15, 16, False),
    ("mie", 18, 19, 20, False),
    ("jue", 22, 23, 24, False),
    ("vie", 26, 27, 28, False),
    ("sab", 30, 31, 32, False),
]

COL_SEMANA   = 2
COL_LABOR    = 3
COL_CODIGO   = 4
COL_NOMBRE   = 5
COL_CALIDAD  = 69
SKIP_ROWS    = 6   # header rows to skip


def _norm(s: str) -> str:
    """Quita tildes, mayúsculas, trim — para comparación de labor."""
    return (
        unicodedata.normalize("NFKD", str(s))
        .encode("ascii", "ignore")
        .decode("ascii")
        .strip()
        .upper()
    )


def _float(v) -> float:
    if v is None:
        return 0.0
    s = str(v).strip()
    if s in ("", "-", "nan", "None"):
        return 0.0
    try:
        return float(s.replace(",", ""))
    except (ValueError, TypeError):
        return 0.0


def _match_labor(
    labor_excel: str, labores_catalogo: list[str]
) -> tuple[Optional[str], float, list[dict]]:
    """Match tolerante a tildes y pequeñas diferencias.
    Returns (nombre_en_catalogo | None, score, sugerencias).
    score == 1.0 → match exacto; < 1.0 → fuzzy; None → no encontrado."""
    norm_excel = _norm(labor_excel)
    for lcat in labores_catalogo:
        if _norm(lcat) == norm_excel:
            return lcat, 1.0, []
    scored = [
        (SequenceMatcher(None, norm_excel, _norm(lcat)).ratio(), lcat)
        for lcat in labores_catalogo
    ]
    scored.sort(reverse=True)
    sugerencias = [
        {"labor": n, "score": round(s, 3)}
        for s, n in scored[:3]
        if s >= 0.6
    ]
    if scored and scored[0][0] >= 0.85:
        return scored[0][1], scored[0][0], sugerencias
    return None, scored[0][0] if scored else 0.0, sugerencias


def parsear_semanal(
    contenido: bytes,
    nombre_archivo: str,
    labores_catalogo: list[str],
) -> dict:
    """Parsea el Excel semanal de rendimiento.

    Retorna dict con:
      registros_diarios  — list[dict] listos para crear RegistroDiario
      registros_calidad  — list[dict] listos para upsert RegistroCalidad
      errores            — list[dict] bloqueantes
      advertencias       — list[dict] no bloqueantes
      total_filas_excel  — int
    """
    try:
        df = pd.read_excel(
            io.BytesIO(contenido),
            header=None,
            skiprows=SKIP_ROWS,
            engine="openpyxl",
        )
    except Exception as e:
        return {
            "registros_diarios": [],
            "registros_calidad": [],
            "errores": [{"fila": 0, "colaborador": "", "tipo": "LECTURA",
                         "mensaje": f"No se pudo leer el archivo: {e}"}],
            "advertencias": [],
            "total_filas_excel": 0,
        }

    festivos_cache: dict[int, set[date]] = {}

    def get_festivos(año: int) -> set[date]:
        if año not in festivos_cache:
            festivos_cache[año] = set(festivos_colombia(año))
        return festivos_cache[año]

    registros_diarios: list[dict] = []
    registros_calidad: list[dict] = []
    errores: list[dict] = []
    advertencias: list[dict] = []
    total_filas = 0

    for idx, row in df.iterrows():
        nro_fila = int(idx) + SKIP_ROWS + 1  # 1-indexed Excel row

        semana_raw = row.iloc[COL_SEMANA] if len(row) > COL_SEMANA else None
        if semana_raw is None or str(semana_raw).strip() in ("", "nan", "None"):
            continue
        total_filas += 1

        try:
            semana = normalizar_codigo_semana(semana_raw)
        except ValueError:
            errores.append({
                "fila": nro_fila, "colaborador": "",
                "tipo": "SEMANA_INVALIDA",
                "mensaje": f"Semana inválida: {semana_raw!r}",
            })
            continue

        nombre = str(row.iloc[COL_NOMBRE]).strip() if len(row) > COL_NOMBRE else ""
        labor_raw = str(row.iloc[COL_LABOR]).strip() if len(row) > COL_LABOR else ""

        if not labor_raw or labor_raw in ("nan", "None"):
            errores.append({
                "fila": nro_fila, "colaborador": nombre,
                "tipo": "LABOR_VACIA", "mensaje": "Labor vacía",
            })
            continue

        labor_match, score, sug = _match_labor(labor_raw, labores_catalogo)
        if labor_match is None:
            errores.append({
                "fila": nro_fila, "colaborador": nombre,
                "tipo": "LABOR_NO_ENCONTRADA",
                "mensaje": f"Labor '{labor_raw}' no encontrada en el catálogo.",
                "sugerencias": sug,
            })
            continue
        if score < 1.0:
            advertencias.append({
                "fila": nro_fila, "colaborador": nombre,
                "tipo": "LABOR_FUZZY",
                "mensaje": f"'{labor_raw}' → '{labor_match}' (similitud {score:.0%}). Verifique.",
                "labor_excel": labor_raw,
                "labor_catalogo": labor_match,
                "score": round(score, 3),
                "sugerencias": sug,
            })
        labor = labor_match

        codigo_raw = row.iloc[COL_CODIGO] if len(row) > COL_CODIGO else None
        try:
            codigo = int(float(str(codigo_raw).strip()))
        except (ValueError, TypeError):
            errores.append({
                "fila": nro_fila, "colaborador": nombre,
                "tipo": "CODIGO_INVALIDO",
                "mensaje": f"Código colaborador inválido: {codigo_raw!r}",
            })
            continue

        try:
            lunes, _ = rango_semana(semana)
        except Exception as exc:
            errores.append({
                "fila": nro_fila, "colaborador": nombre,
                "tipo": "SEMANA_INVALIDA", "mensaje": str(exc),
            })
            continue

        # Festivos para el año de la semana (puede cruzar dos años)
        domingo_semana = lunes + timedelta(days=6)
        festivos: set[date] = get_festivos(lunes.year)
        if domingo_semana.year != lunes.year:
            festivos = festivos | get_festivos(domingo_semana.year)

        fecha_por_dia: dict[str, date] = {
            "dom": domingo_semana,
            "lun": lunes,
            "mar": lunes + timedelta(days=1),
            "mie": lunes + timedelta(days=2),
            "jue": lunes + timedelta(days=3),
            "vie": lunes + timedelta(days=4),
            "sab": lunes + timedelta(days=5),
        }

        # % calidad
        pct_calidad: Optional[float] = None
        pct_raw = row.iloc[COL_CALIDAD] if len(row) > COL_CALIDAD else None
        if pct_raw is not None and str(pct_raw).strip() not in ("", "nan", "None", "-"):
            try:
                v = float(str(pct_raw).strip())
                pct_calidad = v / 100.0 if v > 1 else v
            except (ValueError, TypeError):
                pass

        # Generar registros diarios
        fila_tiene_datos = False
        for dia_key, col_und, col_hord, col_hex, es_dominical_natural in DIAS_COLS:
            unidades = _float(row.iloc[col_und] if len(row) > col_und else None)
            h_ord    = _float(row.iloc[col_hord] if len(row) > col_hord else None)
            h_ext    = _float(row.iloc[col_hex]  if len(row) > col_hex  else None)

            if unidades == 0 and h_ord == 0 and h_ext == 0:
                continue  # día vacío

            fila_tiene_datos = True
            fecha = fecha_por_dia[dia_key]
            es_festivo = fecha in festivos
            es_dominical = es_dominical_natural or es_festivo

            if es_dominical and h_ord > 0:
                errores.append({
                    "fila": nro_fila, "colaborador": nombre,
                    "tipo": "FESTIVO_HORAS_ORD",
                    "mensaje": (
                        f"{fecha.strftime('%d/%m/%Y')} "
                        f"({'domingo' if es_dominical_natural else 'festivo'}): "
                        f"H.Ordinarias={h_ord} debe ser 0 — usa H.Dominicales."
                    ),
                    "fecha": str(fecha), "dia": dia_key.upper(),
                })
                h_ord = 0.0

            if es_festivo and not es_dominical_natural:
                advertencias.append({
                    "fila": nro_fila, "colaborador": nombre,
                    "tipo": "DIA_FESTIVO",
                    "mensaje": f"{fecha.strftime('%d/%m/%Y')} es festivo — H.Extras clasificadas como dominicales.",
                    "fecha": str(fecha), "dia": dia_key.upper(),
                })

            horas_extra_ord   = h_ext if not es_dominical else 0.0
            horas_dominicales = h_ext if es_dominical else 0.0

            registros_diarios.append({
                "fecha":                  str(fecha),
                "semana":                 semana,
                "codigo_colaborador":     codigo,
                "nombre_colaborador":     nombre,
                "labor":                  labor,
                "ramos":                  unidades,
                "tallos":                 0.0,
                "horas_ordinarias":       h_ord,
                "horas_extra_ordinarias": horas_extra_ord,
                "horas_dominicales":      horas_dominicales,
                "unidades_tarea":         0.0,
                "horas_tarea":            0.0,
                "dia":                    dia_key.upper(),
            })

        # Un RegistroCalidad por colaborador+semana+labor (si hay pct_calidad)
        if pct_calidad is not None and fila_tiene_datos:
            registros_calidad.append({
                "semana":             semana,
                "codigo_colaborador": codigo,
                "nombre_colaborador": nombre,
                "labor":              labor,
                "pct_calidad":        pct_calidad,
            })

    return {
        "registros_diarios":  registros_diarios,
        "registros_calidad":  registros_calidad,
        "errores":            errores,
        "advertencias":       advertencias,
        "total_filas_excel":  total_filas,
    }
