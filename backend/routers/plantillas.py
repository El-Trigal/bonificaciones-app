"""CRUD de plantillas de carga."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import PlantillaCarga, Usuario
from services.auth import requiere_permiso

router = APIRouter(prefix="/api/plantillas", tags=["Plantillas"])

TIPOS_VALIDOS = {"RENDIMIENTO_DIARIO", "CALIDAD", "HE_DOMINICAL"}
UNIDADES_VALIDAS = {"TALLOS", "RAMOS"}


class PlantillaIn(BaseModel):
    nombre: str
    tipo: str
    labor_id: Optional[int] = None
    configuracion: dict
    unidad_origen: str = "TALLOS"
    activo: bool = True


class PlantillaOut(BaseModel):
    id: int
    nombre: str
    tipo: str
    labor_id: Optional[int]
    configuracion: dict
    unidad_origen: str
    activo: bool

    class Config:
        from_attributes = True


def _to_out(p: PlantillaCarga) -> PlantillaOut:
    try:
        cfg = json.loads(p.configuracion) if isinstance(p.configuracion, str) else p.configuracion
    except Exception:
        cfg = {}
    return PlantillaOut(
        id=p.id, nombre=p.nombre, tipo=p.tipo, labor_id=p.labor_id,
        configuracion=cfg, unidad_origen=p.unidad_origen, activo=p.activo,
    )


def _validar(data: PlantillaIn):
    if data.tipo not in TIPOS_VALIDOS:
        raise HTTPException(400, f"Tipo inválido. Válidos: {sorted(TIPOS_VALIDOS)}")
    if data.unidad_origen not in UNIDADES_VALIDAS:
        raise HTTPException(400, f"unidad_origen inválida. Válidos: {sorted(UNIDADES_VALIDAS)}")
    cols = (data.configuracion or {}).get("columnas") or {}
    obligatorias = {"codigo_colaborador", "nombre_colaborador", "fecha"}
    faltan = obligatorias - set(cols.keys())
    if faltan:
        raise HTTPException(400, f"Columnas obligatorias en config: {sorted(faltan)}")
    if not data.configuracion.get("labor_fija") and "labor" not in cols:
        raise HTTPException(400, "Se requiere columna 'labor' o 'labor_fija' en config")


@router.get("", response_model=list[PlantillaOut])
def listar(
    tipo: Optional[str] = None,
    db: Session = Depends(get_db),
    _: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    q = db.query(PlantillaCarga)
    if tipo:
        q = q.filter_by(tipo=tipo)
    return [_to_out(p) for p in q.order_by(PlantillaCarga.nombre).all()]


@router.post("", response_model=PlantillaOut)
def crear(
    data: PlantillaIn,
    db: Session = Depends(get_db),
    _: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    _validar(data)
    if db.query(PlantillaCarga).filter_by(nombre=data.nombre).first():
        raise HTTPException(409, "Nombre de plantilla ya existe")
    p = PlantillaCarga(
        nombre=data.nombre, tipo=data.tipo, labor_id=data.labor_id,
        configuracion=json.dumps(data.configuracion),
        unidad_origen=data.unidad_origen, activo=data.activo,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_out(p)


@router.patch("/{plantilla_id}", response_model=PlantillaOut)
def actualizar(
    plantilla_id: int, data: PlantillaIn,
    db: Session = Depends(get_db),
    _: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    _validar(data)
    p = db.query(PlantillaCarga).get(plantilla_id)
    if not p:
        raise HTTPException(404, "No encontrada")
    p.nombre = data.nombre
    p.tipo = data.tipo
    p.labor_id = data.labor_id
    p.configuracion = json.dumps(data.configuracion)
    p.unidad_origen = data.unidad_origen
    p.activo = data.activo
    db.commit()
    db.refresh(p)
    return _to_out(p)


@router.delete("/{plantilla_id}")
def eliminar(
    plantilla_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    p = db.query(PlantillaCarga).get(plantilla_id)
    if not p:
        raise HTTPException(404, "No encontrada")
    db.delete(p)
    db.commit()
    return {"ok": True}
