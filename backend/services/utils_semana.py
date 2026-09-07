"""Utilidades de normalización de códigos de semana, conversión tallos/ramos y festivos colombianos."""

from datetime import date, timedelta
import re
import datetime as dt


# ─── Festivos colombianos ─────────────────────────────────────────────────────

def _pascua(año: int) -> dt.date:
    a = año % 19
    b, c = divmod(año, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mes = (h + l - 7 * m + 114) // 31
    dia = (h + l - 7 * m + 114) % 31 + 1
    return dt.date(año, mes, dia)


def _siguiente_lunes(d: dt.date) -> dt.date:
    dias = (7 - d.weekday()) % 7
    return d if dias == 0 else d + dt.timedelta(days=dias)


def festivos_colombia(año: int) -> list[dt.date]:
    """Retorna lista de festivos colombianos para el año dado."""
    pascua = _pascua(año)
    festivos = [
        dt.date(año, 1, 1),
        dt.date(año, 5, 1),
        dt.date(año, 7, 20),
        dt.date(año, 8, 7),
        dt.date(año, 12, 8),
        dt.date(año, 12, 25),
        pascua - dt.timedelta(days=3),
        pascua - dt.timedelta(days=2),
        _siguiente_lunes(dt.date(año, 1, 6)),
        _siguiente_lunes(dt.date(año, 3, 19)),
        _siguiente_lunes(dt.date(año, 6, 29)),
        _siguiente_lunes(dt.date(año, 8, 15)),
        _siguiente_lunes(dt.date(año, 10, 12)),
        _siguiente_lunes(dt.date(año, 11, 1)),
        _siguiente_lunes(dt.date(año, 11, 11)),
        _siguiente_lunes(pascua + dt.timedelta(days=39)),
        _siguiente_lunes(pascua + dt.timedelta(days=60)),
        _siguiente_lunes(pascua + dt.timedelta(days=68)),
    ]
    return sorted(set(festivos))


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
