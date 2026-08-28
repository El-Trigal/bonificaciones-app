"""Resúmenes y totales para el dashboard."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import Optional
from database import get_db
from models import Liquidacion, RegistroRendimiento, RegistroLaborEspecifica, Usuario
from services.auth import get_current_user, get_sede_activa

router = APIRouter()


@router.get("/resumen")
def resumen_dashboard(
    semana: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    sede_id = get_sede_activa(user)
    q = db.query(Liquidacion).filter(Liquidacion.sede_id == sede_id)
    if semana:
        q = q.filter(Liquidacion.semana == semana)

    liquidaciones = q.all()

    if not liquidaciones:
        return {
            "total_a_pagar": 0,
            "colaboradores_con_bonificacion": 0,
            "registros_cargados": 0,
            "sin_bonificacion": 0,
            "resumen_por_tipo": {},
            "resumen_por_lider": [],
        }

    total = sum(l.total_bonificacion or 0 for l in liquidaciones)
    con_bonif = len(set(l.codigo_colaborador for l in liquidaciones if (l.total_bonificacion or 0) > 0))
    sin_bonif = len(set(l.codigo_colaborador for l in liquidaciones if (l.total_bonificacion or 0) == 0))
    total_registros = len(liquidaciones)

    por_tipo = {}
    for l in liquidaciones:
        tipo = l.tipo_bonificacion or "OTROS"
        por_tipo[tipo] = por_tipo.get(tipo, 0) + (l.total_bonificacion or 0)

    por_lider = {}
    for l in liquidaciones:
        lider = l.lider or "SIN LÍDER"
        if lider not in por_lider:
            por_lider[lider] = {
                "lider": lider,
                "rendimiento": 0, "labor_especifica": 0,
                "apoyo": 0, "auxilio_constitutiva": 0, "total": 0
            }
        g = por_lider[lider]
        g["rendimiento"] += (l.bonif_rendimiento or 0) + (l.bonif_he_ordinaria or 0) + (l.bonif_he_dominical or 0) + (l.bonif_tarea or 0)
        g["labor_especifica"] += l.bonif_labor_especifica or 0
        g["apoyo"] += l.bonif_apoyo or 0
        g["auxilio_constitutiva"] += (l.bonif_auxilio or 0) + (l.bonif_constitutiva or 0)
        g["total"] += l.total_bonificacion or 0

    return {
        "total_a_pagar": total,
        "colaboradores_con_bonificacion": con_bonif,
        "registros_cargados": total_registros,
        "sin_bonificacion": sin_bonif,
        "resumen_por_tipo": por_tipo,
        "resumen_por_lider": sorted(por_lider.values(), key=lambda x: x["total"], reverse=True),
    }


@router.get("/por-lider")
def resumen_por_lider(
    semana: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    sede_id = get_sede_activa(user)
    q = db.query(Liquidacion).filter(Liquidacion.sede_id == sede_id)
    if semana:
        q = q.filter(Liquidacion.semana == semana)

    liquidaciones = q.all()
    por_lider = {}
    for l in liquidaciones:
        lider = l.lider or "SIN LÍDER"
        if lider not in por_lider:
            por_lider[lider] = {
                "lider": lider, "colaboradores": set(),
                "rendimiento": 0, "he_ordinaria": 0, "he_dominical": 0,
                "tarea": 0, "labor_especifica": 0, "apoyo": 0,
                "auxilio": 0, "constitutiva": 0, "total": 0
            }
        g = por_lider[lider]
        g["colaboradores"].add(l.codigo_colaborador)
        g["rendimiento"] += l.bonif_rendimiento or 0
        g["he_ordinaria"] += l.bonif_he_ordinaria or 0
        g["he_dominical"] += l.bonif_he_dominical or 0
        g["tarea"] += l.bonif_tarea or 0
        g["labor_especifica"] += l.bonif_labor_especifica or 0
        g["apoyo"] += l.bonif_apoyo or 0
        g["auxilio"] += l.bonif_auxilio or 0
        g["constitutiva"] += l.bonif_constitutiva or 0
        g["total"] += l.total_bonificacion or 0

    resultado = []
    for g in sorted(por_lider.values(), key=lambda x: x["total"], reverse=True):
        g["colaboradores"] = len(g["colaboradores"])
        resultado.append(g)
    return resultado


@router.get("/semanas-disponibles")
def semanas_disponibles(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    sede_id = get_sede_activa(user)
    semanas = db.query(
        Liquidacion.semana,
        func.count(distinct(Liquidacion.codigo_colaborador)).label("colaboradores"),
        func.sum(Liquidacion.total_bonificacion).label("total"),
    ).filter(Liquidacion.sede_id == sede_id).group_by(Liquidacion.semana).order_by(Liquidacion.semana.desc()).all()

    return [
        {"semana": s.semana, "colaboradores": s.colaboradores, "total": s.total or 0}
        for s in semanas
    ]
