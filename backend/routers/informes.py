"""Informes gerenciales — queries sobre pasos_calculo."""

import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, case, distinct, and_
from typing import Optional
from database import get_db
from models import PasoCalculo, Semana, Liquidacion
from services.exportador import exportar_informe_csv

router = APIRouter()


@router.get("/cumplimiento-horas")
def cumplimiento_horas(
    semana: Optional[str] = None,
    lider: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(
        PasoCalculo.lider,
        PasoCalculo.labor,
        func.count(PasoCalculo.id).label("total"),
        func.sum(case((PasoCalculo.cumple_horas == True, 1), else_=0)).label("cumplieron"),
        func.sum(case((PasoCalculo.cumple_horas == False, 1), else_=0)).label("no_cumplieron"),
    ).filter(PasoCalculo.tipo_calculo == "RENDIMIENTO")

    if semana:
        q = q.filter(PasoCalculo.semana == semana)
    if lider:
        q = q.filter(PasoCalculo.lider.ilike(f"%{lider}%"))

    datos = q.group_by(PasoCalculo.lider, PasoCalculo.labor).all()

    return [
        {
            "lider": d.lider or "SIN LÍDER",
            "labor": d.labor,
            "total_colaboradores": d.total,
            "cumplieron": d.cumplieron,
            "no_cumplieron": d.no_cumplieron,
            "pct_cumplimiento": round(d.cumplieron / d.total * 100, 1) if d.total > 0 else 0,
        }
        for d in datos
    ]


@router.get("/distribucion-calidad")
def distribucion_calidad(
    semana: Optional[str] = None,
    labor: Optional[str] = None,
    lider: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(PasoCalculo).filter(PasoCalculo.tipo_calculo == "RENDIMIENTO")
    if semana:
        q = q.filter(PasoCalculo.semana == semana)
    if labor:
        q = q.filter(PasoCalculo.labor == labor)
    if lider:
        q = q.filter(PasoCalculo.lider.ilike(f"%{lider}%"))

    pasos = q.all()
    rangos = {
        "Sin bonif. (<81%)": {"min": 0, "max": 0.81, "count": 0, "total_bonif": 0},
        "Parcial (81-85%)": {"min": 0.81, "max": 0.86, "count": 0, "total_bonif": 0},
        "Buena (86-89%)": {"min": 0.86, "max": 0.90, "count": 0, "total_bonif": 0},
        "Excelente (≥90%)": {"min": 0.90, "max": 2.0, "count": 0, "total_bonif": 0},
    }

    for p in pasos:
        cal = p.pct_calidad_ingresado or 0
        for nombre, rango in rangos.items():
            if rango["min"] <= cal < rango["max"]:
                rango["count"] += 1
                rango["total_bonif"] += p.total_bonificacion or 0
                break

    total = len(pasos)
    return [
        {
            "rango": nombre,
            "cantidad": r["count"],
            "pct_total": round(r["count"] / total * 100, 1) if total > 0 else 0,
            "bonif_promedio": round(r["total_bonif"] / r["count"]) if r["count"] > 0 else 0,
        }
        for nombre, r in rangos.items()
    ]


@router.get("/eficiencia-rendimiento")
def eficiencia_rendimiento(
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    lider: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(
        PasoCalculo.labor,
        PasoCalculo.semana,
        func.count(PasoCalculo.id).label("total"),
        func.avg(PasoCalculo.unidades_adicionales).label("prom_unidades"),
        func.sum(case((PasoCalculo.supero_minimo == True, 1), else_=0)).label("superaron"),
        func.avg(PasoCalculo.total_bonificacion).label("bonif_promedio"),
    ).filter(PasoCalculo.tipo_calculo == "RENDIMIENTO")

    if desde:
        q = q.filter(PasoCalculo.semana >= desde)
    if hasta:
        q = q.filter(PasoCalculo.semana <= hasta)
    if lider:
        q = q.filter(PasoCalculo.lider.ilike(f"%{lider}%"))

    datos = q.group_by(PasoCalculo.labor, PasoCalculo.semana).order_by(
        PasoCalculo.labor, PasoCalculo.semana
    ).all()

    return [
        {
            "labor": d.labor,
            "semana": d.semana,
            "total_colaboradores": d.total,
            "prom_unidades_adicionales": round(d.prom_unidades or 0, 1),
            "pct_supero_minimo": round(d.superaron / d.total * 100, 1) if d.total > 0 else 0,
            "bonif_promedio": round(d.bonif_promedio or 0),
        }
        for d in datos
    ]


@router.get("/impacto-festivos")
def impacto_festivos(año: int = Query(2026), db: Session = Depends(get_db)):
    semanas = db.query(Semana).filter(Semana.año == año).all()
    semanas_map = {s.codigo: s for s in semanas}

    # Obtener totales por semana
    datos = db.query(
        Liquidacion.semana,
        func.count(distinct(Liquidacion.codigo_colaborador)).label("colaboradores"),
        func.sum(Liquidacion.total_bonificacion).label("total_bonif"),
    ).filter(
        Liquidacion.semana.like(f"{año}-%")
    ).group_by(Liquidacion.semana).order_by(Liquidacion.semana).all()

    resultado = []
    for d in datos:
        sem = semanas_map.get(d.semana)
        resultado.append({
            "semana": d.semana,
            "tiene_festivo": sem.tiene_festivo if sem else False,
            "horas_configuradas": sem.horas_ordinarias if sem else 43.5,
            "total_bonif": d.total_bonif or 0,
            "total_colaboradores": d.colaboradores,
            "bonif_promedio": round((d.total_bonif or 0) / d.colaboradores) if d.colaboradores > 0 else 0,
        })

    # Calcular impacto
    normales = [r for r in resultado if not r["tiene_festivo"]]
    festivos = [r for r in resultado if r["tiene_festivo"]]
    prom_normal = sum(r["bonif_promedio"] for r in normales) / len(normales) if normales else 0
    prom_festivo = sum(r["bonif_promedio"] for r in festivos) / len(festivos) if festivos else 0
    impacto_pct = round((prom_festivo - prom_normal) / prom_normal * 100, 1) if prom_normal > 0 else 0

    return {
        "detalle": resultado,
        "resumen": {
            "bonif_promedio_normal": round(prom_normal),
            "bonif_promedio_festivo": round(prom_festivo),
            "impacto_porcentual": impacto_pct,
        }
    }


@router.get("/colaboradores-sin-bonificacion")
def colaboradores_sin_bonificacion(
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    lider: Optional[str] = None,
    motivo: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(
        PasoCalculo.codigo_colaborador,
        func.max(PasoCalculo.lider).label("lider"),
        func.max(PasoCalculo.labor).label("labor"),
        func.count(PasoCalculo.id).label("semanas_sin_bonif"),
        PasoCalculo.motivo_sin_bonificacion,
    ).filter(
        PasoCalculo.motivo_sin_bonificacion.isnot(None)
    )

    if desde:
        q = q.filter(PasoCalculo.semana >= desde)
    if hasta:
        q = q.filter(PasoCalculo.semana <= hasta)
    if lider:
        q = q.filter(PasoCalculo.lider.ilike(f"%{lider}%"))
    if motivo:
        q = q.filter(PasoCalculo.motivo_sin_bonificacion == motivo)

    datos = q.group_by(
        PasoCalculo.codigo_colaborador, PasoCalculo.motivo_sin_bonificacion
    ).order_by(func.count(PasoCalculo.id).desc()).all()

    # Agrupar por colaborador, mostrar motivo más frecuente
    por_colaborador = {}
    for d in datos:
        cod = d.codigo_colaborador
        if cod not in por_colaborador:
            # Obtener nombre del colaborador
            liq = db.query(Liquidacion).filter(
                Liquidacion.codigo_colaborador == cod
            ).first()
            por_colaborador[cod] = {
                "codigo": cod,
                "nombre": liq.nombre_colaborador if liq else str(cod),
                "lider": d.lider,
                "labor": d.labor,
                "semanas_sin_bonif": 0,
                "motivo_mas_frecuente": d.motivo_sin_bonificacion,
            }
        por_colaborador[cod]["semanas_sin_bonif"] += d.semanas_sin_bonif

    return sorted(por_colaborador.values(), key=lambda x: x["semanas_sin_bonif"], reverse=True)


@router.get("/evolucion-colaborador/{codigo}")
def evolucion_colaborador(
    codigo: int,
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(PasoCalculo).filter(PasoCalculo.codigo_colaborador == codigo)
    if desde:
        q = q.filter(PasoCalculo.semana >= desde)
    if hasta:
        q = q.filter(PasoCalculo.semana <= hasta)

    pasos = q.order_by(PasoCalculo.semana).all()

    if not pasos:
        return {"colaborador": codigo, "datos": []}

    return {
        "colaborador": {
            "codigo": codigo,
            "nombre": pasos[0].lider if pasos else "",
        },
        "datos": [
            {
                "semana": p.semana,
                "labor": p.labor,
                "unidades_requeridas": p.unidades_requeridas,
                "unidades_ejecutadas": p.unidades_ejecutadas,
                "unidades_adicionales": p.unidades_adicionales,
                "pct_calidad": p.pct_calidad_ingresado,
                "total_bonificacion": p.total_bonificacion,
                "cumple_horas": p.cumple_horas,
                "cumple_calidad": p.cumple_calidad,
                "supero_minimo": p.supero_minimo,
                "motivo": p.motivo_sin_bonificacion,
            }
            for p in pasos
        ],
    }


@router.get("/costo-por-labor")
def costo_por_labor(semana: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(
        Liquidacion.labor,
        func.sum(Liquidacion.bonif_rendimiento).label("rendimiento"),
        func.sum(Liquidacion.bonif_he_ordinaria).label("he_ordinaria"),
        func.sum(Liquidacion.bonif_he_dominical).label("he_dominical"),
        func.sum(Liquidacion.bonif_tarea).label("tarea"),
        func.sum(Liquidacion.bonif_apoyo).label("apoyo"),
        func.sum(Liquidacion.bonif_labor_especifica).label("labor_especifica"),
        func.sum(Liquidacion.total_bonificacion).label("total"),
        func.count(distinct(Liquidacion.codigo_colaborador)).label("colaboradores"),
    ).filter(Liquidacion.labor.isnot(None))

    if semana:
        q = q.filter(Liquidacion.semana == semana)

    datos = q.group_by(Liquidacion.labor).order_by(
        func.sum(Liquidacion.total_bonificacion).desc()
    ).all()

    return [
        {
            "labor": d.labor,
            "rendimiento": d.rendimiento or 0,
            "he_ordinaria": d.he_ordinaria or 0,
            "he_dominical": d.he_dominical or 0,
            "tarea": d.tarea or 0,
            "apoyo": d.apoyo or 0,
            "labor_especifica": d.labor_especifica or 0,
            "total": d.total or 0,
            "colaboradores": d.colaboradores,
        }
        for d in datos
    ]


@router.get("/exportar/{tipo}")
def exportar_informe(
    tipo: str,
    semana: Optional[str] = None,
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    lider: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if tipo == "cumplimiento-horas":
        datos = cumplimiento_horas(semana, lider, db)
        columnas = ["lider", "labor", "total_colaboradores", "cumplieron", "no_cumplieron", "pct_cumplimiento"]
    elif tipo == "distribucion-calidad":
        datos = distribucion_calidad(semana, None, lider, db)
        columnas = ["rango", "cantidad", "pct_total", "bonif_promedio"]
    elif tipo == "eficiencia":
        datos = eficiencia_rendimiento(desde, hasta, lider, db)
        columnas = ["labor", "semana", "total_colaboradores", "prom_unidades_adicionales", "pct_supero_minimo", "bonif_promedio"]
    elif tipo == "sin-bonificacion":
        datos = colaboradores_sin_bonificacion(desde, hasta, lider, None, db)
        columnas = ["codigo", "nombre", "lider", "labor", "semanas_sin_bonif", "motivo_mas_frecuente"]
    else:
        datos = []
        columnas = []

    csv_content = exportar_informe_csv(datos, columnas)
    return StreamingResponse(
        io.BytesIO(csv_content.encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=informe_{tipo}.csv"}
    )
