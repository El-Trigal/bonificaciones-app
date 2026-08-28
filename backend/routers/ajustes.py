"""Ajustes retroactivos: si una semana de un periodo ya PAGADO se recalcula,
la diferencia se registra como ajuste pendiente para el próximo periodo ABIERTO.
"""

from datetime import datetime
from types import SimpleNamespace
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import (
    AjusteRetroactivo, LaborRendimiento, Liquidacion,
    PeriodoNomina, RegistroDiario, Semana, Usuario,
)
from services.auth import requiere_permiso
from services.calculador import calcular_bonif_rendimiento
from services.calculador_v2 import _consolidar_a_shim
from services.utils_semana import normalizar_codigo_semana

router = APIRouter(prefix="/api/ajustes", tags=["Ajustes retroactivos"])


class RecalcularIn(BaseModel):
    semana: str
    motivo: Optional[str] = None


class AjusteOut(BaseModel):
    id: int
    semana_original: str
    periodo_origen_id: int
    periodo_destino_id: int
    codigo_colaborador: int
    nombre_colaborador: str
    labor: str
    tipo_bonificacion: str
    monto_anterior: float
    monto_nuevo: float
    diferencia: float
    motivo: Optional[str] = None
    estado: str
    creado_por: str
    creado_en: datetime
    aprobado_por: Optional[str] = None
    aprobado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


def _periodo_destino(db: Session, fecha_origen) -> PeriodoNomina | None:
    """Encuentra el siguiente periodo ABIERTO después de una fecha dada."""
    return (
        db.query(PeriodoNomina)
        .filter(PeriodoNomina.estado == "ABIERTO")
        .filter(PeriodoNomina.fecha_inicio > fecha_origen)
        .order_by(PeriodoNomina.fecha_inicio)
        .first()
    )


@router.post("/recalcular-semana")
def recalcular_semana_con_ajuste(
    data: RecalcularIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("ejecutar_calculo")),
):
    """Recalcula una semana de un periodo PAGADO y genera ajustes pendientes.
    Si el periodo de la semana no está PAGADO, devuelve error (usar /calculo/ejecutar en su lugar).
    """
    semana_norm = normalizar_codigo_semana(data.semana)
    sem = db.query(Semana).filter_by(codigo=semana_norm).first()
    if not sem or not sem.periodo_nomina_id:
        raise HTTPException(400, "Semana no vinculada a un periodo de nómina")
    periodo_origen = db.query(PeriodoNomina).get(sem.periodo_nomina_id)
    if periodo_origen.estado != "PAGADO":
        raise HTTPException(400, f"El periodo {periodo_origen.codigo} no está PAGADO. Usa /calculo/ejecutar.")

    destino = _periodo_destino(db, periodo_origen.fecha_fin)
    if not destino:
        raise HTTPException(400, "No hay periodo ABIERTO posterior donde aplicar el ajuste")

    liqs_previas = db.query(Liquidacion).filter_by(semana=semana_norm).all()
    previas_por_clave = {(l.codigo_colaborador, l.labor): l for l in liqs_previas}

    registros = db.query(RegistroDiario).filter_by(semana=semana_norm).all()
    grupos: dict[tuple[int, str], list[RegistroDiario]] = {}
    for r in registros:
        grupos.setdefault((r.codigo_colaborador, r.labor), []).append(r)

    labores_cache = {l.nombre: l for l in db.query(LaborRendimiento).all()}
    creados = []
    for (codigo, labor_nombre), regs in grupos.items():
        lab = labores_cache.get(labor_nombre)
        if not lab:
            continue
        shim = _consolidar_a_shim(regs, db)
        nuevo = calcular_bonif_rendimiento(shim, lab, db)
        monto_nuevo = float(nuevo["total_bonificacion"] or 0)
        prev = previas_por_clave.get((codigo, labor_nombre))
        monto_anterior = float((prev.total_bonificacion if prev else 0) or 0)
        diferencia = monto_nuevo - monto_anterior
        if abs(diferencia) < 1:
            continue
        ajuste = AjusteRetroactivo(
            semana_original=semana_norm,
            periodo_origen_id=periodo_origen.id,
            periodo_destino_id=destino.id,
            codigo_colaborador=codigo,
            nombre_colaborador=regs[0].nombre_colaborador,
            labor=labor_nombre,
            tipo_bonificacion="RENDIMIENTO",
            monto_anterior=monto_anterior,
            monto_nuevo=monto_nuevo,
            diferencia=diferencia,
            motivo=data.motivo,
            estado="PENDIENTE",
            creado_por=user.username,
        )
        db.add(ajuste)
        creados.append(ajuste)

    db.commit()
    return {
        "semana": semana_norm,
        "periodo_origen": periodo_origen.codigo,
        "periodo_destino": destino.codigo,
        "ajustes_creados": len(creados),
    }


@router.get("", response_model=list[AjusteOut])
def listar(
    estado: Optional[str] = None,
    periodo_destino_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: Usuario = Depends(requiere_permiso("ver_liquidaciones")),
):
    q = db.query(AjusteRetroactivo)
    if estado:
        q = q.filter_by(estado=estado)
    if periodo_destino_id:
        q = q.filter_by(periodo_destino_id=periodo_destino_id)
    return q.order_by(AjusteRetroactivo.creado_en.desc()).all()


@router.post("/{ajuste_id}/aprobar", response_model=AjusteOut)
def aprobar(
    ajuste_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("aprobar_retroactivos")),
):
    a = db.query(AjusteRetroactivo).get(ajuste_id)
    if not a:
        raise HTTPException(404, "Ajuste no encontrado")
    if a.estado != "PENDIENTE":
        raise HTTPException(400, f"Ajuste está {a.estado}")
    a.estado = "APROBADO"
    a.aprobado_por = user.username
    a.aprobado_en = datetime.utcnow()
    db.commit()
    db.refresh(a)
    return a


@router.post("/{ajuste_id}/rechazar", response_model=AjusteOut)
def rechazar(
    ajuste_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("aprobar_retroactivos")),
):
    a = db.query(AjusteRetroactivo).get(ajuste_id)
    if not a:
        raise HTTPException(404, "Ajuste no encontrado")
    if a.estado != "PENDIENTE":
        raise HTTPException(400, f"Ajuste está {a.estado}")
    a.estado = "RECHAZADO"
    a.aprobado_por = user.username
    a.aprobado_en = datetime.utcnow()
    db.commit()
    db.refresh(a)
    return a
