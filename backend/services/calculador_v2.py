"""Motor de cálculo V2: consolida RegistroDiario por colaborador+labor+semana
y reutiliza el motor existente calcular_bonif_rendimiento mediante un objeto shim.
"""

from __future__ import annotations

import json as _json
from datetime import datetime
from types import SimpleNamespace

from sqlalchemy.orm import Session

from models import (
    LaborRendimiento, Liquidacion, PasoCalculo,
    RegistroCalidad, RegistroDiario,
)
from services.calculador import (
    calcular_bonif_rendimiento,
    generar_narrativo_rendimiento,
)
from services.utils_semana import normalizar_codigo_semana


DIA_KEYS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"]


def _dia_key(weekday_mon0: int) -> str:
    mapeo = {6: "dom", 0: "lun", 1: "mar", 2: "mie", 3: "jue", 4: "vie", 5: "sab"}
    return mapeo[weekday_mon0]


def _obtener_calidad(db: Session, semana: str, codigo: int, labor: str, sede_id: int) -> float | None:
    reg = db.query(RegistroCalidad).filter_by(
        sede_id=sede_id, semana=semana, codigo_colaborador=codigo, labor=labor
    ).first()
    return reg.pct_calidad if reg else None


def _consolidar_a_shim(grupos: list[RegistroDiario], db: Session, sede_id: int):
    """Agrupa registros diarios en un objeto con forma de RegistroRendimiento."""
    primero = grupos[0]
    datos = {
        "semana": primero.semana,
        "codigo_colaborador": primero.codigo_colaborador,
        "nombre_colaborador": primero.nombre_colaborador,
        "lider": primero.lider,
        "labor": primero.labor,
        "pct_calificacion_colaborador": 1.0,
        "pct_calidad": _obtener_calidad(db, primero.semana, primero.codigo_colaborador, primero.labor, sede_id),
        "hs_extras_ordinarias": 0.0,
        "hs_dominicales": 0.0,
    }
    for dk in DIA_KEYS:
        datos[f"{dk}_ramos"] = 0.0
        datos[f"{dk}_hs_ord"] = 0.0
        datos[f"{dk}_hs_extra"] = 0.0
        datos[f"{dk}_unid_tarea"] = 0.0
        datos[f"{dk}_hs_tarea"] = 0.0

    for r in grupos:
        dk = _dia_key(r.fecha.weekday())
        datos[f"{dk}_ramos"] += float(r.ramos or 0)
        datos[f"{dk}_hs_ord"] += float(r.horas_ordinarias or 0)
        datos[f"{dk}_hs_extra"] += float(r.horas_extra_ordinarias or 0)
        datos[f"{dk}_unid_tarea"] += float(r.unidades_tarea or 0)
        datos[f"{dk}_hs_tarea"] += float(r.horas_tarea or 0)
        datos["hs_extras_ordinarias"] += float(r.horas_extra_ordinarias or 0)
        datos["hs_dominicales"] += float(r.horas_dominicales or 0)

    return SimpleNamespace(**datos)


def ejecutar_calculo_semana(db: Session, semana: str, usuario: str, sede_id: int) -> dict:
    """Recalcula la semana completa desde RegistroDiario para una sede. Reemplaza liquidaciones previas."""
    semana_norm = normalizar_codigo_semana(semana)

    previas = db.query(Liquidacion).filter_by(semana=semana_norm, sede_id=sede_id).all()
    ids_previas = [l.id for l in previas]
    if ids_previas:
        db.query(PasoCalculo).filter(PasoCalculo.liquidacion_id.in_(ids_previas)).delete(synchronize_session=False)
        for l in previas:
            db.delete(l)
        db.flush()

    registros = db.query(RegistroDiario).filter_by(semana=semana_norm, sede_id=sede_id).all()
    if not registros:
        return {"semana": semana_norm, "procesados": 0, "sin_bonificacion": 0, "total_liquidado": 0}

    grupos: dict[tuple[int, str], list[RegistroDiario]] = {}
    for r in registros:
        grupos.setdefault((r.codigo_colaborador, r.labor), []).append(r)

    labores_cache: dict[str, LaborRendimiento] = {}
    for lab in db.query(LaborRendimiento).filter_by(sede_id=sede_id).all():
        labores_cache[lab.nombre] = lab

    procesados = 0
    sin_bonif = 0
    total_pagado = 0.0

    for (codigo, labor_nombre), regs in grupos.items():
        lab = labores_cache.get(labor_nombre)
        if not lab:
            continue
        shim = _consolidar_a_shim(regs, db, sede_id)
        resultado = calcular_bonif_rendimiento(shim, lab, db)
        narrativo = generar_narrativo_rendimiento(resultado)

        liq = Liquidacion(
            sede_id=sede_id,
            semana=resultado["semana"],
            fecha_reporte=regs[0].fecha,
            codigo_colaborador=resultado["codigo_colaborador"],
            nombre_colaborador=resultado["nombre_colaborador"],
            lider=resultado["lider"],
            labor=resultado["labor"],
            tipo_bonificacion="RENDIMIENTO",
            bonif_rendimiento=resultado["bonif_rendimiento_final"],
            bonif_he_ordinaria=resultado["bonif_he_ordinaria"],
            bonif_he_dominical=resultado["bonif_he_dominical"],
            bonif_tarea=resultado["bonif_tarea"],
            total_bonificacion=resultado["total_bonificacion"],
            cumple_minimo_horas=resultado["cumple_horas"],
            cumple_minimo_calidad=resultado["cumple_calidad"],
            pct_calidad=resultado["pct_calidad_ingresado"],
            pct_bonificacion_calidad=resultado["multiplicador_calidad"],
            horas_ordinarias_laboradas=resultado["horas_laboradas"],
            horas_requeridas_83pct=resultado["umbral_83pct"],
            unidades_requeridas=resultado["unidades_requeridas"],
            unidades_ejecutadas=resultado["unidades_ejecutadas"],
            unidades_adicionales=resultado["unidades_adicionales"],
            detalle_calculo_narrativo=_json.dumps(narrativo, ensure_ascii=False),
            calculado_en=datetime.utcnow(),
        )
        db.add(liq)
        db.flush()

        paso = PasoCalculo(
            sede_id=sede_id,
            liquidacion_id=liq.id,
            semana=resultado["semana"],
            codigo_colaborador=resultado["codigo_colaborador"],
            lider=resultado["lider"],
            labor=resultado["labor"],
            total_ramos=resultado["total_ramos"],
            total_hs_ordinarias=resultado["total_hs_ordinarias"],
            total_hs_extra=resultado["total_hs_extra"],
            total_horas=resultado["total_horas"],
            horas_semana_configuradas=resultado["horas_semana_configuradas"],
            umbral_83pct=resultado["umbral_83pct"],
            horas_laboradas=resultado["horas_laboradas"],
            cumple_horas=resultado["cumple_horas"],
            pct_calidad_ingresado=resultado["pct_calidad_ingresado"],
            multiplicador_calidad=resultado["multiplicador_calidad"],
            cumple_calidad=resultado["cumple_calidad"],
            rendimiento_min_hora=resultado["rendimiento_min_hora"],
            unidades_requeridas=resultado["unidades_requeridas"],
            unidades_ejecutadas=resultado["unidades_ejecutadas"],
            unidades_adicionales=resultado["unidades_adicionales"],
            supero_minimo=resultado["supero_minimo"],
            valor_unidad_colaborador=resultado["valor_unidad_colaborador"],
            pct_calificacion_colaborador=resultado["pct_calificacion_colaborador"],
            bonif_rendimiento_bruta=resultado["bonif_rendimiento_bruta"],
            bonif_rendimiento_final=resultado["bonif_rendimiento_final"],
            hs_extras_ordinarias=resultado["hs_extras_ordinarias"],
            tarifa_he_ordinaria=resultado["tarifa_he_ordinaria"],
            bonif_he_ordinaria=resultado["bonif_he_ordinaria"],
            hs_dominicales=resultado["hs_dominicales"],
            tarifa_he_dominical=resultado["tarifa_he_dominical"],
            bonif_he_dominical=resultado["bonif_he_dominical"],
            hs_tarea=resultado["hs_tarea"],
            bonif_tarea=resultado["bonif_tarea"],
            total_bonificacion=resultado["total_bonificacion"],
            tipo_calculo="RENDIMIENTO",
            motivo_sin_bonificacion=resultado["motivo_sin_bonificacion"],
        )
        db.add(paso)
        procesados += 1
        total_pagado += resultado["total_bonificacion"]
        if resultado["total_bonificacion"] == 0:
            sin_bonif += 1

    db.commit()
    return {
        "semana": semana_norm,
        "procesados": procesados,
        "sin_bonificacion": sin_bonif,
        "total_liquidado": total_pagado,
        "ejecutado_por": usuario,
        "ejecutado_en": datetime.utcnow().isoformat(),
    }
