"""Schemas Pydantic v2 para validación de datos."""

from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import date, datetime


# ─── Empleados ───────────────────────────────────────────
class EmpleadoBase(BaseModel):
    codigo: int
    nombre: str
    cargo: Optional[str] = None
    activo: bool = True

class EmpleadoCreate(EmpleadoBase):
    pass

class EmpleadoUpdate(BaseModel):
    nombre: Optional[str] = None
    cargo: Optional[str] = None
    activo: Optional[bool] = None

class EmpleadoOut(EmpleadoBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ─── Líderes ─────────────────────────────────────────────
class LiderBase(BaseModel):
    nombre: str
    activo: bool = True

class LiderCreate(LiderBase):
    pass

class LiderOut(LiderBase):
    id: int
    model_config = {"from_attributes": True}


# ─── Productos / Áreas ──────────────────────────────────
class ProductoAreaBase(BaseModel):
    nombre: str
    activo: bool = True

class ProductoAreaCreate(ProductoAreaBase):
    pass

class ProductoAreaOut(ProductoAreaBase):
    id: int
    model_config = {"from_attributes": True}


# ─── Semanas ─────────────────────────────────────────────
class SemanaBase(BaseModel):
    codigo: str
    horas_ordinarias: float
    tiene_festivo: bool = False
    año: int

class SemanaCreate(SemanaBase):
    pass

class SemanaUpdate(BaseModel):
    horas_ordinarias: Optional[float] = None
    tiene_festivo: Optional[bool] = None

class SemanaOut(SemanaBase):
    id: int
    model_config = {"from_attributes": True}


# ─── Labores de Rendimiento ─────────────────────────────
class LaborRendimientoBase(BaseModel):
    nombre: str
    lider_id: Optional[int] = None
    rendimiento_min_hora: float
    tallos_por_ramo: int = 1
    salario_base: float = 1423500
    tarifa_he_ordinaria: float = 7736
    tarifa_he_dominical: float = 12378
    semanas_mes_promedio: float = 4.33
    pct_a_pagar_colaboradores: float = 0.60
    pct_cortadores: float = 0.86
    pct_apoyo: float = 0.14
    activo: bool = True

class LaborRendimientoCreate(LaborRendimientoBase):
    pass

class LaborRendimientoUpdate(BaseModel):
    nombre: Optional[str] = None
    lider_id: Optional[int] = None
    rendimiento_min_hora: Optional[float] = None
    tallos_por_ramo: Optional[int] = None
    salario_base: Optional[float] = None
    tarifa_he_ordinaria: Optional[float] = None
    tarifa_he_dominical: Optional[float] = None
    semanas_mes_promedio: Optional[float] = None
    pct_a_pagar_colaboradores: Optional[float] = None
    pct_cortadores: Optional[float] = None
    pct_apoyo: Optional[float] = None
    activo: Optional[bool] = None

class LaborRendimientoOut(LaborRendimientoBase):
    id: int
    lider_nombre: Optional[str] = None
    costo_estandar_tallo: Optional[float] = None
    costo_estandar_ramo: Optional[float] = None
    valor_unidad_colaborador: Optional[float] = None
    valor_unidad_apoyo: Optional[float] = None
    model_config = {"from_attributes": True}


# ─── Tipos de Bonificación ──────────────────────────────
class TipoBonificacionBase(BaseModel):
    nombre: str
    activo: bool = True

class TipoBonificacionCreate(TipoBonificacionBase):
    pass

class TipoBonificacionOut(TipoBonificacionBase):
    id: int
    model_config = {"from_attributes": True}


# ─── Cargas CSV ──────────────────────────────────────────
class CargaCsvOut(BaseModel):
    id: int
    nombre_archivo: str
    tipo: str
    cargado_por: str
    fecha_carga: Optional[datetime] = None
    total_filas: int
    filas_ok: int
    filas_error: int
    detalle_errores: Optional[str] = None
    model_config = {"from_attributes": True}


# ─── Validación CSV ──────────────────────────────────────
class ErrorValidacion(BaseModel):
    fila: int
    nivel: str  # ERROR | WARNING
    campo: str
    valor: Optional[str] = None
    mensaje: str

class ResultadoValidacion(BaseModel):
    total_filas: int
    filas_ok: int
    filas_error: int
    errores: List[ErrorValidacion] = []
    advertencias: List[ErrorValidacion] = []
    preview: List[dict] = []


# ─── Liquidaciones ───────────────────────────────────────
class LiquidacionOut(BaseModel):
    id: int
    semana: str
    fecha_reporte: Optional[date] = None
    codigo_colaborador: int
    nombre_colaborador: str
    lider: Optional[str] = None
    labor: Optional[str] = None
    tipo_bonificacion: str
    bonif_rendimiento: float = 0
    bonif_he_ordinaria: float = 0
    bonif_he_dominical: float = 0
    bonif_tarea: float = 0
    bonif_labor_especifica: float = 0
    bonif_apoyo: float = 0
    bonif_auxilio: float = 0
    bonif_constitutiva: float = 0
    total_bonificacion: float = 0
    cumple_minimo_horas: Optional[bool] = None
    cumple_minimo_calidad: Optional[bool] = None
    pct_calidad: Optional[float] = None
    calculado_en: Optional[datetime] = None
    model_config = {"from_attributes": True}

class LiquidacionDetalle(LiquidacionOut):
    detalle_calculo_narrativo: str
    horas_ordinarias_laboradas: Optional[float] = None
    horas_requeridas_83pct: Optional[float] = None
    unidades_requeridas: Optional[float] = None
    unidades_ejecutadas: Optional[float] = None
    unidades_adicionales: Optional[float] = None

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    pages: int


# ─── Dashboard ───────────────────────────────────────────
class ResumenDashboard(BaseModel):
    total_a_pagar: float
    colaboradores_con_bonificacion: int
    registros_cargados: int
    sin_bonificacion: int
    resumen_por_tipo: dict
    resumen_por_lider: List[dict]
