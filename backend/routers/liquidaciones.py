"""Consulta de liquidaciones, trazabilidad y exportación."""

import io
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import distinct
from typing import Optional
from database import get_db
from models import Liquidacion, PasoCalculo, Usuario
from schemas import LiquidacionOut, LiquidacionDetalle
from services.auth import get_current_user, get_sede_activa, requiere_permiso
from services.exportador import generar_consolidado_nomina

router = APIRouter()


@router.get("")
def listar_liquidaciones(
    semana: Optional[str] = None,
    lider: Optional[str] = None,
    tipo: Optional[str] = None,
    colaborador: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("ver_liquidaciones")),
):
    sede_id = get_sede_activa(user)
    q = db.query(Liquidacion).filter(Liquidacion.sede_id == sede_id)
    if semana:
        q = q.filter(Liquidacion.semana == semana)
    if lider:
        q = q.filter(Liquidacion.lider.ilike(f"%{lider}%"))
    if tipo:
        q = q.filter(Liquidacion.tipo_bonificacion == tipo)
    if colaborador:
        if colaborador.isdigit():
            q = q.filter(Liquidacion.codigo_colaborador == int(colaborador))
        else:
            q = q.filter(Liquidacion.nombre_colaborador.ilike(f"%{colaborador}%"))

    total = q.count()
    items = q.order_by(
        Liquidacion.semana.desc(), Liquidacion.nombre_colaborador
    ).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "items": [LiquidacionOut.model_validate(i).model_dump() for i in items],
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.get("/{id}/trazabilidad")
def obtener_trazabilidad(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("ver_trazabilidad")),
):
    sede_id = get_sede_activa(user)
    liq = db.query(Liquidacion).filter_by(id=id, sede_id=sede_id).first()
    if not liq:
        raise HTTPException(404, "Liquidación no encontrada")
    return {
        "liquidacion": LiquidacionDetalle.model_validate(liq).model_dump(),
        "detalle_calculo": json.loads(liq.detalle_calculo_narrativo),
    }


@router.get("/colaborador/{codigo}")
def historial_colaborador(
    codigo: int,
    semana: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("ver_liquidaciones")),
):
    sede_id = get_sede_activa(user)
    q = db.query(Liquidacion).filter(
        Liquidacion.sede_id == sede_id,
        Liquidacion.codigo_colaborador == codigo,
    )
    if semana:
        q = q.filter(Liquidacion.semana == semana)

    liquidaciones = q.order_by(Liquidacion.semana.desc(), Liquidacion.labor).all()

    if not liquidaciones:
        return {"colaborador": None, "liquidaciones": [], "resumen": {}}

    resumen_semanas = {}
    for liq in liquidaciones:
        resumen_semanas[liq.semana] = resumen_semanas.get(liq.semana, 0) + (liq.total_bonificacion or 0)

    return {
        "colaborador": {
            "codigo": codigo,
            "nombre": liquidaciones[0].nombre_colaborador,
        },
        "liquidaciones": [LiquidacionOut.model_validate(l).model_dump() for l in liquidaciones],
        "resumen_por_semana": [
            {"semana": s, "total": t} for s, t in sorted(resumen_semanas.items())
        ],
    }


@router.get("/exportar-consolidado")
def exportar_consolidado(
    semana: str = Query(...),
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("ver_informes")),
):
    sede_id = get_sede_activa(user)
    csv_content = generar_consolidado_nomina(semana, db, sede_id)
    return StreamingResponse(
        io.BytesIO(csv_content.encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=consolidado_{semana}.csv"}
    )


@router.get("/semanas-con-datos")
def semanas_con_datos(
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("ver_liquidaciones")),
):
    sede_id = get_sede_activa(user)
    semanas = db.query(distinct(Liquidacion.semana)).filter(
        Liquidacion.sede_id == sede_id
    ).order_by(Liquidacion.semana.desc()).all()
    return [s[0] for s in semanas]


@router.get("/tipos-disponibles")
def tipos_disponibles(
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("ver_liquidaciones")),
):
    sede_id = get_sede_activa(user)
    tipos = db.query(distinct(Liquidacion.tipo_bonificacion)).filter(
        Liquidacion.sede_id == sede_id
    ).all()
    return [t[0] for t in tipos if t[0]]


@router.get("/lideres-disponibles")
def lideres_disponibles(
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("ver_liquidaciones")),
):
    sede_id = get_sede_activa(user)
    lideres = db.query(distinct(Liquidacion.lider)).filter(
        Liquidacion.sede_id == sede_id,
        Liquidacion.lider.isnot(None),
    ).all()
    return sorted([l[0] for l in lideres if l[0]])
