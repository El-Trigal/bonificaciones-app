"""Registros diarios: preview (parseo sin guardar), confirmación, consulta y edición."""

import json
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import CargaCsv, LaborRendimiento, PlantillaCarga, RegistroDiario, Usuario
from services.auth import get_sede_activa, requiere_permiso
from services.parser_generico import parsear
from services.utils_semana import normalizar_codigo_semana, semana_desde_fecha

router = APIRouter(prefix="/api/registros-diarios", tags=["Registros Diarios"])


class RegistroDiarioOut(BaseModel):
    id: int
    fecha: date
    semana: str
    codigo_colaborador: int
    nombre_colaborador: str
    labor: str
    lider: str
    tallos: float
    ramos: float
    horas_ordinarias: float
    horas_extra_ordinarias: float
    horas_dominicales: float
    unidades_tarea: float
    horas_tarea: float
    origen: str

    class Config:
        from_attributes = True


class RegistroDiarioIn(BaseModel):
    fecha: date
    codigo_colaborador: int
    nombre_colaborador: str
    labor: str
    tallos: float = 0
    ramos: float = 0
    horas_ordinarias: float = 0
    horas_extra_ordinarias: float = 0
    horas_dominicales: float = 0
    unidades_tarea: float = 0
    horas_tarea: float = 0


def _lider_por_labor(db: Session, labor_nombre: str, sede_id: int) -> str:
    lab = db.query(LaborRendimiento).filter_by(nombre=labor_nombre, sede_id=sede_id).first()
    if lab and lab.lider_rel:
        return lab.lider_rel.nombre
    return "SIN LIDER"


def _enriquecer(db: Session, reg: dict, sede_id: int) -> dict:
    reg["lider"] = _lider_por_labor(db, reg["labor"], sede_id)
    return reg


@router.post("/preview")
def preview_carga(
    plantilla_id: int = Form(...),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("cargar_archivos")),
):
    sede_id = get_sede_activa(user)
    plantilla = db.query(PlantillaCarga).filter_by(id=plantilla_id, sede_id=sede_id).first()
    if not plantilla:
        raise HTTPException(404, "Plantilla no encontrada")

    tallos_por_ramo = 1
    if plantilla.labor_id:
        lab = db.query(LaborRendimiento).filter_by(id=plantilla.labor_id, sede_id=sede_id).first()
        if lab:
            tallos_por_ramo = lab.tallos_por_ramo or 1

    contenido = archivo.file.read()
    res = parsear(contenido, archivo.filename, plantilla.configuracion, tallos_por_ramo)
    for r in res["registros"]:
        _enriquecer(db, r, sede_id)
    return {
        "archivo": archivo.filename,
        "plantilla": plantilla.nombre,
        "total_filas": len(res["registros"]) + len(res["errores"]),
        "registros_ok": len(res["registros"]),
        "errores": res["errores"],
        "preview": res["registros"][:200],
        "registros": res["registros"],
    }


class ConfirmarIn(BaseModel):
    plantilla_id: int
    archivo: str
    registros: list[dict]


@router.post("/confirmar")
def confirmar_carga(
    data: ConfirmarIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("cargar_archivos")),
):
    sede_id = get_sede_activa(user)
    plantilla = db.query(PlantillaCarga).filter_by(id=data.plantilla_id, sede_id=sede_id).first()
    if not plantilla:
        raise HTTPException(404, "Plantilla no encontrada")

    carga = CargaCsv(
        sede_id=sede_id,
        nombre_archivo=data.archivo,
        tipo=plantilla.tipo,
        cargado_por=user.username,
        total_filas=len(data.registros),
        filas_ok=0,
        filas_error=0,
    )
    db.add(carga)
    db.flush()

    insertados = actualizados = 0
    errores = []
    pendientes: dict[tuple, RegistroDiario] = {}
    for idx, r in enumerate(data.registros):
        try:
            fecha = date.fromisoformat(r["fecha"]) if isinstance(r["fecha"], str) else r["fecha"]
            clave = (fecha, int(r["codigo_colaborador"]), r["labor"])
            existente = pendientes.get(clave) or db.query(RegistroDiario).filter_by(
                sede_id=sede_id,
                fecha=fecha,
                codigo_colaborador=int(r["codigo_colaborador"]),
                labor=r["labor"],
            ).first()
            campos = dict(
                sede_id=sede_id,
                carga_id=carga.id,
                fecha=fecha,
                semana=r.get("semana") or semana_desde_fecha(fecha),
                codigo_colaborador=int(r["codigo_colaborador"]),
                nombre_colaborador=r["nombre_colaborador"],
                labor=r["labor"],
                lider=r.get("lider") or _lider_por_labor(db, r["labor"], sede_id),
                tallos=float(r.get("tallos", 0) or 0),
                ramos=float(r.get("ramos", 0) or 0),
                horas_ordinarias=float(r.get("horas_ordinarias", 0) or 0),
                horas_extra_ordinarias=float(r.get("horas_extra_ordinarias", 0) or 0),
                horas_dominicales=float(r.get("horas_dominicales", 0) or 0),
                unidades_tarea=float(r.get("unidades_tarea", 0) or 0),
                horas_tarea=float(r.get("horas_tarea", 0) or 0),
                origen="CARGA",
            )
            if existente:
                for k, v in campos.items():
                    setattr(existente, k, v)
                if clave not in pendientes:
                    actualizados += 1
                pendientes[clave] = existente
            else:
                nuevo = RegistroDiario(**campos)
                db.add(nuevo)
                pendientes[clave] = nuevo
                insertados += 1
        except Exception as e:
            errores.append({"indice": idx, "error": str(e)})

    carga.filas_ok = insertados + actualizados
    carga.filas_error = len(errores)
    if errores:
        carga.detalle_errores = json.dumps(errores, ensure_ascii=False)
    db.commit()
    return {
        "carga_id": carga.id,
        "insertados": insertados,
        "actualizados": actualizados,
        "errores": errores,
    }


@router.get("", response_model=list[RegistroDiarioOut])
def listar(
    semana: Optional[str] = None,
    codigo_colaborador: Optional[int] = None,
    labor: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("ver_liquidaciones")),
):
    sede_id = get_sede_activa(user)
    q = db.query(RegistroDiario).filter(RegistroDiario.sede_id == sede_id)
    if semana:
        try:
            q = q.filter(RegistroDiario.semana == normalizar_codigo_semana(semana))
        except ValueError:
            raise HTTPException(400, "Código de semana inválido")
    if codigo_colaborador:
        q = q.filter(RegistroDiario.codigo_colaborador == codigo_colaborador)
    if labor:
        q = q.filter(RegistroDiario.labor == labor)
    return q.order_by(RegistroDiario.fecha, RegistroDiario.codigo_colaborador).all()


@router.post("", response_model=RegistroDiarioOut)
def crear_manual(
    data: RegistroDiarioIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_registros")),
):
    sede_id = get_sede_activa(user)
    if db.query(RegistroDiario).filter_by(
        sede_id=sede_id, fecha=data.fecha,
        codigo_colaborador=data.codigo_colaborador, labor=data.labor
    ).first():
        raise HTTPException(409, "Ya existe un registro para esa fecha/colaborador/labor")
    reg = RegistroDiario(
        **data.model_dump(),
        sede_id=sede_id,
        semana=semana_desde_fecha(data.fecha),
        lider=_lider_por_labor(db, data.labor, sede_id),
        origen="MANUAL",
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


@router.patch("/{registro_id}", response_model=RegistroDiarioOut)
def editar(
    registro_id: int, data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_registros")),
):
    sede_id = get_sede_activa(user)
    reg = db.query(RegistroDiario).filter_by(id=registro_id, sede_id=sede_id).first()
    if not reg:
        raise HTTPException(404, "No encontrado")
    editables = {
        "tallos", "ramos", "horas_ordinarias", "horas_extra_ordinarias",
        "horas_dominicales", "unidades_tarea", "horas_tarea", "nombre_colaborador",
    }
    for k, v in data.items():
        if k in editables:
            setattr(reg, k, v)
    reg.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(reg)
    return reg


@router.post("/recomputar-lider")
def recomputar_lider(
    semana: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_registros")),
):
    sede_id = get_sede_activa(user)
    q = db.query(RegistroDiario).filter(RegistroDiario.sede_id == sede_id)
    if semana:
        try:
            q = q.filter(RegistroDiario.semana == normalizar_codigo_semana(semana))
        except ValueError:
            raise HTTPException(400, "Semana inválida")

    cache: dict[str, str] = {}

    def lider_de(labor_nombre: str) -> str:
        if labor_nombre not in cache:
            cache[labor_nombre] = _lider_por_labor(db, labor_nombre, sede_id)
        return cache[labor_nombre]

    actualizados = revisados = 0
    for reg in q.all():
        revisados += 1
        nuevo = lider_de(reg.labor)
        if nuevo != reg.lider:
            reg.lider = nuevo
            actualizados += 1
    db.commit()
    return {"revisados": revisados, "actualizados": actualizados}


@router.delete("/{registro_id}")
def eliminar(
    registro_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_registros")),
):
    sede_id = get_sede_activa(user)
    reg = db.query(RegistroDiario).filter_by(id=registro_id, sede_id=sede_id).first()
    if not reg:
        raise HTTPException(404, "No encontrado")
    db.delete(reg)
    db.commit()
    return {"ok": True}
