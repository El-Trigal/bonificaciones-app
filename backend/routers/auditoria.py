"""Historial de cargas CSV y auditoría."""

import json
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import CargaCsv, RegistroRendimiento, RegistroLaborEspecifica
from schemas import CargaCsvOut

router = APIRouter()


@router.get("/cargas")
def listar_cargas(
    tipo: Optional[str] = None,
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db)
):
    q = db.query(CargaCsv)
    if tipo:
        q = q.filter(CargaCsv.tipo == tipo)
    if desde:
        q = q.filter(CargaCsv.fecha_carga >= desde)
    if hasta:
        q = q.filter(CargaCsv.fecha_carga <= hasta)

    total = q.count()
    items = q.order_by(CargaCsv.fecha_carga.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return {
        "items": [CargaCsvOut.model_validate(i).model_dump() for i in items],
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.get("/cargas/{id}/detalle")
def detalle_carga(id: int, db: Session = Depends(get_db)):
    carga = db.query(CargaCsv).get(id)
    if not carga:
        raise HTTPException(404, "Carga no encontrada")

    errores = json.loads(carga.detalle_errores) if carga.detalle_errores else []

    return {
        "carga": CargaCsvOut.model_validate(carga).model_dump(),
        "errores": errores,
    }


@router.get("/cargas/{id}/datos")
def datos_carga(id: int, db: Session = Depends(get_db)):
    carga = db.query(CargaCsv).get(id)
    if not carga:
        raise HTTPException(404, "Carga no encontrada")

    if carga.tipo == "RENDIMIENTO":
        registros = db.query(RegistroRendimiento).filter(
            RegistroRendimiento.carga_id == id
        ).all()
        return {
            "tipo": "RENDIMIENTO",
            "total": len(registros),
            "registros": [
                {
                    "id": r.id,
                    "semana": r.semana,
                    "lider": r.lider,
                    "labor": r.labor,
                    "codigo_colaborador": r.codigo_colaborador,
                    "nombre_colaborador": r.nombre_colaborador,
                    "pct_calidad": r.pct_calidad,
                }
                for r in registros
            ],
        }
    else:
        registros = db.query(RegistroLaborEspecifica).filter(
            RegistroLaborEspecifica.carga_id == id
        ).all()
        return {
            "tipo": "LABOR_ESPECIFICA",
            "total": len(registros),
            "registros": [
                {
                    "id": r.id,
                    "semana": r.semana,
                    "lider": r.lider,
                    "labor": r.labor,
                    "tipo_bonificacion": r.tipo_bonificacion,
                    "codigo_colaborador": r.codigo_colaborador,
                    "nombre_colaborador": r.nombre_colaborador,
                    "total_bonificacion_manual": r.total_bonificacion_manual,
                }
                for r in registros
            ],
        }
