"""Utilidades de normalización de códigos de semana y conversión tallos/ramos."""

from datetime import date, timedelta
import re


def normalizar_codigo_semana(raw) -> str:
    """Convierte variantes a formato canónico 'YYYY-WW'.

    Acepta:
      - '2607'       -> '2026-07'
      - '26-07'      -> '2026-07'
      - '2026-07'    -> '2026-07'
      - '202607'     -> '2026-07'
      - 2607 (int)   -> '2026-07'
    """
    if raw is None:
        raise ValueError("Código de semana vacío")
    s = str(raw).strip().upper()
    s = s.replace("SEM", "").replace("W", "").strip()
    digitos = re.sub(r"[^0-9]", "", s)
    if len(digitos) == 4:
        aa, ww = digitos[:2], digitos[2:]
        anio = 2000 + int(aa)
    elif len(digitos) == 6:
        anio, ww = int(digitos[:4]), digitos[4:]
    else:
        raise ValueError(f"Código de semana inválido: {raw!r}")
    semana = int(ww)
    if not 1 <= semana <= 53:
        raise ValueError(f"Semana fuera de rango: {semana}")
    return f"{anio}-{semana:02d}"


def semana_desde_fecha(fecha: date) -> str:
    """Devuelve código 'YYYY-WW' usando ISO week (lunes=inicio)."""
    iso = fecha.isocalendar()
    return f"{iso.year}-{iso.week:02d}"


def rango_semana(codigo: str) -> tuple[date, date]:
    """Devuelve (lunes, domingo) para el código 'YYYY-WW'."""
    anio, ww = codigo.split("-")
    lunes = date.fromisocalendar(int(anio), int(ww), 1)
    return lunes, lunes + timedelta(days=6)


def tallos_a_ramos(tallos: float, tallos_por_ramo: int) -> float:
    if not tallos_por_ramo or tallos_por_ramo <= 0:
        return float(tallos or 0)
    return float(tallos or 0) / float(tallos_por_ramo)
