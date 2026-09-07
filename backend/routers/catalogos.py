"""CRUD de catálogos: empleados, labores, semanas, líderes, productos, tipos."""

import csv
import io
import json
import openpyxl
import datetime as dt
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from database import get_db
from models import (
    Empleado, Lider, ProductoArea, Semana, LaborRendimiento, TipoBonificacion, Usuario,
    ConfigCurvaCalidad, Sede,
)
from schemas import (
    EmpleadoCreate, EmpleadoUpdate, EmpleadoOut,
    LiderCreate, LiderOut,
    ProductoAreaCreate, ProductoAreaOut,
    SemanaCreate, SemanaUpdate, SemanaOut,
    LaborRendimientoCreate, LaborRendimientoUpdate, LaborRendimientoOut,
    TipoBonificacionCreate, TipoBonificacionOut,
    CurvaCalidadOut, GuardarCurvaIn, GuardarCurvaBulkIn, ReglaCalidadOut,
    ConfigLaboresOut, ConfigLaboresIn,
    ConfigNominaOut, ConfigNominaIn,
    ConfigSemanasOut, ConfigSemanasIn,
)
from services.calculador import CURVA_CALIDAD_DEFAULT
from services.auth import get_current_user, get_sede_activa, requiere_permiso
from services.utils_semana import festivos_colombia

router = APIRouter()


def _dia_idx(fecha: dt.date) -> int:
    """0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb"""
    return (fecha.weekday() + 1) % 7


# ─── Empleados ─────────────────────────────────────────────
@router.get("/empleados", response_model=List[EmpleadoOut])
def listar_empleados(
    buscar: Optional[str] = None,
    activo: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    sede_id = get_sede_activa(user)
    q = db.query(Empleado).filter(Empleado.sede_id == sede_id)
    if activo is not None:
        q = q.filter(Empleado.activo == activo)
    if buscar:
        q = q.filter(
            (Empleado.nombre.ilike(f"%{buscar}%")) |
            (Empleado.codigo == int(buscar) if buscar.isdigit() else False)
        )
    return q.order_by(Empleado.nombre).all()


@router.post("/empleados", response_model=EmpleadoOut)
def crear_empleado(
    data: EmpleadoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    if db.query(Empleado).filter_by(sede_id=sede_id, codigo=data.codigo).first():
        raise HTTPException(400, f"Ya existe un empleado con código {data.codigo}")
    emp = Empleado(**data.model_dump(), sede_id=sede_id)
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.put("/empleados/{id}", response_model=EmpleadoOut)
def actualizar_empleado(
    id: int, data: EmpleadoUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    emp = db.query(Empleado).filter_by(id=id, sede_id=sede_id).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(emp, k, v)
    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/empleados/{id}")
def desactivar_empleado(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    emp = db.query(Empleado).filter_by(id=id, sede_id=sede_id).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    emp.activo = False
    db.commit()
    return {"mensaje": f"Empleado {emp.nombre} desactivado"}


@router.post("/empleados/importar-csv")
async def importar_empleados_csv(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    contenido = (await archivo.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(contenido))
    creados = 0
    actualizados = 0
    errores = []

    for i, row in enumerate(reader, start=2):
        try:
            codigo = int(row.get("codigo", "").strip())
            nombre = row.get("nombre", "").strip()
            cargo = row.get("cargo", "").strip() or "OPERARIO"

            existente = db.query(Empleado).filter_by(sede_id=sede_id, codigo=codigo).first()
            if existente:
                existente.nombre = nombre
                existente.cargo = cargo
                existente.activo = True
                actualizados += 1
            else:
                db.add(Empleado(sede_id=sede_id, codigo=codigo, nombre=nombre, cargo=cargo))
                creados += 1
        except Exception as e:
            errores.append(f"Fila {i}: {str(e)}")

    db.commit()
    return {"creados": creados, "actualizados": actualizados, "errores": errores}


def _parsear_excel_empleados(contenido_bytes: bytes) -> tuple[list[dict], list[str]]:
    """Lee el Excel de RR.HH. y mapea las columnas al modelo interno.
    Retorna (filas_validas, errores). Cada fila válida tiene: codigo, nombre, cargo.
    """
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contenido_bytes), read_only=True, data_only=True)
        ws = wb.active
    except Exception as e:
        raise HTTPException(400, f"No se pudo leer el archivo Excel: {e}")

    filas = list(ws.iter_rows(values_only=True))
    if not filas:
        raise HTTPException(400, "El archivo está vacío")

    # Detectar fila de encabezados (primera fila con la columna "ID" o "NOMBRE")
    header_row_idx = None
    headers = []
    for idx, row in enumerate(filas):
        row_str = [str(c).strip().upper() if c is not None else "" for c in row]
        if "ID" in row_str and "NOMBRE" in row_str:
            header_row_idx = idx
            headers = row_str
            break

    if header_row_idx is None:
        raise HTTPException(400, "No se encontraron las columnas requeridas: ID y NOMBRE")

    def col(name: str):
        try:
            return headers.index(name)
        except ValueError:
            return None

    idx_id = col("ID")
    idx_nombre = col("NOMBRE")
    idx_cargo = col("CARGO")

    validas = []
    errores = []

    for fila_num, row in enumerate(filas[header_row_idx + 1:], start=header_row_idx + 2):
        # Ignorar filas completamente vacías
        if all(c is None or str(c).strip() == "" for c in row):
            continue

        raw_id = str(row[idx_id]).strip() if row[idx_id] is not None else ""
        raw_nombre = str(row[idx_nombre]).strip() if row[idx_nombre] is not None else ""
        raw_cargo = str(row[idx_cargo]).strip() if (idx_cargo is not None and row[idx_cargo] is not None) else ""

        # Filas con ID y NOMBRE vacíos son artefactos de Excel (celdas con formato
        # pero sin datos). Se omiten silenciosamente en lugar de reportarlas como error.
        if not raw_id and not raw_nombre:
            continue

        fila_errores = []

        # ID requerido y debe ser entero
        try:
            codigo = int(float(raw_id)) if raw_id else None
        except (ValueError, TypeError):
            codigo = None

        if not raw_id:
            fila_errores.append("ID vacío")
        elif codigo is None:
            fila_errores.append(f"ID no es un número válido: '{raw_id}'")

        # Nombre requerido
        if not raw_nombre:
            fila_errores.append("NOMBRE vacío")

        if fila_errores:
            # Incluir el nombre en el error para identificar al colaborador
            nombre_ref = f" ({raw_nombre})" if raw_nombre else ""
            errores.append(f"Fila {fila_num}{nombre_ref}: {', '.join(fila_errores)}")
            continue

        validas.append({
            "codigo": codigo,
            "nombre": raw_nombre,
            "cargo": raw_cargo or "OPERARIO",
        })

    return validas, errores


@router.post("/empleados/validar-excel")
async def validar_empleados_excel(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    if not archivo.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "El archivo debe ser Excel (.xlsx o .xls)")

    sede_id = get_sede_activa(user)
    contenido = await archivo.read()
    validas, errores = _parsear_excel_empleados(contenido)

    # Clasificar cada fila válida: nueva o actualización
    nuevos = []
    actualizaciones = []
    for fila in validas:
        existente = db.query(Empleado).filter_by(sede_id=sede_id, codigo=fila["codigo"]).first()
        if existente:
            cambios = []
            if existente.nombre != fila["nombre"]:
                cambios.append(f"nombre: '{existente.nombre}' → '{fila['nombre']}'")
            if (existente.cargo or "OPERARIO") != fila["cargo"]:
                cambios.append(f"cargo: '{existente.cargo}' → '{fila['cargo']}'")
            actualizaciones.append({**fila, "cambios": cambios})
        else:
            nuevos.append(fila)

    return {
        "total_filas": len(validas) + len(errores),
        "validas": len(validas),
        "errores": errores,
        "preview": {
            "nuevos": nuevos,
            "actualizaciones": actualizaciones,
        },
    }


@router.post("/empleados/confirmar-excel")
async def confirmar_empleados_excel(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    if not archivo.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "El archivo debe ser Excel (.xlsx o .xls)")

    sede_id = get_sede_activa(user)
    contenido = await archivo.read()
    validas, errores = _parsear_excel_empleados(contenido)

    if not validas:
        raise HTTPException(400, "No hay filas válidas para importar")

    creados = 0
    actualizados = 0

    for fila in validas:
        existente = db.query(Empleado).filter_by(sede_id=sede_id, codigo=fila["codigo"]).first()
        if existente:
            existente.nombre = fila["nombre"]
            existente.cargo = fila["cargo"]
            existente.activo = True
            actualizados += 1
        else:
            db.add(Empleado(sede_id=sede_id, **fila))
            creados += 1

    db.commit()
    return {"creados": creados, "actualizados": actualizados, "errores": errores}


# ─── Labores de Rendimiento ───────────────────────────────
@router.get("/config-labores", response_model=ConfigLaboresOut)
def get_config_labores(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    sede_id = get_sede_activa(user)
    sede = db.query(Sede).filter_by(id=sede_id).first()
    return {"salario_base_default": sede.salario_base_default or 1423500}


@router.put("/config-labores", response_model=ConfigLaboresOut)
def set_config_labores(
    data: ConfigLaboresIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    sede = db.query(Sede).filter_by(id=sede_id).first()
    sede.salario_base_default = data.salario_base_default
    db.commit()

    if data.propagar:
        labores = db.query(LaborRendimiento).filter_by(sede_id=sede_id, activo=True).all()
        for labor in labores:
            labor.salario_base = data.salario_base_default
            labor.recalcular_valores()
        db.commit()

    return {"salario_base_default": sede.salario_base_default}


@router.get("/config-nomina", response_model=ConfigNominaOut)
def get_config_nomina(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    sede_id = get_sede_activa(user)
    sede = db.query(Sede).filter_by(id=sede_id).first()
    salario = sede.salario_base_default or 1423500
    horas = sede.horas_mensuales_default or 240
    pct_he = sede.recargo_he_diurna_pct if sede.recargo_he_diurna_pct is not None else 25
    pct_dom = sede.recargo_dominical_pct if sede.recargo_dominical_pct is not None else 75
    vho = salario / horas
    return {
        "salario_base_default": salario,
        "horas_mensuales_default": horas,
        "recargo_he_diurna_pct": pct_he,
        "recargo_dominical_pct": pct_dom,
        "tarifa_he_ordinaria": round(vho * (1 + pct_he / 100), 2),
        "tarifa_he_dominical": round(vho * (1 + pct_dom / 100), 2),
    }


@router.put("/config-nomina", response_model=ConfigNominaOut)
def set_config_nomina(
    data: ConfigNominaIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    sede = db.query(Sede).filter_by(id=sede_id).first()
    sede.salario_base_default = data.salario_base_default
    sede.horas_mensuales_default = data.horas_mensuales_default
    sede.recargo_he_diurna_pct = data.recargo_he_diurna_pct
    sede.recargo_dominical_pct = data.recargo_dominical_pct
    db.commit()

    vho = data.salario_base_default / data.horas_mensuales_default
    tarifa_he = round(vho * (1 + data.recargo_he_diurna_pct / 100), 2)
    tarifa_dom = round(vho * (1 + data.recargo_dominical_pct / 100), 2)

    if data.propagar:
        labores = db.query(LaborRendimiento).filter_by(sede_id=sede_id, activo=True).all()
        for labor in labores:
            labor.salario_base = data.salario_base_default
            labor.tarifa_he_ordinaria = tarifa_he
            labor.tarifa_he_dominical = tarifa_dom
            labor.recalcular_valores()
        db.commit()

    return {
        "salario_base_default": sede.salario_base_default,
        "horas_mensuales_default": sede.horas_mensuales_default,
        "recargo_he_diurna_pct": sede.recargo_he_diurna_pct,
        "recargo_dominical_pct": sede.recargo_dominical_pct,
        "tarifa_he_ordinaria": tarifa_he,
        "tarifa_he_dominical": tarifa_dom,
    }


@router.get("/labores-rendimiento", response_model=List[LaborRendimientoOut])
def listar_labores(
    activo: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    sede_id = get_sede_activa(user)
    q = db.query(LaborRendimiento).filter(LaborRendimiento.sede_id == sede_id)
    if activo is not None:
        q = q.filter(LaborRendimiento.activo == activo)
    return q.order_by(LaborRendimiento.nombre).all()


@router.post("/labores-rendimiento", response_model=LaborRendimientoOut)
def crear_labor(
    data: LaborRendimientoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    if db.query(LaborRendimiento).filter_by(sede_id=sede_id, nombre=data.nombre).first():
        raise HTTPException(400, f"Ya existe la labor '{data.nombre}'")
    labor = LaborRendimiento(**data.model_dump(), sede_id=sede_id)
    labor.recalcular_valores()
    db.add(labor)
    db.commit()
    db.refresh(labor)
    return labor


@router.put("/labores-rendimiento/{id}", response_model=LaborRendimientoOut)
def actualizar_labor(
    id: int, data: LaborRendimientoUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    labor = db.query(LaborRendimiento).filter_by(id=id, sede_id=sede_id).first()
    if not labor:
        raise HTTPException(404, "Labor no encontrada")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(labor, k, v)
    labor.recalcular_valores()
    db.commit()
    db.refresh(labor)
    return labor


@router.delete("/labores-rendimiento/{id}")
def desactivar_labor(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    labor = db.query(LaborRendimiento).filter_by(id=id, sede_id=sede_id).first()
    if not labor:
        raise HTTPException(404, "Labor no encontrada")
    labor.activo = False
    db.commit()
    return {"mensaje": f"Labor '{labor.nombre}' desactivada"}


# ─── Semanas ───────────────────────────────────────────────
@router.get("/semanas", response_model=List[SemanaOut])
def listar_semanas(
    año: Optional[int] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    sede_id = get_sede_activa(user)
    q = db.query(Semana).filter(Semana.sede_id == sede_id)
    if año:
        q = q.filter(Semana.año == año)
    return q.order_by(Semana.codigo).all()


@router.post("/semanas", response_model=SemanaOut)
def crear_semana(
    data: SemanaCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    if db.query(Semana).filter_by(sede_id=sede_id, codigo=data.codigo).first():
        raise HTTPException(400, f"Semana '{data.codigo}' ya existe")
    semana = Semana(**data.model_dump(), sede_id=sede_id)
    db.add(semana)
    db.commit()
    db.refresh(semana)
    return semana


@router.get("/config-semanas", response_model=ConfigSemanasOut)
def get_config_semanas(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    sede_id = get_sede_activa(user)
    sede = db.query(Sede).filter_by(id=sede_id).first()
    def _v(val, default): return val if val is not None else default
    return ConfigSemanasOut(
        dia_inicio_semana=_v(sede.dia_inicio_semana, 1),
        horas_lun_default=_v(sede.horas_lun_default, 8.5),
        horas_mar_default=_v(sede.horas_mar_default, 7.25),
        horas_mie_default=_v(sede.horas_mie_default, 7.25),
        horas_jue_default=_v(sede.horas_jue_default, 7.25),
        horas_vie_default=_v(sede.horas_vie_default, 7.25),
        horas_sab_default=_v(sede.horas_sab_default, 6.0),
        horas_dom_default=_v(sede.horas_dom_default, 0.0),
    )


@router.put("/config-semanas")
def put_config_semanas(
    data: ConfigSemanasIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    sede = db.query(Sede).filter_by(id=sede_id).first()
    sede.dia_inicio_semana = data.dia_inicio_semana
    sede.horas_lun_default = data.horas_lun_default
    sede.horas_mar_default = data.horas_mar_default
    sede.horas_mie_default = data.horas_mie_default
    sede.horas_jue_default = data.horas_jue_default
    sede.horas_vie_default = data.horas_vie_default
    sede.horas_sab_default = data.horas_sab_default
    sede.horas_dom_default = data.horas_dom_default
    db.commit()

    actualizadas = 0
    if data.propagar and data.año_propagar:
        festivos = set(festivos_colombia(data.año_propagar))
        semanas = db.query(Semana).filter_by(sede_id=sede_id, año=data.año_propagar).all()
        plantilla = {
            1: data.horas_lun_default, 2: data.horas_mar_default,
            3: data.horas_mie_default, 4: data.horas_jue_default,
            5: data.horas_vie_default, 6: data.horas_sab_default,
            0: data.horas_dom_default,
        }
        for s in semanas:
            if s.modificacion_manual:
                continue
            _aplicar_plantilla(s, plantilla, festivos)
            actualizadas += 1
        db.commit()

    return {"ok": True, "actualizadas": actualizadas}


@router.get("/festivos")
def get_festivos(
    año: int,
    user: Usuario = Depends(get_current_user),
):
    return [str(f) for f in festivos_colombia(año)]


def _aplicar_plantilla(semana: Semana, plantilla: dict, festivos: set):
    """Aplica horas por día a la semana y recalcula horas_ordinarias.
    Los días festivos se guardan con 0h (no se trabaja ese día).
    """
    dias_festivo = []
    total = 0.0
    for idx, attr in [(1, "horas_lun"), (2, "horas_mar"), (3, "horas_mie"),
                      (4, "horas_jue"), (5, "horas_vie"), (6, "horas_sab"), (0, "horas_dom")]:
        horas = plantilla.get(idx, 0.0) or 0.0
        es_festivo = False
        if semana.fecha_inicio:
            for offset in range(7):
                d = semana.fecha_inicio + dt.timedelta(days=offset)
                if _dia_idx(d) == idx and d in festivos:
                    dias_festivo.append(idx)
                    es_festivo = True
                    break
        valor = 0.0 if es_festivo else horas
        setattr(semana, attr, valor)
        total += valor
    semana.horas_ordinarias = total
    semana.tiene_festivo = bool(dias_festivo)
    semana.festivos_dias = json.dumps(dias_festivo)


@router.post("/semanas/generar-ano")
def generar_semanas_ano(
    año: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    """Genera las 52/53 semanas ISO del año usando la plantilla de la sede."""
    sede_id = get_sede_activa(user)
    sede = db.query(Sede).filter_by(id=sede_id).first()
    festivos = set(festivos_colombia(año))

    def _sv(val, default): return val if val is not None else default
    plantilla = {
        1: _sv(sede.horas_lun_default, 8.5),
        2: _sv(sede.horas_mar_default, 7.25),
        3: _sv(sede.horas_mie_default, 7.25),
        4: _sv(sede.horas_jue_default, 7.25),
        5: _sv(sede.horas_vie_default, 7.25),
        6: _sv(sede.horas_sab_default, 6.0),
        0: _sv(sede.horas_dom_default, 0.0),
    }
    total_default = sum(plantilla.values())

    dia_inicio = _sv(sede.dia_inicio_semana, 1)  # 0=Dom, 1=Lun

    creadas = 0
    omitidas = 0
    last_week = dt.date(año, 12, 28).isocalendar()[1]
    for w in range(1, last_week + 1):
        codigo = f"{str(año)[2:]}{w:02d}"
        existente = db.query(Semana).filter_by(sede_id=sede_id, codigo=codigo).first()
        if existente:
            omitidas += 1
            continue

        # Inicio de semana según config
        if dia_inicio == 1:  # Lunes
            fecha_ini = dt.date.fromisocalendar(año, w, 1)
        else:  # Domingo
            fecha_ini = dt.date.fromisocalendar(año, w, 1) - dt.timedelta(days=1)
        fecha_fin = fecha_ini + dt.timedelta(days=6)

        semana = Semana(
            sede_id=sede_id,
            codigo=codigo,
            año=año,
            horas_ordinarias=total_default,
            tiene_festivo=False,
            fecha_inicio=fecha_ini,
            fecha_cierre=fecha_fin,
            modificacion_manual=False,
        )
        _aplicar_plantilla(semana, plantilla, festivos)
        db.add(semana)
        creadas += 1
    db.commit()
    return {"creadas": creadas, "omitidas": omitidas, "año": año}


@router.put("/semanas/{id}", response_model=SemanaOut)
def actualizar_semana(
    id: int, data: SemanaUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    semana = db.query(Semana).filter_by(id=id, sede_id=sede_id).first()
    if not semana:
        raise HTTPException(404, "Semana no encontrada")
    campos = data.model_dump(exclude_unset=True)
    for k, v in campos.items():
        setattr(semana, k, v)
    # Si se editaron horas por día, recalcular total y marcar modificación manual
    dia_cols = ["horas_lun", "horas_mar", "horas_mie", "horas_jue", "horas_vie", "horas_sab", "horas_dom"]
    if any(c in campos for c in dia_cols):
        total = sum((getattr(semana, c) or 0) for c in dia_cols)
        semana.horas_ordinarias = total
        semana.modificacion_manual = True
    db.commit()
    db.refresh(semana)
    return semana


# ─── Líderes ──────────────────────────────────────────────
@router.get("/lideres", response_model=List[LiderOut])
def listar_lideres(
    activo: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    sede_id = get_sede_activa(user)
    q = db.query(Lider).filter(Lider.sede_id == sede_id)
    if activo is not None:
        q = q.filter(Lider.activo == activo)
    return q.order_by(Lider.nombre).all()


@router.post("/lideres", response_model=LiderOut)
def crear_lider(
    data: LiderCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    if db.query(Lider).filter_by(sede_id=sede_id, nombre=data.nombre).first():
        raise HTTPException(400, f"Líder '{data.nombre}' ya existe")
    lider = Lider(**data.model_dump(), sede_id=sede_id)
    db.add(lider)
    db.commit()
    db.refresh(lider)
    return lider


@router.put("/lideres/{id}", response_model=LiderOut)
def actualizar_lider(
    id: int, data: LiderCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    lider = db.query(Lider).filter_by(id=id, sede_id=sede_id).first()
    if not lider:
        raise HTTPException(404, "Líder no encontrado")
    lider.nombre = data.nombre
    lider.activo = data.activo
    db.commit()
    db.refresh(lider)
    return lider


@router.delete("/lideres/{id}")
def desactivar_lider(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    lider = db.query(Lider).filter_by(id=id, sede_id=sede_id).first()
    if not lider:
        raise HTTPException(404, "Líder no encontrado")
    lider.activo = False
    db.commit()
    return {"mensaje": f"Líder '{lider.nombre}' desactivado"}


# ─── Productos / Áreas ────────────────────────────────────
@router.get("/productos-areas", response_model=List[ProductoAreaOut])
def listar_productos(
    activo: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    sede_id = get_sede_activa(user)
    q = db.query(ProductoArea).filter(ProductoArea.sede_id == sede_id)
    if activo is not None:
        q = q.filter(ProductoArea.activo == activo)
    return q.order_by(ProductoArea.nombre).all()


@router.post("/productos-areas", response_model=ProductoAreaOut)
def crear_producto(
    data: ProductoAreaCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    if db.query(ProductoArea).filter_by(sede_id=sede_id, nombre=data.nombre).first():
        raise HTTPException(400, f"Producto/Área '{data.nombre}' ya existe")
    prod = ProductoArea(**data.model_dump(), sede_id=sede_id)
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod


@router.delete("/productos-areas/{id}")
def desactivar_producto(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    prod = db.query(ProductoArea).filter_by(id=id, sede_id=sede_id).first()
    if not prod:
        raise HTTPException(404, "Producto/Área no encontrado")
    prod.activo = False
    db.commit()
    return {"mensaje": f"'{prod.nombre}' desactivado"}


# ─── Tipos de Bonificación ────────────────────────────────
@router.get("/tipos-bonificacion", response_model=List[TipoBonificacionOut])
def listar_tipos(
    activo: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    sede_id = get_sede_activa(user)
    q = db.query(TipoBonificacion).filter(TipoBonificacion.sede_id == sede_id)
    if activo is not None:
        q = q.filter(TipoBonificacion.activo == activo)
    return q.order_by(TipoBonificacion.nombre).all()


@router.post("/tipos-bonificacion", response_model=TipoBonificacionOut)
def crear_tipo(
    data: TipoBonificacionCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    if db.query(TipoBonificacion).filter_by(sede_id=sede_id, nombre=data.nombre).first():
        raise HTTPException(400, f"Tipo '{data.nombre}' ya existe")
    tipo = TipoBonificacion(**data.model_dump(), sede_id=sede_id)
    db.add(tipo)
    db.commit()
    db.refresh(tipo)
    return tipo


@router.delete("/tipos-bonificacion/{id}")
def desactivar_tipo(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    tipo = db.query(TipoBonificacion).filter_by(id=id, sede_id=sede_id).first()
    if not tipo:
        raise HTTPException(404, "Tipo no encontrado")
    tipo.activo = False
    db.commit()
    return {"mensaje": f"Tipo '{tipo.nombre}' desactivado"}


# ─── Curva de Calidad ─────────────────────────────────────

def _reglas_a_out(rows: list, es_defecto: bool) -> list[dict]:
    """Convierte filas ordenadas de ConfigCurvaCalidad en lista con pct_hasta calculado."""
    resultado = []
    for i, r in enumerate(rows):
        hasta = rows[i + 1]["pct_calidad"] - 1 if i < len(rows) - 1 else 100
        resultado.append({
            "id": r.get("id"),
            "pct_calidad": r["pct_calidad"],
            "pct_hasta": hasta,
            "multiplicador": r["multiplicador"],
        })
    return resultado


def _cargar_reglas_labor(labor_id: int, sede_id: int, db: Session) -> tuple[list, bool]:
    """Retorna (reglas_dict_list, es_defecto). Si no hay config, devuelve la curva por defecto."""
    rows = (
        db.query(ConfigCurvaCalidad)
        .filter_by(labor_id=labor_id, sede_id=sede_id)
        .order_by(ConfigCurvaCalidad.pct_calidad)
        .all()
    )
    if rows:
        return [{"id": r.id, "pct_calidad": r.pct_calidad, "multiplicador": r.multiplicador} for r in rows], False
    return [dict(r) for r in CURVA_CALIDAD_DEFAULT], True


def _validar_reglas(reglas: list) -> str | None:
    """Retorna mensaje de error o None si las reglas son válidas."""
    if not reglas:
        return "Debe haber al menos un tramo"
    sorted_r = sorted(reglas, key=lambda r: r.pct_calidad)
    if sorted_r[0].pct_calidad != 0:
        return "El primer tramo debe comenzar en 0%"
    vistos = set()
    for r in sorted_r:
        if r.pct_calidad in vistos:
            return f"Hay puntos de calidad duplicados ({r.pct_calidad}%)"
        vistos.add(r.pct_calidad)
    return None


@router.get("/curva-calidad", response_model=List[CurvaCalidadOut])
def listar_labores_curva(
    buscar: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    q = db.query(LaborRendimiento).filter_by(sede_id=sede_id, activo=True)
    if buscar:
        q = q.filter(LaborRendimiento.nombre.ilike(f"%{buscar}%"))
    labores = q.order_by(LaborRendimiento.nombre).all()

    ids_con_config = {
        r.labor_id
        for r in db.query(ConfigCurvaCalidad.labor_id)
        .filter_by(sede_id=sede_id)
        .distinct()
        .all()
    }

    resultado = []
    for labor in labores:
        reglas_raw, es_defecto = _cargar_reglas_labor(labor.id, sede_id, db)
        resultado.append(CurvaCalidadOut(
            labor_id=labor.id,
            labor_nombre=labor.nombre,
            lider_nombre=labor.lider_nombre,
            es_defecto=labor.id not in ids_con_config,
            reglas=_reglas_a_out(reglas_raw, es_defecto),
        ))
    return resultado


# IMPORTANTE: /bulk debe ir ANTES de /{labor_id} para que FastAPI no lo trate como ID
@router.put("/curva-calidad/bulk")
def guardar_curva_bulk(
    data: GuardarCurvaBulkIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    error = _validar_reglas(data.reglas)
    if error:
        raise HTTPException(400, error)

    for labor_id in data.labor_ids:
        labor = db.query(LaborRendimiento).filter_by(id=labor_id, sede_id=sede_id).first()
        if not labor:
            raise HTTPException(404, f"Labor {labor_id} no encontrada")
        db.query(ConfigCurvaCalidad).filter_by(labor_id=labor_id, sede_id=sede_id).delete()
        for r in data.reglas:
            db.add(ConfigCurvaCalidad(
                sede_id=sede_id, labor_id=labor_id,
                pct_calidad=r.pct_calidad, multiplicador=r.multiplicador,
            ))
    db.commit()
    return {"mensaje": f"Curva actualizada para {len(data.labor_ids)} labores"}


@router.get("/curva-calidad/{labor_id}", response_model=CurvaCalidadOut)
def obtener_curva_labor(
    labor_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    labor = db.query(LaborRendimiento).filter_by(id=labor_id, sede_id=sede_id).first()
    if not labor:
        raise HTTPException(404, "Labor no encontrada")
    reglas_raw, es_defecto = _cargar_reglas_labor(labor_id, sede_id, db)
    return CurvaCalidadOut(
        labor_id=labor.id,
        labor_nombre=labor.nombre,
        lider_nombre=labor.lider_nombre,
        es_defecto=es_defecto,
        reglas=_reglas_a_out(reglas_raw, es_defecto),
    )


@router.put("/curva-calidad/{labor_id}", response_model=CurvaCalidadOut)
def guardar_curva_labor(
    labor_id: int,
    data: GuardarCurvaIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    labor = db.query(LaborRendimiento).filter_by(id=labor_id, sede_id=sede_id).first()
    if not labor:
        raise HTTPException(404, "Labor no encontrada")
    error = _validar_reglas(data.reglas)
    if error:
        raise HTTPException(400, error)

    db.query(ConfigCurvaCalidad).filter_by(labor_id=labor_id, sede_id=sede_id).delete()
    for r in data.reglas:
        db.add(ConfigCurvaCalidad(
            sede_id=sede_id, labor_id=labor_id,
            pct_calidad=r.pct_calidad, multiplicador=r.multiplicador,
        ))
    db.commit()

    reglas_raw, es_defecto = _cargar_reglas_labor(labor_id, sede_id, db)
    return CurvaCalidadOut(
        labor_id=labor.id,
        labor_nombre=labor.nombre,
        lider_nombre=labor.lider_nombre,
        es_defecto=es_defecto,
        reglas=_reglas_a_out(reglas_raw, es_defecto),
    )


@router.delete("/curva-calidad/{labor_id}")
def restaurar_curva_defecto(
    labor_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("editar_catalogos")),
):
    sede_id = get_sede_activa(user)
    labor = db.query(LaborRendimiento).filter_by(id=labor_id, sede_id=sede_id).first()
    if not labor:
        raise HTTPException(404, "Labor no encontrada")
    eliminadas = db.query(ConfigCurvaCalidad).filter_by(labor_id=labor_id, sede_id=sede_id).delete()
    db.commit()
    return {"mensaje": f"Curva de '{labor.nombre}' restaurada al valor por defecto", "eliminadas": eliminadas}
