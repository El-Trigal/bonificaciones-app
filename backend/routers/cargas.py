"""Upload y procesamiento de CSVs de rendimiento y labor específica."""

import csv
import io
import os
import json
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from models import (
    CargaCsv, RegistroRendimiento, RegistroLaborEspecifica,
    Lider, Liquidacion, PasoCalculo, Usuario
)
from services.auth import get_sede_activa, requiere_permiso
from services.validador_csv import validar_rendimiento, validar_labor_especifica
from services.calculador import calcular_liquidacion_completa

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOADS_DIR = os.path.join(BASE_DIR, "data", "uploads")


def _safe_float(val, default=0):
    try:
        return float(val) if val and val.strip() else default
    except (ValueError, AttributeError):
        return default


def _safe_int(val, default=0):
    try:
        return int(val) if val and val.strip() else default
    except (ValueError, AttributeError):
        return default


def _safe_date(val):
    if not val or not val.strip():
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(val.strip(), fmt).date()
        except ValueError:
            continue
    return None


# ─── Validación (sin guardar) ──────────────────────────────
@router.post("/validar-rendimiento")
async def validar_csv_rendimiento(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(requiere_permiso("cargar_archivos")),
):
    contenido = (await archivo.read()).decode("utf-8-sig")
    resultado = validar_rendimiento(contenido, db)
    return resultado


@router.post("/validar-labor-especifica")
async def validar_csv_labor(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(requiere_permiso("cargar_archivos")),
):
    contenido = (await archivo.read()).decode("utf-8-sig")
    resultado = validar_labor_especifica(contenido, db)
    return resultado


# ─── Carga + Cálculo ──────────────────────────────────────
@router.post("/cargar-rendimiento")
async def cargar_rendimiento(
    archivo: UploadFile = File(...),
    nombre_usuario: str = Form(...),
    semana: str = Form(""),
    ignorar_errores: bool = Form(False),
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("cargar_archivos")),
):
    sede_id = get_sede_activa(user)
    if not sede_id:
        raise HTTPException(400, "Debes seleccionar una sede antes de cargar archivos")

    contenido = (await archivo.read()).decode("utf-8-sig")
    validacion = validar_rendimiento(contenido, db)
    if validacion["filas_error"] > 0 and not ignorar_errores:
        return {"validacion": validacion, "cargado": False,
                "mensaje": f"Hay {validacion['filas_error']} filas con errores. Active 'ignorar errores' para cargar solo las filas correctas."}

    os.makedirs(UPLOADS_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre_guardado = f"rend_{timestamp}_{archivo.filename}"
    ruta = os.path.join(UPLOADS_DIR, nombre_guardado)
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(contenido)

    carga = CargaCsv(
        sede_id=sede_id,
        nombre_archivo=archivo.filename,
        tipo="RENDIMIENTO",
        cargado_por=user.username,
        total_filas=validacion["total_filas"],
        filas_ok=validacion["filas_ok"],
        filas_error=validacion["filas_error"],
        detalle_errores=json.dumps(validacion["errores"], ensure_ascii=False) if validacion["errores"] else None,
        archivo_path=nombre_guardado,
    )
    db.add(carga)
    db.flush()

    errores_idx = {e["fila"] for e in validacion["errores"]}
    reader = csv.DictReader(io.StringIO(contenido))
    semanas_procesadas = set()

    for i, row in enumerate(reader, start=2):
        if i in errores_idx:
            continue
        row = {k.strip(): (v.strip() if v else "") for k, v in row.items()}

        lider_nombre = row.get("lider", "")
        if lider_nombre:
            existente = db.query(Lider).filter_by(nombre=lider_nombre, sede_id=sede_id).first()
            if not existente:
                db.add(Lider(nombre=lider_nombre, sede_id=sede_id))
                db.flush()

        sem = row.get("semana", semana)
        semanas_procesadas.add(sem)

        reg = RegistroRendimiento(
            sede_id=sede_id,
            carga_id=carga.id,
            fecha_reporte=_safe_date(row.get("fecha_reporte")),
            semana=sem,
            lider=lider_nombre,
            labor=row.get("labor", ""),
            codigo_colaborador=_safe_int(row.get("codigo_colaborador")),
            nombre_colaborador=row.get("nombre_colaborador", ""),
            pct_calificacion_colaborador=_safe_float(row.get("pct_calificacion_colaborador"), 1.0),
            pct_calidad=_safe_float(row.get("pct_calidad")),
            dom_ramos=_safe_float(row.get("dom_ramos")),
            dom_hs_ord=_safe_float(row.get("dom_hs_ord")),
            dom_hs_extra=_safe_float(row.get("dom_hs_extra")),
            lun_ramos=_safe_float(row.get("lun_ramos")),
            lun_hs_ord=_safe_float(row.get("lun_hs_ord")),
            lun_hs_extra=_safe_float(row.get("lun_hs_extra")),
            mar_ramos=_safe_float(row.get("mar_ramos")),
            mar_hs_ord=_safe_float(row.get("mar_hs_ord")),
            mar_hs_extra=_safe_float(row.get("mar_hs_extra")),
            mie_ramos=_safe_float(row.get("mie_ramos")),
            mie_hs_ord=_safe_float(row.get("mie_hs_ord")),
            mie_hs_extra=_safe_float(row.get("mie_hs_extra")),
            jue_ramos=_safe_float(row.get("jue_ramos")),
            jue_hs_ord=_safe_float(row.get("jue_hs_ord")),
            jue_hs_extra=_safe_float(row.get("jue_hs_extra")),
            vie_ramos=_safe_float(row.get("vie_ramos")),
            vie_hs_ord=_safe_float(row.get("vie_hs_ord")),
            vie_hs_extra=_safe_float(row.get("vie_hs_extra")),
            sab_ramos=_safe_float(row.get("sab_ramos")),
            sab_hs_ord=_safe_float(row.get("sab_hs_ord")),
            sab_hs_extra=_safe_float(row.get("sab_hs_extra")),
            total_unidades_he=_safe_float(row.get("total_unidades_he")),
            hs_extras_ordinarias=_safe_float(row.get("hs_extras_ordinarias")),
            total_unidades_dominical=_safe_float(row.get("total_unidades_dominical")),
            hs_dominicales=_safe_float(row.get("hs_dominicales")),
            lun_unid_tarea=_safe_float(row.get("lun_unid_tarea")),
            lun_hs_tarea=_safe_float(row.get("lun_hs_tarea")),
            mar_unid_tarea=_safe_float(row.get("mar_unid_tarea")),
            mar_hs_tarea=_safe_float(row.get("mar_hs_tarea")),
            mie_unid_tarea=_safe_float(row.get("mie_unid_tarea")),
            mie_hs_tarea=_safe_float(row.get("mie_hs_tarea")),
            jue_unid_tarea=_safe_float(row.get("jue_unid_tarea")),
            jue_hs_tarea=_safe_float(row.get("jue_hs_tarea")),
            vie_unid_tarea=_safe_float(row.get("vie_unid_tarea")),
            vie_hs_tarea=_safe_float(row.get("vie_hs_tarea")),
            sab_unid_tarea=_safe_float(row.get("sab_unid_tarea")),
            sab_hs_tarea=_safe_float(row.get("sab_hs_tarea")),
        )
        db.add(reg)

    db.flush()
    resultado_calculo = calcular_liquidacion_completa(semana, carga.id, "RENDIMIENTO", db)

    return {
        "cargado": True,
        "carga_id": carga.id,
        "validacion": validacion,
        "calculo": resultado_calculo,
        "semanas_procesadas": list(semanas_procesadas),
    }


@router.post("/cargar-labor-especifica")
async def cargar_labor_especifica(
    archivo: UploadFile = File(...),
    nombre_usuario: str = Form(...),
    semana: str = Form(""),
    ignorar_errores: bool = Form(False),
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("cargar_archivos")),
):
    sede_id = get_sede_activa(user)
    if not sede_id:
        raise HTTPException(400, "Debes seleccionar una sede antes de cargar archivos")

    contenido = (await archivo.read()).decode("utf-8-sig")
    validacion = validar_labor_especifica(contenido, db)

    if validacion["filas_error"] > 0 and not ignorar_errores:
        return {"validacion": validacion, "cargado": False,
                "mensaje": f"Hay {validacion['filas_error']} filas con errores."}

    os.makedirs(UPLOADS_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre_guardado = f"labor_{timestamp}_{archivo.filename}"
    ruta = os.path.join(UPLOADS_DIR, nombre_guardado)
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(contenido)

    carga = CargaCsv(
        sede_id=sede_id,
        nombre_archivo=archivo.filename,
        tipo="LABOR_ESPECIFICA",
        cargado_por=user.username,
        total_filas=validacion["total_filas"],
        filas_ok=validacion["filas_ok"],
        filas_error=validacion["filas_error"],
        detalle_errores=json.dumps(validacion["errores"], ensure_ascii=False) if validacion["errores"] else None,
        archivo_path=nombre_guardado,
    )
    db.add(carga)
    db.flush()

    errores_idx = {e["fila"] for e in validacion["errores"]}
    reader = csv.DictReader(io.StringIO(contenido))

    for i, row in enumerate(reader, start=2):
        if i in errores_idx:
            continue
        row = {k.strip(): (v.strip() if v else "") for k, v in row.items()}

        lider_nombre = row.get("lider", "")
        if lider_nombre:
            existente = db.query(Lider).filter_by(nombre=lider_nombre, sede_id=sede_id).first()
            if not existente:
                db.add(Lider(nombre=lider_nombre, sede_id=sede_id))
                db.flush()

        reg = RegistroLaborEspecifica(
            sede_id=sede_id,
            carga_id=carga.id,
            fecha_reporte=_safe_date(row.get("fecha_reporte")),
            semana=row.get("semana", semana),
            lider=lider_nombre,
            producto_area=row.get("producto_area", ""),
            tipo_bonificacion=row.get("tipo_bonificacion", ""),
            labor=row.get("labor", ""),
            asociada_a=row.get("asociada_a"),
            codigo_colaborador=_safe_int(row.get("codigo_colaborador")),
            nombre_colaborador=row.get("nombre_colaborador", ""),
            pct_calificacion_colaborador=_safe_float(row.get("pct_calificacion_colaborador"), 1.0),
            fecha_inicial=_safe_date(row.get("fecha_inicial")),
            fecha_final=_safe_date(row.get("fecha_final")),
            hora_inicial=row.get("hora_inicial"),
            hora_final=row.get("hora_final"),
            unidades_adicionales=_safe_float(row.get("unidades_adicionales")) or None,
            total_bonificacion_manual=_safe_float(row.get("total_bonificacion_manual")) or None,
            observaciones=row.get("observaciones"),
        )
        db.add(reg)

    db.flush()
    resultado_calculo = calcular_liquidacion_completa(semana, carga.id, "LABOR_ESPECIFICA", db)

    return {
        "cargado": True,
        "carga_id": carga.id,
        "validacion": validacion,
        "calculo": resultado_calculo,
    }


# ─── Plantillas CSV ───────────────────────────────────────
@router.get("/plantilla-rendimiento")
def descargar_plantilla_rendimiento(
    _: Usuario = Depends(requiere_permiso("cargar_archivos")),
):
    output = io.StringIO()
    writer = csv.writer(output)
    columnas = [
        "fecha_reporte", "semana", "lider", "labor", "codigo_colaborador",
        "nombre_colaborador", "pct_calidad", "pct_calificacion_colaborador",
        "dom_ramos", "dom_hs_ord", "dom_hs_extra",
        "lun_ramos", "lun_hs_ord", "lun_hs_extra",
        "mar_ramos", "mar_hs_ord", "mar_hs_extra",
        "mie_ramos", "mie_hs_ord", "mie_hs_extra",
        "jue_ramos", "jue_hs_ord", "jue_hs_extra",
        "vie_ramos", "vie_hs_ord", "vie_hs_extra",
        "sab_ramos", "sab_hs_ord", "sab_hs_extra",
        "total_unidades_he", "hs_extras_ordinarias",
        "total_unidades_dominical", "hs_dominicales",
        "lun_unid_tarea", "lun_hs_tarea", "mar_unid_tarea", "mar_hs_tarea",
        "mie_unid_tarea", "mie_hs_tarea", "jue_unid_tarea", "jue_hs_tarea",
        "vie_unid_tarea", "vie_hs_tarea", "sab_unid_tarea", "sab_hs_tarea",
    ]
    writer.writerow(columnas)
    writer.writerow([
        "2026-01-30", "2026-03", "OMAR FERNEY FONNEGRA", "CORTE CR-MW-SL",
        "48989", "LOPEZ RIVERA JUAN CAMILO", "0.90", "1.0",
        "0", "0", "0", "195", "7.25", "0", "210", "7.25", "0",
        "188", "7.25", "0", "202", "7.25", "0", "195", "7.25", "0", "0", "0", "0",
        "0", "0", "0", "0",
        "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0",
    ])
    content = output.getvalue()
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=plantilla_rendimiento.csv"}
    )


@router.get("/plantilla-labor-especifica")
def descargar_plantilla_labor(
    _: Usuario = Depends(requiere_permiso("cargar_archivos")),
):
    output = io.StringIO()
    writer = csv.writer(output)
    columnas = [
        "fecha_reporte", "semana", "lider", "producto_area", "tipo_bonificacion",
        "labor", "asociada_a", "codigo_colaborador", "nombre_colaborador",
        "pct_calificacion_colaborador", "fecha_inicial", "fecha_final",
        "hora_inicial", "hora_final", "unidades_adicionales",
        "total_bonificacion_manual", "observaciones",
    ]
    writer.writerow(columnas)
    writer.writerow([
        "2026-01-30", "2026-03", "WILSON PEDRAZA", "MIPE", "LABOR ESPECIFICA",
        "ACUMULADO TURNO ASPERSION", "Fin turno de aspersion",
        "198199", "ESPAÑA ORTEGA JHAN LUIS", "1.0",
        "", "", "", "", "1", "650590", "",
    ])
    content = output.getvalue()
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=plantilla_labor_especifica.csv"}
    )
