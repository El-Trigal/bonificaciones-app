"""Módulo de calidad: carga de archivo + captura manual."""

import io
import json
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import CargaCsv, Empleado, RegistroCalidad, Usuario
from services.auth import get_sede_activa, requiere_permiso
from services.matcher_colaborador import construir_indice, matchear
from services.parser_calidad import parsear_varios
from services.utils_semana import normalizar_codigo_semana

router = APIRouter(prefix="/api/calidad", tags=["Calidad"])


class CalidadIn(BaseModel):
    semana: str
    codigo_colaborador: int
    labor: str
    pct_calidad: float
    observaciones: Optional[str] = None


class CalidadOut(BaseModel):
    id: int
    semana: str
    codigo_colaborador: int
    labor: str
    pct_calidad: float
    origen: str
    observaciones: Optional[str] = None

    class Config:
        from_attributes = True


def _normalizar_pct(v: float) -> float:
    if v is None:
        return 0.0
    return v / 100.0 if v > 1 else v


@router.get("", response_model=list[CalidadOut])
def listar(
    semana: Optional[str] = None,
    codigo_colaborador: Optional[int] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("ver_liquidaciones")),
):
    sede_id = get_sede_activa(user)
    q = db.query(RegistroCalidad).filter(RegistroCalidad.sede_id == sede_id)
    if semana:
        q = q.filter(RegistroCalidad.semana == normalizar_codigo_semana(semana))
    if codigo_colaborador:
        q = q.filter(RegistroCalidad.codigo_colaborador == codigo_colaborador)
    return q.order_by(RegistroCalidad.semana, RegistroCalidad.codigo_colaborador).all()


@router.post("", response_model=CalidadOut)
def upsert_manual(
    data: CalidadIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_registros")),
):
    sede_id = get_sede_activa(user)
    semana_norm = normalizar_codigo_semana(data.semana)
    existente = db.query(RegistroCalidad).filter_by(
        sede_id=sede_id,
        semana=semana_norm,
        codigo_colaborador=data.codigo_colaborador,
        labor=data.labor,
    ).first()
    pct = _normalizar_pct(data.pct_calidad)
    if existente:
        existente.pct_calidad = pct
        existente.observaciones = data.observaciones
        existente.origen = "MANUAL"
        db.commit()
        db.refresh(existente)
        return existente
    reg = RegistroCalidad(
        sede_id=sede_id,
        semana=semana_norm,
        codigo_colaborador=data.codigo_colaborador,
        labor=data.labor,
        pct_calidad=pct,
        observaciones=data.observaciones,
        origen="MANUAL",
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


@router.delete("/{reg_id}")
def eliminar(
    reg_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_registros")),
):
    sede_id = get_sede_activa(user)
    reg = db.query(RegistroCalidad).filter_by(id=reg_id, sede_id=sede_id).first()
    if not reg:
        raise HTTPException(404, "No encontrado")
    db.delete(reg)
    db.commit()
    return {"ok": True}


@router.post("/cargar")
async def cargar_archivo(
    archivo: UploadFile = File(...),
    col_codigo: str = Form("CODIGO"),
    col_labor: str = Form("LABOR"),
    col_semana: str = Form("SEMANA"),
    col_pct: str = Form("CALIDAD"),
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("cargar_archivos")),
):
    sede_id = get_sede_activa(user)
    contenido = await archivo.read()
    try:
        if archivo.filename.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contenido), dtype=str, keep_default_na=False)
        else:
            df = pd.read_excel(io.BytesIO(contenido), dtype=str)
    except Exception as e:
        raise HTTPException(400, f"No se pudo leer archivo: {e}")

    cols_norm = {c.strip().lower(): c for c in df.columns}
    def col(nombre):
        c = cols_norm.get(nombre.strip().lower())
        if not c:
            raise HTTPException(400, f"Columna no encontrada: {nombre}")
        return c

    c_cod, c_lab, c_sem, c_pct = col(col_codigo), col(col_labor), col(col_semana), col(col_pct)

    carga = CargaCsv(
        sede_id=sede_id,
        nombre_archivo=archivo.filename, tipo="CALIDAD",
        cargado_por=user.username, total_filas=len(df), filas_ok=0, filas_error=0,
    )
    db.add(carga)
    db.flush()

    insertados = actualizados = 0
    errores = []
    for idx, fila in df.iterrows():
        try:
            semana = normalizar_codigo_semana(fila[c_sem])
            codigo = int(float(str(fila[c_cod]).strip()))
            labor = str(fila[c_lab]).strip()
            pct = _normalizar_pct(float(str(fila[c_pct]).replace(",", ".")))
            existente = db.query(RegistroCalidad).filter_by(
                sede_id=sede_id, semana=semana, codigo_colaborador=codigo, labor=labor
            ).first()
            if existente:
                existente.pct_calidad = pct
                existente.origen = "CARGA"
                existente.carga_id = carga.id
                actualizados += 1
            else:
                db.add(RegistroCalidad(
                    sede_id=sede_id, carga_id=carga.id, semana=semana,
                    codigo_colaborador=codigo, labor=labor, pct_calidad=pct, origen="CARGA",
                ))
                insertados += 1
        except Exception as e:
            errores.append({"fila": int(idx) + 2, "error": str(e)})

    carga.filas_ok = insertados + actualizados
    carga.filas_error = len(errores)
    db.commit()
    return {
        "carga_id": carga.id, "insertados": insertados,
        "actualizados": actualizados, "errores": errores,
    }


@router.post("/preview-multicarga")
async def preview_multicarga(
    semana: str = Form(...),
    labor: str = Form(...),
    archivos: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("cargar_archivos")),
):
    sede_id = get_sede_activa(user)
    try:
        semana_norm = normalizar_codigo_semana(semana)
    except ValueError as e:
        raise HTTPException(400, f"Semana inválida: {e}")

    payload = []
    for up in archivos:
        payload.append((await up.read(), up.filename))
    res = parsear_varios(payload)

    indice = construir_indice(db, sede_id)

    por_nombre: dict[str, list[dict]] = {}
    for f in res["filas"]:
        por_nombre.setdefault(f["nombre_excel"], []).append(f)

    resueltos_map: dict[int, dict] = {}
    pendientes: list[dict] = []

    for nombre_excel, filas in por_nombre.items():
        m = matchear(nombre_excel, indice)
        if m["match"]:
            cod = m["match"]["codigo"]
            entry = resueltos_map.setdefault(cod, {
                "codigo": cod, "nombre": m["match"]["nombre"], "detalle": [],
            })
            entry["detalle"].extend(filas)
        else:
            valores = [f["cfd_producto"] for f in filas]
            pendientes.append({
                "nombre_excel": nombre_excel,
                "valor_prom": round(sum(valores) / len(valores), 4),
                "detalle": filas,
                "sugerencias": m["sugerencias"],
            })

    resueltos = []
    for entry in resueltos_map.values():
        valores = [d["cfd_producto"] for d in entry["detalle"]]
        resueltos.append({
            "codigo": entry["codigo"],
            "nombre": entry["nombre"],
            "pct_calidad": round(sum(valores) / len(valores), 4),
            "detalle": entry["detalle"],
        })
    resueltos.sort(key=lambda r: r["nombre"])

    return {
        "semana": semana_norm,
        "labor": labor,
        "resueltos": resueltos,
        "pendientes": pendientes,
        "errores_parseo": res["errores"],
    }


class ConfirmarMultiItem(BaseModel):
    codigo: int
    nombre: str
    pct_calidad: float
    detalle: list[dict]


class ConfirmarMultiIn(BaseModel):
    semana: str
    labor: str
    items: list[ConfirmarMultiItem]
    archivo_resumen: Optional[str] = None


@router.post("/confirmar-multicarga")
def confirmar_multicarga(
    data: ConfirmarMultiIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("cargar_archivos")),
):
    sede_id = get_sede_activa(user)
    semana_norm = normalizar_codigo_semana(data.semana)
    carga = CargaCsv(
        sede_id=sede_id,
        nombre_archivo=data.archivo_resumen or f"calidad_multi_{semana_norm}",
        tipo="CALIDAD",
        cargado_por=user.username,
        total_filas=len(data.items),
        filas_ok=0, filas_error=0,
    )
    db.add(carga)
    db.flush()

    insertados = actualizados = 0
    errores = []
    for it in data.items:
        try:
            pct = _normalizar_pct(it.pct_calidad)
            detalle_json = json.dumps({
                "nombre": it.nombre, "promedio": pct, "filas": it.detalle,
            }, ensure_ascii=False)
            existente = db.query(RegistroCalidad).filter_by(
                sede_id=sede_id, semana=semana_norm,
                codigo_colaborador=it.codigo, labor=data.labor,
            ).first()
            if existente:
                existente.pct_calidad = pct
                existente.origen = "CARGA"
                existente.carga_id = carga.id
                existente.observaciones = detalle_json
                actualizados += 1
            else:
                db.add(RegistroCalidad(
                    sede_id=sede_id, carga_id=carga.id, semana=semana_norm,
                    codigo_colaborador=it.codigo, labor=data.labor,
                    pct_calidad=pct, origen="CARGA", observaciones=detalle_json,
                ))
                insertados += 1
        except Exception as e:
            errores.append({"codigo": it.codigo, "error": str(e)})

    carga.filas_ok = insertados + actualizados
    carga.filas_error = len(errores)
    db.commit()
    return {
        "carga_id": carga.id,
        "insertados": insertados,
        "actualizados": actualizados,
        "errores": errores,
    }
