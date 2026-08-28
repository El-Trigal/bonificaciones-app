"""Parser de archivos de calidad (CSV/XLSX).

Extrae filas {archivo, nombre_excel, cfd_producto, n_muestras} tolerando
variaciones en los encabezados (acentos, mayúsculas, espacios).
"""

from __future__ import annotations

import io
import unicodedata

import pandas as pd


def _norm_header(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode("ascii")
    return s.strip().lower().replace(" ", "").replace(".", "")


def _hallar_columna(df: pd.DataFrame, candidatos: list[str]) -> str | None:
    mapa = {_norm_header(c): c for c in df.columns}
    for cand in candidatos:
        c = mapa.get(_norm_header(cand))
        if c:
            return c
    return None


def _leer(contenido: bytes, nombre: str) -> pd.DataFrame:
    if nombre.lower().endswith(".csv"):
        return pd.read_csv(io.BytesIO(contenido), dtype=str, keep_default_na=False, encoding="utf-8-sig")
    return pd.read_excel(io.BytesIO(contenido), dtype=str)


def parsear_archivo(contenido: bytes, nombre_archivo: str) -> dict:
    """Devuelve {'filas': [...], 'errores': [...]}.

    Cada fila: {archivo, nombre_excel, cfd_producto, n_muestras}
    """
    try:
        df = _leer(contenido, nombre_archivo)
    except Exception as e:
        return {"filas": [], "errores": [f"No se pudo leer {nombre_archivo}: {e}"]}

    col_nombre = _hallar_columna(df, ["COLABORADOR", "NOMBRE", "NOMBRE COLABORADOR"])
    col_cfd = _hallar_columna(df, ["CFD PRODUCTO", "CFDPRODUCTO", "CFD", "CALIDAD"])
    col_muestras = _hallar_columna(df, ["N MUESTRAS", "NMUESTRAS", "MUESTRAS", "N"])

    errores = []
    if not col_nombre:
        errores.append(f"{nombre_archivo}: no se encontró columna COLABORADOR")
    if not col_cfd:
        errores.append(f"{nombre_archivo}: no se encontró columna CFD PRODUCTO")
    if errores:
        return {"filas": [], "errores": errores}

    filas = []
    for idx, row in df.iterrows():
        nombre = str(row[col_nombre] or "").strip()
        if not nombre:
            continue
        raw_cfd = str(row[col_cfd] or "").strip().replace(",", ".")
        try:
            cfd = float(raw_cfd)
        except (ValueError, TypeError):
            errores.append(f"{nombre_archivo} fila {int(idx)+2}: CFD inválido '{raw_cfd}'")
            continue
        # Normalizar 0–1 (si viene 85 → 0.85)
        if cfd > 1:
            cfd = cfd / 100.0
        n_muestras = 0
        if col_muestras:
            try:
                n_muestras = int(float(str(row[col_muestras] or "0").strip() or 0))
            except (ValueError, TypeError):
                n_muestras = 0
        filas.append({
            "archivo": nombre_archivo,
            "nombre_excel": nombre,
            "cfd_producto": round(cfd, 6),
            "n_muestras": n_muestras,
        })
    return {"filas": filas, "errores": errores}


def parsear_varios(archivos: list[tuple[bytes, str]]) -> dict:
    """archivos: [(contenido, nombre), ...]. Consolida filas de todos."""
    todas, errores = [], []
    for contenido, nombre in archivos:
        res = parsear_archivo(contenido, nombre)
        todas.extend(res["filas"])
        errores.extend(res["errores"])
    return {"filas": todas, "errores": errores}
