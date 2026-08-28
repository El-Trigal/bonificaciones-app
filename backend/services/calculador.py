"""Motor de cálculo — replica exactamente la lógica del Excel original."""

import json
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import (
    RegistroRendimiento, RegistroLaborEspecifica, LaborRendimiento,
    Semana, Liquidacion, PasoCalculo
)


def obtener_multiplicador_calidad(pct_calidad: float) -> float:
    """
    Curva de calidad universal — replica la tabla del Excel.
    < 0.81 → 0.0 (sin bonificación)
    0.81-0.89 → escala lineal 0.10 a 0.90
    >= 0.90 → 1.0
    """
    if pct_calidad is None or pct_calidad < 0.81:
        return 0.0
    elif pct_calidad >= 0.90:
        return 1.0
    else:
        return round((pct_calidad - 0.80) * 10, 1)


def verificar_minimo_horas(semana: str, total_hs_ordinarias_semana: float, db: Session):
    """
    Verifica si cumple el 83% de las horas ordinarias de la semana.
    Retorna: (cumple, horas_laboradas, horas_requeridas, horas_configuradas)
    """
    semana_config = db.query(Semana).filter(Semana.codigo == semana).first()
    if not semana_config:
        return False, total_hs_ordinarias_semana, 0, 0

    horas_configuradas = semana_config.horas_ordinarias
    horas_requeridas = horas_configuradas * 0.83
    cumple = total_hs_ordinarias_semana >= horas_requeridas
    return cumple, total_hs_ordinarias_semana, horas_requeridas, horas_configuradas


def calcular_bonif_rendimiento(registro: RegistroRendimiento, labor: LaborRendimiento, db: Session) -> dict:
    """
    Cálculo completo de bonificación por rendimiento.
    Retorna dict con todos los valores intermedios para trazabilidad.
    """
    # Paso 1: Totales semanales
    total_ramos = sum([
        registro.dom_ramos or 0, registro.lun_ramos or 0, registro.mar_ramos or 0,
        registro.mie_ramos or 0, registro.jue_ramos or 0, registro.vie_ramos or 0,
        registro.sab_ramos or 0
    ])
    total_hs_ord = sum([
        registro.dom_hs_ord or 0, registro.lun_hs_ord or 0, registro.mar_hs_ord or 0,
        registro.mie_hs_ord or 0, registro.jue_hs_ord or 0, registro.vie_hs_ord or 0,
        registro.sab_hs_ord or 0
    ])
    total_hs_extra = sum([
        registro.dom_hs_extra or 0, registro.lun_hs_extra or 0, registro.mar_hs_extra or 0,
        registro.mie_hs_extra or 0, registro.jue_hs_extra or 0, registro.vie_hs_extra or 0,
        registro.sab_hs_extra or 0
    ])
    total_horas = total_hs_ord + total_hs_extra

    # Paso 2: Verificar mínimo de horas (83%)
    cumple_horas, hs_laboradas, hs_requeridas, hs_configuradas = verificar_minimo_horas(
        registro.semana, total_hs_ord, db
    )

    # Paso 3: Multiplicador de calidad
    mult_calidad = obtener_multiplicador_calidad(registro.pct_calidad)
    cumple_calidad = mult_calidad > 0

    # Paso 4: Unidades
    rendimiento_min = labor.rendimiento_min_hora
    unidades_requeridas = total_horas * rendimiento_min
    unidades_ejecutadas = total_ramos
    unidades_adicionales = max(0, unidades_ejecutadas - unidades_requeridas)
    supero_minimo = unidades_adicionales > 0

    # Determinar motivo si no hay bonificación
    motivo = None
    if not cumple_horas:
        motivo = "NO_CUMPLE_HORAS"
    elif not cumple_calidad:
        motivo = "NO_CUMPLE_CALIDAD"
    elif not supero_minimo:
        motivo = "NO_SUPERA_MINIMO"

    # Paso 5-6: Bonificación por rendimiento
    valor_unidad = labor.valor_unidad_colaborador or 0
    pct_calif = registro.pct_calificacion_colaborador or 1.0

    if cumple_horas and cumple_calidad:
        bonif_bruta = unidades_adicionales * valor_unidad
        bonif_final = round(bonif_bruta * mult_calidad * pct_calif, -2)
    else:
        bonif_bruta = 0
        bonif_final = 0

    # Paso 6: Bonificaciones adicionales (HE, dominical, tarea)
    hs_extras = registro.hs_extras_ordinarias or 0
    tarifa_he = labor.tarifa_he_ordinaria
    bonif_he = round(hs_extras * tarifa_he) if hs_extras > 0 else 0

    hs_dom = registro.hs_dominicales or 0
    tarifa_dom = labor.tarifa_he_dominical
    bonif_dom = round(hs_dom * tarifa_dom) if hs_dom > 0 else 0

    # Tarea
    total_hs_tarea = sum([
        registro.lun_hs_tarea or 0, registro.mar_hs_tarea or 0,
        registro.mie_hs_tarea or 0, registro.jue_hs_tarea or 0,
        registro.vie_hs_tarea or 0, registro.sab_hs_tarea or 0,
    ])
    total_unid_tarea = sum([
        registro.lun_unid_tarea or 0, registro.mar_unid_tarea or 0,
        registro.mie_unid_tarea or 0, registro.jue_unid_tarea or 0,
        registro.vie_unid_tarea or 0, registro.sab_unid_tarea or 0,
    ])
    # Verificar que el rendimiento de tarea cumple mínimo
    bonif_tarea = 0
    if total_hs_tarea > 0:
        rendimiento_tarea = total_unid_tarea / total_hs_tarea if total_hs_tarea > 0 else 0
        if rendimiento_tarea >= rendimiento_min:
            bonif_tarea = round(total_hs_tarea * tarifa_he)

    total = bonif_final + bonif_he + bonif_dom + bonif_tarea

    resultado = {
        "semana": registro.semana,
        "codigo_colaborador": registro.codigo_colaborador,
        "nombre_colaborador": registro.nombre_colaborador,
        "lider": registro.lider,
        "labor": registro.labor,
        "tipo_calculo": "RENDIMIENTO",
        # Paso 1
        "total_ramos": total_ramos,
        "total_hs_ordinarias": total_hs_ord,
        "total_hs_extra": total_hs_extra,
        "total_horas": total_horas,
        # Paso 2
        "horas_semana_configuradas": hs_configuradas,
        "umbral_83pct": hs_requeridas,
        "horas_laboradas": hs_laboradas,
        "cumple_horas": cumple_horas,
        # Paso 3
        "pct_calidad_ingresado": registro.pct_calidad,
        "multiplicador_calidad": mult_calidad,
        "cumple_calidad": cumple_calidad,
        # Paso 4
        "rendimiento_min_hora": rendimiento_min,
        "unidades_requeridas": unidades_requeridas,
        "unidades_ejecutadas": unidades_ejecutadas,
        "unidades_adicionales": unidades_adicionales,
        "supero_minimo": supero_minimo,
        # Paso 5
        "valor_unidad_colaborador": valor_unidad,
        "pct_calificacion_colaborador": pct_calif,
        "bonif_rendimiento_bruta": bonif_bruta,
        "bonif_rendimiento_final": bonif_final,
        # Paso 6
        "hs_extras_ordinarias": hs_extras,
        "tarifa_he_ordinaria": tarifa_he,
        "bonif_he_ordinaria": bonif_he,
        "hs_dominicales": hs_dom,
        "tarifa_he_dominical": tarifa_dom,
        "bonif_he_dominical": bonif_dom,
        "hs_tarea": total_hs_tarea,
        "bonif_tarea": bonif_tarea,
        # Paso 7
        "total_bonificacion": total,
        "motivo_sin_bonificacion": motivo,
        # Datos para producción diaria (narrativo)
        "produccion_diaria": {
            "dom": {"ramos": registro.dom_ramos or 0, "hs_ord": registro.dom_hs_ord or 0, "hs_extra": registro.dom_hs_extra or 0},
            "lun": {"ramos": registro.lun_ramos or 0, "hs_ord": registro.lun_hs_ord or 0, "hs_extra": registro.lun_hs_extra or 0},
            "mar": {"ramos": registro.mar_ramos or 0, "hs_ord": registro.mar_hs_ord or 0, "hs_extra": registro.mar_hs_extra or 0},
            "mie": {"ramos": registro.mie_ramos or 0, "hs_ord": registro.mie_hs_ord or 0, "hs_extra": registro.mie_hs_extra or 0},
            "jue": {"ramos": registro.jue_ramos or 0, "hs_ord": registro.jue_hs_ord or 0, "hs_extra": registro.jue_hs_extra or 0},
            "vie": {"ramos": registro.vie_ramos or 0, "hs_ord": registro.vie_hs_ord or 0, "hs_extra": registro.vie_hs_extra or 0},
            "sab": {"ramos": registro.sab_ramos or 0, "hs_ord": registro.sab_hs_ord or 0, "hs_extra": registro.sab_hs_extra or 0},
        },
    }
    return resultado


def generar_narrativo_rendimiento(r: dict) -> dict:
    """Genera el JSON narrativo legible para el modal de trazabilidad."""
    prod = r["produccion_diaria"]
    advertencias = []
    if not r["cumple_horas"]:
        advertencias.append(f"No cumple el mínimo de horas: {r['horas_laboradas']:.2f} < {r['umbral_83pct']:.2f}")
    if not r["cumple_calidad"]:
        advertencias.append(f"Calidad por debajo del 81%: {(r['pct_calidad_ingresado'] or 0)*100:.0f}%")
    if r["cumple_horas"] and r["cumple_calidad"] and not r["supero_minimo"]:
        advertencias.append(
            f"No superó el rendimiento mínimo requerido de {r['unidades_requeridas']:.0f} unidades"
        )

    return {
        "version": "1.0",
        "tipo_calculo": "RENDIMIENTO",
        "labor": r["labor"],
        "semana": r["semana"],
        "colaborador": r["nombre_colaborador"],
        "pasos": [
            {
                "paso": 1, "nombre": "Producción semanal",
                "detalle": {
                    **{f"{dia}_ramos": prod[dia]["ramos"] for dia in ["dom","lun","mar","mie","jue","vie","sab"]},
                    "total_ramos": r["total_ramos"],
                    "total_hs_ordinarias": r["total_hs_ordinarias"],
                    "total_hs_extra": r["total_hs_extra"],
                    "total_horas": r["total_horas"],
                }
            },
            {
                "paso": 2, "nombre": "Verificación mínimo de horas (83%)",
                "detalle": {
                    "horas_semana_configuradas": r["horas_semana_configuradas"],
                    "umbral_83pct": r["umbral_83pct"],
                    "horas_laboradas": r["horas_laboradas"],
                    "cumple": r["cumple_horas"],
                    "formula": f"{r['horas_laboradas']:.2f} {'≥' if r['cumple_horas'] else '<'} {r['horas_semana_configuradas']} × 0.83 = {r['umbral_83pct']:.3f} {'✅' if r['cumple_horas'] else '❌'}"
                }
            },
            {
                "paso": 3, "nombre": "Calificación de calidad",
                "detalle": {
                    "pct_calidad_ingresado": r["pct_calidad_ingresado"],
                    "multiplicador_calidad": r["multiplicador_calidad"],
                    "cumple_minimo_81pct": r["cumple_calidad"],
                    "tabla_referencia": "0%→0, 81%→10%, 82%→20%, ..., 90%→100%",
                    "formula": f"calidad {(r['pct_calidad_ingresado'] or 0)*100:.0f}% → multiplicador {r['multiplicador_calidad']*100:.0f}% {'✅' if r['cumple_calidad'] else '❌'}"
                }
            },
            {
                "paso": 4, "nombre": "Cálculo de unidades adicionales",
                "detalle": {
                    "rendimiento_min_exigido_hora": r["rendimiento_min_hora"],
                    "total_horas": r["total_horas"],
                    "unidades_requeridas": round(r["unidades_requeridas"], 2),
                    "unidades_ejecutadas": r["unidades_ejecutadas"],
                    "unidades_adicionales": r["unidades_adicionales"],
                    "formula": f"max(0, {r['unidades_ejecutadas']:.0f} - {r['total_horas']:.2f}×{r['rendimiento_min_hora']}) = max(0, {r['unidades_ejecutadas']:.0f}-{r['unidades_requeridas']:.2f}) = {r['unidades_adicionales']:.0f}",
                    "resultado": "Superó el mínimo ✅" if r["supero_minimo"] else "No superó el mínimo requerido ❌"
                }
            },
            {
                "paso": 5, "nombre": "Bonificación por rendimiento",
                "detalle": {
                    "unidades_adicionales": r["unidades_adicionales"],
                    "valor_por_unidad_colaborador": r["valor_unidad_colaborador"],
                    "multiplicador_calidad": r["multiplicador_calidad"],
                    "pct_calificacion_colaborador": r["pct_calificacion_colaborador"],
                    "bonif_bruta": r["bonif_rendimiento_bruta"],
                    "bonif_redondeada": r["bonif_rendimiento_final"],
                    "formula": f"round({r['unidades_adicionales']:.0f} × ${r['valor_unidad_colaborador']:.2f} × {r['multiplicador_calidad']} × {r['pct_calificacion_colaborador']}, centena) = ${r['bonif_rendimiento_final']:,.0f}"
                }
            },
            {
                "paso": 6, "nombre": "Bonificaciones adicionales",
                "detalle": {
                    "hs_extras_ordinarias": r["hs_extras_ordinarias"],
                    "tarifa_he_ordinaria": r["tarifa_he_ordinaria"],
                    "bonif_he": r["bonif_he_ordinaria"],
                    "hs_dominicales": r["hs_dominicales"],
                    "tarifa_dominical": r["tarifa_he_dominical"],
                    "bonif_dominical": r["bonif_he_dominical"],
                    "hs_tarea": r["hs_tarea"],
                    "bonif_tarea": r["bonif_tarea"],
                }
            },
            {
                "paso": 7, "nombre": "Total colaborador",
                "detalle": {
                    "bonif_rendimiento": r["bonif_rendimiento_final"],
                    "bonif_he": r["bonif_he_ordinaria"],
                    "bonif_dominical": r["bonif_he_dominical"],
                    "bonif_tarea": r["bonif_tarea"],
                    "total": r["total_bonificacion"],
                    "formula": f"${r['bonif_rendimiento_final']:,.0f} + ${r['bonif_he_ordinaria']:,.0f} + ${r['bonif_he_dominical']:,.0f} + ${r['bonif_tarea']:,.0f} = ${r['total_bonificacion']:,.0f}"
                }
            }
        ],
        "advertencias": advertencias,
        "resultado_final": r["total_bonificacion"],
    }


def calcular_bonif_labor_especifica(registro: RegistroLaborEspecifica, db: Session) -> dict:
    """Cálculo de bonificación para labor específica, auxilio, constitutiva, etc."""
    tipo = (registro.tipo_bonificacion or "").upper().strip()
    monto = registro.total_bonificacion_manual or 0
    pct_calif = registro.pct_calificacion_colaborador or 1.0

    # Para tipos de labor específica, el monto es manual
    bonif_final = round(monto * pct_calif, -2) if monto > 0 else 0

    # Determinar tipo de bonificación destino
    if "APOYO" in tipo:
        tipo_calculo = "APOYO"
    elif "AUXILIO" in tipo:
        tipo_calculo = "AUXILIO"
    elif "CONSTITUTIVA" in tipo or "COSTITUTIVA" in tipo:
        tipo_calculo = "CONSTITUTIVA"
    else:
        tipo_calculo = "LABOR_ESPECIFICA"

    resultado = {
        "semana": registro.semana,
        "codigo_colaborador": registro.codigo_colaborador,
        "nombre_colaborador": registro.nombre_colaborador,
        "lider": registro.lider,
        "labor": registro.labor,
        "tipo_calculo": tipo_calculo,
        "monto_manual": monto,
        "pct_calificacion_colaborador": pct_calif,
        "total_bonificacion": bonif_final,
        "tipo_bonificacion_original": registro.tipo_bonificacion,
        "asociada_a": registro.asociada_a,
        "observaciones": registro.observaciones,
    }
    return resultado


def generar_narrativo_labor_especifica(r: dict) -> dict:
    """Genera JSON narrativo para labor específica."""
    return {
        "version": "1.0",
        "tipo_calculo": r["tipo_calculo"],
        "labor": r["labor"],
        "semana": r["semana"],
        "colaborador": r["nombre_colaborador"],
        "pasos": [
            {
                "paso": 1, "nombre": "Datos del registro",
                "detalle": {
                    "tipo_bonificacion": r["tipo_bonificacion_original"],
                    "labor": r["labor"],
                    "asociada_a": r.get("asociada_a"),
                    "observaciones": r.get("observaciones"),
                }
            },
            {
                "paso": 2, "nombre": "Cálculo de bonificación",
                "detalle": {
                    "monto_ingresado": r["monto_manual"],
                    "pct_calificacion": r["pct_calificacion_colaborador"],
                    "formula": f"round(${r['monto_manual']:,.0f} × {r['pct_calificacion_colaborador']}, centena) = ${r['total_bonificacion']:,.0f}",
                    "bonif_final": r["total_bonificacion"],
                }
            }
        ],
        "advertencias": [],
        "resultado_final": r["total_bonificacion"],
    }


def calcular_bonif_apoyo(semana: str, labor: str, db: Session) -> list:
    """
    Calcula bonificación de personal de apoyo para una semana+labor.
    Suma las unidades adicionales de todo el grupo de rendimiento y distribuye.
    Retorna lista de resultados (uno por persona de apoyo).
    """
    # Buscar la configuración de la labor
    labor_config = db.query(LaborRendimiento).filter(
        LaborRendimiento.nombre == labor,
        LaborRendimiento.activo == True
    ).first()
    if not labor_config:
        return []

    # Obtener todas las liquidaciones de rendimiento para esta semana+labor
    liquidaciones_rend = db.query(Liquidacion).filter(
        Liquidacion.semana == semana,
        Liquidacion.labor == labor,
        Liquidacion.tipo_bonificacion == "RENDIMIENTO"
    ).all()

    # Sumar unidades adicionales del grupo
    total_unidades_adicionales_grupo = sum(
        l.unidades_adicionales or 0 for l in liquidaciones_rend
    )

    if total_unidades_adicionales_grupo <= 0:
        return []

    # Calcular bonificación total de apoyo
    valor_apoyo = labor_config.valor_unidad_apoyo or 0
    bonif_total_apoyo = total_unidades_adicionales_grupo * valor_apoyo

    # Buscar registros de personal de apoyo para esta semana+labor
    registros_apoyo = db.query(RegistroLaborEspecifica).filter(
        RegistroLaborEspecifica.semana == semana,
        RegistroLaborEspecifica.labor == labor,
        RegistroLaborEspecifica.tipo_bonificacion.ilike("%APOYO%")
    ).all()

    if not registros_apoyo:
        return []

    cantidad_apoyo = len(registros_apoyo)
    bonif_individual_base = bonif_total_apoyo / cantidad_apoyo

    resultados = []
    for reg in registros_apoyo:
        pct_calif = reg.pct_calificacion_colaborador or 1.0
        bonif_final = round(bonif_individual_base * pct_calif, -2)

        resultado = {
            "semana": semana,
            "codigo_colaborador": reg.codigo_colaborador,
            "nombre_colaborador": reg.nombre_colaborador,
            "lider": reg.lider,
            "labor": labor,
            "tipo_calculo": "APOYO",
            "monto_manual": None,
            "pct_calificacion_colaborador": pct_calif,
            "total_bonificacion": bonif_final,
            "tipo_bonificacion_original": reg.tipo_bonificacion,
            "asociada_a": reg.asociada_a,
            "observaciones": reg.observaciones,
            "detalle_apoyo": {
                "colaboradores_rendimiento": len(liquidaciones_rend),
                "total_unidades_adicionales_grupo": total_unidades_adicionales_grupo,
                "valor_unidad_apoyo": valor_apoyo,
                "bonif_total_apoyo": bonif_total_apoyo,
                "cantidad_personal_apoyo": cantidad_apoyo,
                "bonif_individual_base": bonif_individual_base,
            }
        }
        resultados.append(resultado)

    return resultados


def guardar_liquidacion_y_pasos(resultado: dict, db: Session,
                                 registro_rendimiento_id=None, registro_labor_id=None,
                                 carga_rendimiento_id=None, carga_labor_id=None):
    """Guarda la liquidación y los pasos de cálculo en la BD."""
    tipo_calculo = resultado["tipo_calculo"]

    # Determinar tipo_bonificacion para la liquidación
    if tipo_calculo == "RENDIMIENTO":
        tipo_bonif = "RENDIMIENTO"
        narrativo = generar_narrativo_rendimiento(resultado)
    elif tipo_calculo == "APOYO":
        tipo_bonif = "PERSONAL DE APOYO LABOR"
        narrativo = generar_narrativo_labor_especifica(resultado)
    elif tipo_calculo == "AUXILIO":
        tipo_bonif = "AUXILIO DE MANUTENCIÓN"
        narrativo = generar_narrativo_labor_especifica(resultado)
    elif tipo_calculo == "CONSTITUTIVA":
        tipo_bonif = "CONSTITUTIVA SALARIO"
        narrativo = generar_narrativo_labor_especifica(resultado)
    else:
        tipo_bonif = resultado.get("tipo_bonificacion_original", "LABOR ESPECIFICA")
        narrativo = generar_narrativo_labor_especifica(resultado)

    # Verificar si ya existe (idempotencia)
    existente = db.query(Liquidacion).filter(
        Liquidacion.semana == resultado["semana"],
        Liquidacion.codigo_colaborador == resultado["codigo_colaborador"],
        Liquidacion.labor == resultado["labor"],
        Liquidacion.tipo_bonificacion == tipo_bonif,
    ).first()

    if existente:
        # Eliminar la liquidación existente (cascadea a pasos_calculo)
        db.delete(existente)
        db.flush()

    # Crear liquidación
    liq = Liquidacion(
        semana=resultado["semana"],
        fecha_reporte=resultado.get("fecha_reporte"),
        codigo_colaborador=resultado["codigo_colaborador"],
        nombre_colaborador=resultado["nombre_colaborador"],
        lider=resultado.get("lider"),
        labor=resultado.get("labor"),
        tipo_bonificacion=tipo_bonif,
        bonif_rendimiento=resultado.get("bonif_rendimiento_final", 0),
        bonif_he_ordinaria=resultado.get("bonif_he_ordinaria", 0),
        bonif_he_dominical=resultado.get("bonif_he_dominical", 0),
        bonif_tarea=resultado.get("bonif_tarea", 0),
        bonif_labor_especifica=resultado.get("total_bonificacion", 0) if tipo_calculo == "LABOR_ESPECIFICA" else 0,
        bonif_apoyo=resultado.get("total_bonificacion", 0) if tipo_calculo == "APOYO" else 0,
        bonif_auxilio=resultado.get("total_bonificacion", 0) if tipo_calculo == "AUXILIO" else 0,
        bonif_constitutiva=resultado.get("total_bonificacion", 0) if tipo_calculo == "CONSTITUTIVA" else 0,
        total_bonificacion=resultado["total_bonificacion"],
        cumple_minimo_horas=resultado.get("cumple_horas"),
        cumple_minimo_calidad=resultado.get("cumple_calidad"),
        pct_calidad=resultado.get("pct_calidad_ingresado"),
        pct_bonificacion_calidad=resultado.get("multiplicador_calidad"),
        horas_ordinarias_laboradas=resultado.get("horas_laboradas"),
        horas_requeridas_83pct=resultado.get("umbral_83pct"),
        unidades_requeridas=resultado.get("unidades_requeridas"),
        unidades_ejecutadas=resultado.get("unidades_ejecutadas"),
        unidades_adicionales=resultado.get("unidades_adicionales"),
        detalle_calculo_narrativo=json.dumps(narrativo, ensure_ascii=False),
        registro_rendimiento_id=registro_rendimiento_id,
        registro_labor_id=registro_labor_id,
        carga_rendimiento_id=carga_rendimiento_id,
        carga_labor_id=carga_labor_id,
    )
    db.add(liq)
    db.flush()

    # Guardar pasos de cálculo
    paso = PasoCalculo(
        liquidacion_id=liq.id,
        semana=resultado["semana"],
        codigo_colaborador=resultado["codigo_colaborador"],
        lider=resultado.get("lider"),
        labor=resultado.get("labor"),
        total_ramos=resultado.get("total_ramos"),
        total_hs_ordinarias=resultado.get("total_hs_ordinarias"),
        total_hs_extra=resultado.get("total_hs_extra"),
        total_horas=resultado.get("total_horas"),
        horas_semana_configuradas=resultado.get("horas_semana_configuradas"),
        umbral_83pct=resultado.get("umbral_83pct"),
        horas_laboradas=resultado.get("horas_laboradas"),
        cumple_horas=resultado.get("cumple_horas"),
        pct_calidad_ingresado=resultado.get("pct_calidad_ingresado"),
        multiplicador_calidad=resultado.get("multiplicador_calidad"),
        cumple_calidad=resultado.get("cumple_calidad"),
        rendimiento_min_hora=resultado.get("rendimiento_min_hora"),
        unidades_requeridas=resultado.get("unidades_requeridas"),
        unidades_ejecutadas=resultado.get("unidades_ejecutadas"),
        unidades_adicionales=resultado.get("unidades_adicionales"),
        supero_minimo=resultado.get("supero_minimo"),
        valor_unidad_colaborador=resultado.get("valor_unidad_colaborador"),
        pct_calificacion_colaborador=resultado.get("pct_calificacion_colaborador"),
        bonif_rendimiento_bruta=resultado.get("bonif_rendimiento_bruta"),
        bonif_rendimiento_final=resultado.get("bonif_rendimiento_final"),
        hs_extras_ordinarias=resultado.get("hs_extras_ordinarias"),
        tarifa_he_ordinaria=resultado.get("tarifa_he_ordinaria"),
        bonif_he_ordinaria=resultado.get("bonif_he_ordinaria"),
        hs_dominicales=resultado.get("hs_dominicales"),
        tarifa_he_dominical=resultado.get("tarifa_he_dominical"),
        bonif_he_dominical=resultado.get("bonif_he_dominical"),
        hs_tarea=resultado.get("hs_tarea"),
        bonif_tarea=resultado.get("bonif_tarea"),
        total_bonificacion=resultado["total_bonificacion"],
        monto_manual=resultado.get("monto_manual"),
        tipo_calculo=tipo_calculo,
        motivo_sin_bonificacion=resultado.get("motivo_sin_bonificacion"),
    )
    db.add(paso)
    db.flush()

    return liq


def calcular_liquidacion_completa(semana: str, carga_id: int, tipo: str, db: Session) -> dict:
    """
    Orquesta el cálculo completo para una semana y carga.
    tipo: "RENDIMIENTO" o "LABOR_ESPECIFICA"
    Retorna resumen de resultados.
    """
    resultados = {"procesados": 0, "con_bonificacion": 0, "sin_bonificacion": 0, "errores": []}

    if tipo == "RENDIMIENTO":
        registros = db.query(RegistroRendimiento).filter(
            RegistroRendimiento.carga_id == carga_id
        ).all()

        for reg in registros:
            try:
                labor = db.query(LaborRendimiento).filter(
                    LaborRendimiento.nombre == reg.labor,
                    LaborRendimiento.activo == True
                ).first()

                if not labor:
                    resultados["errores"].append(
                        f"Labor '{reg.labor}' no encontrada para {reg.nombre_colaborador}"
                    )
                    continue

                resultado = calcular_bonif_rendimiento(reg, labor, db)
                guardar_liquidacion_y_pasos(
                    resultado, db,
                    registro_rendimiento_id=reg.id,
                    carga_rendimiento_id=carga_id,
                )
                resultados["procesados"] += 1
                if resultado["total_bonificacion"] > 0:
                    resultados["con_bonificacion"] += 1
                else:
                    resultados["sin_bonificacion"] += 1
            except Exception as e:
                resultados["errores"].append(f"Error procesando {reg.nombre_colaborador}: {str(e)}")

    elif tipo == "LABOR_ESPECIFICA":
        registros = db.query(RegistroLaborEspecifica).filter(
            RegistroLaborEspecifica.carga_id == carga_id
        ).all()

        # Primero procesar labores específicas (no apoyo)
        for reg in registros:
            try:
                tipo_bonif = (reg.tipo_bonificacion or "").upper()
                if "APOYO" in tipo_bonif:
                    continue  # Se procesan después

                resultado = calcular_bonif_labor_especifica(reg, db)
                guardar_liquidacion_y_pasos(
                    resultado, db,
                    registro_labor_id=reg.id,
                    carga_labor_id=carga_id,
                )
                resultados["procesados"] += 1
                if resultado["total_bonificacion"] > 0:
                    resultados["con_bonificacion"] += 1
                else:
                    resultados["sin_bonificacion"] += 1
            except Exception as e:
                resultados["errores"].append(f"Error procesando {reg.nombre_colaborador}: {str(e)}")

        # Luego procesar personal de apoyo (necesita las liquidaciones de rendimiento)
        labores_apoyo = set()
        for reg in registros:
            if "APOYO" in (reg.tipo_bonificacion or "").upper():
                labores_apoyo.add((reg.semana, reg.labor))

        for sem, lab in labores_apoyo:
            try:
                resultados_apoyo = calcular_bonif_apoyo(sem, lab, db)
                for res_apoyo in resultados_apoyo:
                    # Encontrar el registro original
                    reg_original = db.query(RegistroLaborEspecifica).filter(
                        RegistroLaborEspecifica.carga_id == carga_id,
                        RegistroLaborEspecifica.semana == sem,
                        RegistroLaborEspecifica.labor == lab,
                        RegistroLaborEspecifica.codigo_colaborador == res_apoyo["codigo_colaborador"],
                    ).first()

                    guardar_liquidacion_y_pasos(
                        res_apoyo, db,
                        registro_labor_id=reg_original.id if reg_original else None,
                        carga_labor_id=carga_id,
                    )
                    resultados["procesados"] += 1
                    if res_apoyo["total_bonificacion"] > 0:
                        resultados["con_bonificacion"] += 1
                    else:
                        resultados["sin_bonificacion"] += 1
            except Exception as e:
                resultados["errores"].append(f"Error procesando apoyo {lab}: {str(e)}")

    db.commit()
    return resultados
