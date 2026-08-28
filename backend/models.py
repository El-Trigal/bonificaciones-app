"""Modelos SQLAlchemy — esquema completo de la base de datos."""

from datetime import datetime, date, time
from sqlalchemy import (
    Column, Integer, Float, Text, Boolean, Date, Time,
    DateTime, ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from database import Base


class Sede(Base):
    """Fincas/sedes de la empresa. Unidad de aislamiento multi-tenant."""
    __tablename__ = "sedes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(Text, unique=True, nullable=False)
    codigo = Column(Text, unique=True, nullable=False)  # MAN | CAR | OLA | AGC
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    usuarios = relationship("Usuario", back_populates="sede")


class Empleado(Base):
    __tablename__ = "empleados"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    codigo = Column(Integer, nullable=False, index=True)
    nombre = Column(Text, nullable=False)
    cargo = Column(Text)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("sede_id", "codigo", name="uq_empleado_sede_codigo"),
    )


class Lider(Base):
    __tablename__ = "lideres"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    nombre = Column(Text, nullable=False)
    activo = Column(Boolean, default=True)

    labores = relationship("LaborRendimiento", back_populates="lider_rel")

    __table_args__ = (
        UniqueConstraint("sede_id", "nombre", name="uq_lider_sede_nombre"),
    )


class ProductoArea(Base):
    __tablename__ = "productos_areas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    nombre = Column(Text, nullable=False)
    activo = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("sede_id", "nombre", name="uq_producto_sede_nombre"),
    )


class Semana(Base):
    __tablename__ = "semanas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    codigo = Column(Text, nullable=False, index=True)
    horas_ordinarias = Column(Float, nullable=False)
    tiene_festivo = Column(Boolean, default=False)
    año = Column(Integer, nullable=False)
    fecha_inicio = Column(Date, nullable=True)
    fecha_cierre = Column(Date, nullable=True)
    periodo_nomina_id = Column(Integer, ForeignKey("periodos_nomina.id"), nullable=True)

    periodo_nomina = relationship("PeriodoNomina", back_populates="semanas")

    __table_args__ = (
        UniqueConstraint("sede_id", "codigo", name="uq_semana_sede_codigo"),
    )


class LaborRendimiento(Base):
    __tablename__ = "labores_rendimiento"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    nombre = Column(Text, nullable=False)
    lider_id = Column(Integer, ForeignKey("lideres.id"), nullable=True)
    rendimiento_min_hora = Column(Float, nullable=False)
    tallos_por_ramo = Column(Integer, default=1)
    salario_base = Column(Float, default=1423500)
    tarifa_he_ordinaria = Column(Float, default=7736)
    tarifa_he_dominical = Column(Float, default=12378)
    semanas_mes_promedio = Column(Float, default=4.33)
    pct_a_pagar_colaboradores = Column(Float, default=0.60)
    pct_cortadores = Column(Float, default=0.86)
    pct_apoyo = Column(Float, default=0.14)
    activo = Column(Boolean, default=True)
    # Campos calculados
    costo_estandar_tallo = Column(Float)
    costo_estandar_ramo = Column(Float)
    valor_unidad_colaborador = Column(Float)
    valor_unidad_apoyo = Column(Float)

    lider_rel = relationship("Lider", back_populates="labores")

    @property
    def lider_nombre(self) -> str | None:
        return self.lider_rel.nombre if self.lider_rel else None

    def recalcular_valores(self):
        horas_semana = 43.5
        self.costo_estandar_tallo = self.salario_base / (
            self.semanas_mes_promedio * horas_semana * self.rendimiento_min_hora
        )
        self.costo_estandar_ramo = self.costo_estandar_tallo * self.tallos_por_ramo
        self.valor_unidad_colaborador = (
            self.costo_estandar_ramo * self.pct_a_pagar_colaboradores * self.pct_cortadores
        )
        self.valor_unidad_apoyo = (
            self.costo_estandar_ramo * self.pct_a_pagar_colaboradores * self.pct_apoyo
        )

    __table_args__ = (
        UniqueConstraint("sede_id", "nombre", name="uq_labor_sede_nombre"),
    )


class TipoBonificacion(Base):
    __tablename__ = "tipos_bonificacion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    nombre = Column(Text, nullable=False)
    activo = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("sede_id", "nombre", name="uq_tipo_bonif_sede_nombre"),
    )


class CargaCsv(Base):
    __tablename__ = "cargas_csv"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    nombre_archivo = Column(Text, nullable=False)
    tipo = Column(Text, nullable=False)  # RENDIMIENTO | LABOR_ESPECIFICA
    cargado_por = Column(Text, nullable=False)
    fecha_carga = Column(DateTime, default=datetime.utcnow)
    total_filas = Column(Integer, nullable=False)
    filas_ok = Column(Integer, nullable=False)
    filas_error = Column(Integer, nullable=False)
    detalle_errores = Column(Text)  # JSON
    archivo_path = Column(Text)


class RegistroRendimiento(Base):
    __tablename__ = "registros_rendimiento"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    carga_id = Column(Integer, ForeignKey("cargas_csv.id"))
    fecha_reporte = Column(Date, nullable=False)
    semana = Column(Text, nullable=False)
    lider = Column(Text, nullable=False)
    labor = Column(Text, nullable=False)
    codigo_colaborador = Column(Integer, nullable=False)
    nombre_colaborador = Column(Text, nullable=False)
    pct_calificacion_colaborador = Column(Float, default=1.0)
    pct_calidad = Column(Float)
    # Producción diaria: 7 días × 3 campos
    dom_ramos = Column(Float, default=0)
    dom_hs_ord = Column(Float, default=0)
    dom_hs_extra = Column(Float, default=0)
    lun_ramos = Column(Float, default=0)
    lun_hs_ord = Column(Float, default=0)
    lun_hs_extra = Column(Float, default=0)
    mar_ramos = Column(Float, default=0)
    mar_hs_ord = Column(Float, default=0)
    mar_hs_extra = Column(Float, default=0)
    mie_ramos = Column(Float, default=0)
    mie_hs_ord = Column(Float, default=0)
    mie_hs_extra = Column(Float, default=0)
    jue_ramos = Column(Float, default=0)
    jue_hs_ord = Column(Float, default=0)
    jue_hs_extra = Column(Float, default=0)
    vie_ramos = Column(Float, default=0)
    vie_hs_ord = Column(Float, default=0)
    vie_hs_extra = Column(Float, default=0)
    sab_ramos = Column(Float, default=0)
    sab_hs_ord = Column(Float, default=0)
    sab_hs_extra = Column(Float, default=0)
    # Horas extras
    total_unidades_he = Column(Float, default=0)
    hs_extras_ordinarias = Column(Float, default=0)
    total_unidades_dominical = Column(Float, default=0)
    hs_dominicales = Column(Float, default=0)
    # Tarea
    lun_unid_tarea = Column(Float, default=0)
    lun_hs_tarea = Column(Float, default=0)
    mar_unid_tarea = Column(Float, default=0)
    mar_hs_tarea = Column(Float, default=0)
    mie_unid_tarea = Column(Float, default=0)
    mie_hs_tarea = Column(Float, default=0)
    jue_unid_tarea = Column(Float, default=0)
    jue_hs_tarea = Column(Float, default=0)
    vie_unid_tarea = Column(Float, default=0)
    vie_hs_tarea = Column(Float, default=0)
    sab_unid_tarea = Column(Float, default=0)
    sab_hs_tarea = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_registros_rendimiento_semana", "semana"),
        Index("idx_registros_rendimiento_colaborador", "codigo_colaborador"),
        Index("idx_registros_rendimiento_sede", "sede_id"),
    )


class RegistroLaborEspecifica(Base):
    __tablename__ = "registros_labor_especifica"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    carga_id = Column(Integer, ForeignKey("cargas_csv.id"))
    fecha_reporte = Column(Date, nullable=False)
    semana = Column(Text, nullable=False)
    lider = Column(Text, nullable=False)
    producto_area = Column(Text, nullable=False)
    tipo_bonificacion = Column(Text, nullable=False)
    labor = Column(Text, nullable=False)
    asociada_a = Column(Text)
    codigo_colaborador = Column(Integer, nullable=False)
    nombre_colaborador = Column(Text, nullable=False)
    pct_calificacion_colaborador = Column(Float, default=1.0)
    fecha_inicial = Column(Date, nullable=True)
    fecha_final = Column(Date, nullable=True)
    hora_inicial = Column(Text, nullable=True)
    hora_final = Column(Text, nullable=True)
    unidades_adicionales = Column(Float, nullable=True)
    total_bonificacion_manual = Column(Float, nullable=True)
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Liquidacion(Base):
    __tablename__ = "liquidaciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    semana = Column(Text, nullable=False)
    fecha_reporte = Column(Date)
    codigo_colaborador = Column(Integer, nullable=False)
    nombre_colaborador = Column(Text, nullable=False)
    lider = Column(Text)
    labor = Column(Text)
    tipo_bonificacion = Column(Text, nullable=False)
    # Montos
    bonif_rendimiento = Column(Float, default=0)
    bonif_he_ordinaria = Column(Float, default=0)
    bonif_he_dominical = Column(Float, default=0)
    bonif_tarea = Column(Float, default=0)
    bonif_labor_especifica = Column(Float, default=0)
    bonif_apoyo = Column(Float, default=0)
    bonif_auxilio = Column(Float, default=0)
    bonif_constitutiva = Column(Float, default=0)
    total_bonificacion = Column(Float, default=0)
    # Elegibilidad
    cumple_minimo_horas = Column(Boolean)
    cumple_minimo_calidad = Column(Boolean)
    pct_calidad = Column(Float)
    pct_bonificacion_calidad = Column(Float)
    horas_ordinarias_laboradas = Column(Float)
    horas_requeridas_83pct = Column(Float)
    unidades_requeridas = Column(Float)
    unidades_ejecutadas = Column(Float)
    unidades_adicionales = Column(Float)
    # JSON narrativo para modal de trazabilidad
    detalle_calculo_narrativo = Column(Text, nullable=False)
    # Referencias
    registro_rendimiento_id = Column(Integer, ForeignKey("registros_rendimiento.id"))
    registro_labor_id = Column(Integer, ForeignKey("registros_labor_especifica.id"))
    carga_rendimiento_id = Column(Integer, ForeignKey("cargas_csv.id"))
    carga_labor_id = Column(Integer, ForeignKey("cargas_csv.id"))
    calculado_en = Column(DateTime, default=datetime.utcnow)

    pasos = relationship("PasoCalculo", back_populates="liquidacion", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("sede_id", "semana", "codigo_colaborador", "labor", "tipo_bonificacion",
                         name="uq_liquidacion_registro"),
        Index("idx_liquidaciones_semana", "semana"),
        Index("idx_liquidaciones_colaborador", "codigo_colaborador"),
        Index("idx_liquidaciones_lider", "lider"),
        Index("idx_liquidaciones_labor", "labor"),
        Index("idx_liquidaciones_sede", "sede_id"),
    )


class PasoCalculo(Base):
    __tablename__ = "pasos_calculo"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    liquidacion_id = Column(Integer, ForeignKey("liquidaciones.id", ondelete="CASCADE"), nullable=False)
    semana = Column(Text, nullable=False)
    codigo_colaborador = Column(Integer, nullable=False)
    lider = Column(Text)
    labor = Column(Text)
    # Paso 1: Producción semanal
    total_ramos = Column(Float)
    total_hs_ordinarias = Column(Float)
    total_hs_extra = Column(Float)
    total_horas = Column(Float)
    # Paso 2: Verificación mínimo de horas
    horas_semana_configuradas = Column(Float)
    umbral_83pct = Column(Float)
    horas_laboradas = Column(Float)
    cumple_horas = Column(Boolean)
    # Paso 3: Calidad
    pct_calidad_ingresado = Column(Float)
    multiplicador_calidad = Column(Float)
    cumple_calidad = Column(Boolean)
    # Paso 4: Unidades
    rendimiento_min_hora = Column(Float)
    unidades_requeridas = Column(Float)
    unidades_ejecutadas = Column(Float)
    unidades_adicionales = Column(Float)
    supero_minimo = Column(Boolean)
    # Paso 5: Bonificación rendimiento
    valor_unidad_colaborador = Column(Float)
    pct_calificacion_colaborador = Column(Float)
    bonif_rendimiento_bruta = Column(Float)
    bonif_rendimiento_final = Column(Float)
    # Paso 6: Bonificaciones adicionales
    hs_extras_ordinarias = Column(Float)
    tarifa_he_ordinaria = Column(Float)
    bonif_he_ordinaria = Column(Float)
    hs_dominicales = Column(Float)
    tarifa_he_dominical = Column(Float)
    bonif_he_dominical = Column(Float)
    hs_tarea = Column(Float)
    bonif_tarea = Column(Float)
    # Paso 7: Total
    total_bonificacion = Column(Float)
    # Labor específica y apoyo
    monto_manual = Column(Float)
    tipo_calculo = Column(Text)
    motivo_sin_bonificacion = Column(Text)
    calculado_en = Column(DateTime, default=datetime.utcnow)

    liquidacion = relationship("Liquidacion", back_populates="pasos")

    __table_args__ = (
        Index("idx_pasos_semana", "semana"),
        Index("idx_pasos_colaborador", "codigo_colaborador"),
        Index("idx_pasos_lider", "lider"),
        Index("idx_pasos_labor", "labor"),
        Index("idx_pasos_cumple_horas", "cumple_horas"),
        Index("idx_pasos_cumple_calidad", "cumple_calidad"),
        Index("idx_pasos_supero_minimo", "supero_minimo"),
        Index("idx_pasos_motivo", "motivo_sin_bonificacion"),
        Index("idx_pasos_sede", "sede_id"),
    )


class PeriodoNomina(Base):
    """Periodo quincenal de nómina colombiana (Q1: 1-15, Q2: 16-fin de mes)."""
    __tablename__ = "periodos_nomina"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    codigo = Column(Text, nullable=False, index=True)  # ej. 2026-04-Q2
    año = Column(Integer, nullable=False)
    mes = Column(Integer, nullable=False)
    quincena = Column(Integer, nullable=False)  # 1 o 2
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    fecha_pago = Column(Date, nullable=False)
    estado = Column(Text, default="ABIERTO")  # ABIERTO | CERRADO | PAGADO
    cerrado_por = Column(Text, nullable=True)
    cerrado_en = Column(DateTime, nullable=True)
    pagado_por = Column(Text, nullable=True)
    pagado_en = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    semanas = relationship("Semana", back_populates="periodo_nomina")

    __table_args__ = (
        UniqueConstraint("sede_id", "codigo", name="uq_periodo_sede_codigo"),
    )


class PlantillaCarga(Base):
    """Plantilla configurable por labor para parsear archivos Excel/CSV."""
    __tablename__ = "plantillas_carga"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    nombre = Column(Text, nullable=False)
    tipo = Column(Text, nullable=False)  # RENDIMIENTO_DIARIO | CALIDAD | HE_DOMINICAL
    labor_id = Column(Integer, ForeignKey("labores_rendimiento.id"), nullable=True)
    configuracion = Column(Text, nullable=False)  # JSON: mapeo de columnas, tipo unidad, etc.
    unidad_origen = Column(Text, default="TALLOS")  # TALLOS | RAMOS
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("sede_id", "nombre", name="uq_plantilla_sede_nombre"),
    )


class RegistroDiario(Base):
    """Registro granular por colaborador/labor/día. Se consolida en semana."""
    __tablename__ = "registros_diarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    carga_id = Column(Integer, ForeignKey("cargas_csv.id"), nullable=True)
    fecha = Column(Date, nullable=False, index=True)
    semana = Column(Text, nullable=False, index=True)
    codigo_colaborador = Column(Integer, nullable=False, index=True)
    nombre_colaborador = Column(Text, nullable=False)
    labor = Column(Text, nullable=False)
    lider = Column(Text, nullable=False)
    # Producción (tallos se convierte a ramos vía tallos_por_ramo)
    tallos = Column(Float, default=0)
    ramos = Column(Float, default=0)
    horas_ordinarias = Column(Float, default=0)
    horas_extra_ordinarias = Column(Float, default=0)
    horas_dominicales = Column(Float, default=0)
    unidades_tarea = Column(Float, default=0)
    horas_tarea = Column(Float, default=0)
    origen = Column(Text, default="CARGA")  # CARGA | MANUAL
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("sede_id", "fecha", "codigo_colaborador", "labor", name="uq_diario"),
        Index("idx_diarios_semana_cod", "semana", "codigo_colaborador"),
        Index("idx_diarios_sede", "sede_id"),
    )


class RegistroCalidad(Base):
    """% de calidad semanal por colaborador/labor (carga o manual)."""
    __tablename__ = "registros_calidad"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    carga_id = Column(Integer, ForeignKey("cargas_csv.id"), nullable=True)
    semana = Column(Text, nullable=False, index=True)
    codigo_colaborador = Column(Integer, nullable=False, index=True)
    labor = Column(Text, nullable=False)
    pct_calidad = Column(Float, nullable=False)
    origen = Column(Text, default="MANUAL")  # CARGA | MANUAL
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("sede_id", "semana", "codigo_colaborador", "labor", name="uq_calidad"),
    )


class AjusteRetroactivo(Base):
    """Ajuste a aplicar en un periodo posterior cuando se recalcula una semana ya PAGADA."""
    __tablename__ = "ajustes_retroactivos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=False, index=True)
    semana_original = Column(Text, nullable=False, index=True)
    periodo_origen_id = Column(Integer, ForeignKey("periodos_nomina.id"), nullable=False)
    periodo_destino_id = Column(Integer, ForeignKey("periodos_nomina.id"), nullable=False)
    codigo_colaborador = Column(Integer, nullable=False, index=True)
    nombre_colaborador = Column(Text, nullable=False)
    labor = Column(Text, nullable=False)
    tipo_bonificacion = Column(Text, nullable=False)
    monto_anterior = Column(Float, nullable=False, default=0)
    monto_nuevo = Column(Float, nullable=False, default=0)
    diferencia = Column(Float, nullable=False, default=0)
    motivo = Column(Text)
    estado = Column(Text, default="PENDIENTE")  # PENDIENTE | APROBADO | RECHAZADO
    creado_por = Column(Text, nullable=False)
    creado_en = Column(DateTime, default=datetime.utcnow)
    aprobado_por = Column(Text, nullable=True)
    aprobado_en = Column(DateTime, nullable=True)


class Usuario(Base):
    """Usuarios del sistema con roles y sede asignada."""
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(Text, unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    nombre_completo = Column(Text, nullable=False)
    email = Column(Text, nullable=True)
    rol = Column(Text, nullable=False)  # SUPER_ADMIN | ADMIN | AUXILIAR | NOMINA | OPERARIO
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=True)  # NULL = SUPER_ADMIN
    activo = Column(Boolean, default=True)
    ultimo_login = Column(DateTime, nullable=True)
    intentos_fallidos = Column(Integer, default=0)
    bloqueado_hasta = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sede = relationship("Sede", back_populates="usuarios")
