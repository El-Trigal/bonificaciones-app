"""Matcher de nombres de colaborador contra la tabla maestra `empleados`.

Estrategia:
1. Normaliza (sin tildes, lower, tokens ordenados alfabéticamente).
2. Match exacto por tokens ordenados (resuelve "APELLIDO NOMBRE" vs "NOMBRE APELLIDO").
3. Si no: top-3 sugerencias con difflib.SequenceMatcher score.
"""

from __future__ import annotations

import unicodedata
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from models import Empleado


def _quitar_tildes(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")


def _tokens(s: str) -> list[str]:
    s = _quitar_tildes(str(s)).lower()
    return [t for t in s.replace(".", " ").replace(",", " ").split() if t]


def _clave(s: str) -> str:
    return " ".join(sorted(_tokens(s)))


def construir_indice(db: Session, sede_id: int) -> dict[str, tuple[int, str]]:
    """Devuelve {clave_normalizada: (codigo, nombre_original)} filtrado por sede."""
    idx = {}
    for emp in db.query(Empleado).filter_by(activo=True, sede_id=sede_id).all():
        idx[_clave(emp.nombre)] = (emp.codigo, emp.nombre)
    return idx


def matchear(nombre_excel: str, indice: dict[str, tuple[int, str]], n_sug: int = 3) -> dict:
    """Intenta match exacto; si falla devuelve sugerencias top-N con score."""
    clave = _clave(nombre_excel)
    if not clave:
        return {"match": None, "sugerencias": []}
    if clave in indice:
        codigo, nombre = indice[clave]
        return {"match": {"codigo": codigo, "nombre": nombre}, "sugerencias": []}

    scored = []
    for k, (codigo, nombre) in indice.items():
        score = SequenceMatcher(None, clave, k).ratio()
        scored.append((score, codigo, nombre))
    scored.sort(reverse=True, key=lambda x: x[0])
    sugerencias = [
        {"codigo": c, "nombre": n, "score": round(s, 3)}
        for s, c, n in scored[:n_sug] if s >= 0.55
    ]
    return {"match": None, "sugerencias": sugerencias}
