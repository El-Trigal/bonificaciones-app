"""Periodos de nómina: listar, cerrar, marcar pagado, consolidado final."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import AjusteRetroactivo, Liquidacion, PeriodoNomina, Semana, Usuario
from services.auth import get_sede_activa, requiere_permiso

router = APIRouter(prefix="/api/periodos", tags=["Periodos"])


class PeriodoOut(BaseModel):
    id: int
    codigo: str
    año: int
    mes: int
    quincena: int
    fecha_inicio: str
    fecha_fin: str
    fecha_pago: str
    estado: str
    cerrado_por: Optional[str] = None
    cerrado_en: Optional[str] = None
    pagado_por: Optional[str] = None
    pagado_en: Optional[str] = None
    semanas: list[str] = []


def _to_out(p: PeriodoNomina, semanas_codigos: list[str]) -> PeriodoOut:
    return PeriodoOut(
        id=p.id, codigo=p.codigo, año=p.año, mes=p.mes, quincena=p.quincena,
        fecha_inicio=str(p.fecha_inicio), fecha_fin=str(p.fecha_fin), fecha_pago=str(p.fecha_pago),
        estado=p.estado,
        cerrado_por=p.cerrado_por, cerrado_en=p.cerrado_en.isoformat() if p.cerrado_en else None,
        pagado_por=p.pagado_por, pagado_en=p.pagado_en.isoformat() if p.pagado_en else None,
        semanas=semanas_codigos,
    )


@router.get("", response_model=list[PeriodoOut])
def listar(
    año: Optional[int] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("ver_liquidaciones")),
):
    sede_id = get_sede_activa(user)
    q = db.query(PeriodoNomina).filter(PeriodoNomina.sede_id == sede_id)
    if año:
        q = q.filter_by(año=año)
    periodos = q.order_by(PeriodoNomina.fecha_inicio).all()
    return [
        _to_out(p, [s.codigo for s in db.query(Semana).filter_by(periodo_nomina_id=p.id, sede_id=sede_id).order_by(Semana.codigo).all()])
        for p in periodos
    ]


@router.post("/{periodo_id}/cerrar", response_model=PeriodoOut)
def cerrar(
    periodo_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("cerrar_periodo")),
):
    sede_id = get_sede_activa(user)
    p = db.query(PeriodoNomina).filter_by(id=periodo_id, sede_id=sede_id).first()
    if not p:
        raise HTTPException(404, "No encontrado")
    if p.estado != "ABIERTO":
        raise HTTPException(400, f"El periodo está {p.estado}, no se puede cerrar")
    p.estado = "CERRADO"
    p.cerrado_por = user.username
    p.cerrado_en = datetime.utcnow()
    db.commit()
    db.refresh(p)
    semanas_cods = [s.codigo for s in db.query(Semana).filter_by(periodo_nomina_id=p.id, sede_id=sede_id).all()]
    return _to_out(p, semanas_cods)


@router.post("/{periodo_id}/marcar-pagado", response_model=PeriodoOut)
def marcar_pagado(
    periodo_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("marcar_pagado")),
):
    sede_id = get_sede_activa(user)
    p = db.query(PeriodoNomina).filter_by(id=periodo_id, sede_id=sede_id).first()
    if not p:
        raise HTTPException(404, "No encontrado")
    if p.estado != "CERRADO":
        raise HTTPException(400, f"El periodo está {p.estado}, debe estar CERRADO primero")
    p.estado = "PAGADO"
    p.pagado_por = user.username
    p.pagado_en = datetime.utcnow()
    db.commit()
    db.refresh(p)
    semanas_cods = [s.codigo for s in db.query(Semana).filter_by(periodo_nomina_id=p.id, sede_id=sede_id).all()]
    return _to_out(p, semanas_cods)


@router.post("/{periodo_id}/reabrir", response_model=PeriodoOut)
def reabrir(
    periodo_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("cerrar_periodo")),
):
    sede_id = get_sede_activa(user)
    p = db.query(PeriodoNomina).filter_by(id=periodo_id, sede_id=sede_id).first()
    if not p:
        raise HTTPException(404, "No encontrado")
    if p.estado == "PAGADO":
        raise HTTPException(400, "Un periodo PAGADO no se puede reabrir")
    p.estado = "ABIERTO"
    p.cerrado_por = None
    p.cerrado_en = None
    db.commit()
    db.refresh(p)
    semanas_cods = [s.codigo for s in db.query(Semana).filter_by(periodo_nomina_id=p.id, sede_id=sede_id).all()]
    return _to_out(p, semanas_cods)


@router.get("/{periodo_id}/consolidado")
def consolidado(
    periodo_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("ver_liquidaciones")),
):
    sede_id = get_sede_activa(user)
    p = db.query(PeriodoNomina).filter_by(id=periodo_id, sede_id=sede_id).first()
    if not p:
        raise HTTPException(404, "No encontrado")

    semanas = [s.codigo for s in db.query(Semana).filter_by(periodo_nomina_id=p.id, sede_id=sede_id).all()]
    if not semanas:
        return {"periodo": p.codigo, "semanas": [], "filas": [], "totales": {}}

    liqs = db.query(Liquidacion).filter(
        Liquidacion.sede_id == sede_id,
        Liquidacion.semana.in_(semanas),
    ).all()

    por_cod: dict[int, dict] = {}
    for l in liqs:
        if l.codigo_colaborador not in por_cod:
            por_cod[l.codigo_colaborador] = {
                "codigo": l.codigo_colaborador,
                "nombre": l.nombre_colaborador,
                "tipos": set(),
                "permanencia": 0.0,
                "rendimiento": 0.0,
                "total": 0.0,
            }
        fila = por_cod[l.codigo_colaborador]
        if l.tipo_bonificacion:
            fila["tipos"].add(l.tipo_bonificacion)
        permanencia = (l.bonif_auxilio or 0) + (l.bonif_constitutiva or 0)
        rendimiento = (
            (l.bonif_rendimiento or 0) + (l.bonif_he_ordinaria or 0) +
            (l.bonif_he_dominical or 0) + (l.bonif_tarea or 0) +
            (l.bonif_labor_especifica or 0) + (l.bonif_apoyo or 0)
        )
        fila["permanencia"] += permanencia
        fila["rendimiento"] += rendimiento
        fila["total"] += (l.total_bonificacion or 0)

    ajustes = db.query(AjusteRetroactivo).filter_by(
        periodo_destino_id=p.id, estado="APROBADO", sede_id=sede_id
    ).all()
    for a in ajustes:
        if a.codigo_colaborador not in por_cod:
            por_cod[a.codigo_colaborador] = {
                "codigo": a.codigo_colaborador,
                "nombre": a.nombre_colaborador,
                "tipos": set(),
                "permanencia": 0.0,
                "rendimiento": 0.0,
                "total": 0.0,
            }
        fila = por_cod[a.codigo_colaborador]
        fila["tipos"].add(f"AJUSTE-{a.semana_original}")
        fila["rendimiento"] += a.diferencia
        fila["total"] += a.diferencia

    filas = []
    totales = {"permanencia": 0.0, "rendimiento": 0.0, "total": 0.0, "ajustes": sum(a.diferencia for a in ajustes)}
    for f in sorted(por_cod.values(), key=lambda x: x["codigo"]):
        f["tipos"] = sorted(f["tipos"])
        filas.append(f)
        totales["permanencia"] += f["permanencia"]
        totales["rendimiento"] += f["rendimiento"]
        totales["total"] += f["total"]

    return {
        "periodo": p.codigo,
        "estado": p.estado,
        "fecha_pago": str(p.fecha_pago),
        "semanas": semanas,
        "filas": filas,
        "totales": totales,
        "cantidad_colaboradores": len(filas),
    }
