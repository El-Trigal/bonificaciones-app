"""Generación de CSV consolidado para nómina y exportación de informes."""

import csv
import io
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import Liquidacion


def generar_consolidado_nomina(semana: str, db: Session, sede_id: int = None) -> str:
    """
    Genera CSV consolidado con formato listo para nómina.
    Agrupa por colaborador y tipo de bonificación.
    Formato: TIPO_BONIFICACION, CODIGO_COLABORADOR, NOMBRE_COLABORADOR, PERMANENCIA, RENDIMIENTO, TOTAL
    """
    q = db.query(Liquidacion).filter(Liquidacion.semana == semana)
    if sede_id:
        q = q.filter(Liquidacion.sede_id == sede_id)
    liquidaciones = q.order_by(
        Liquidacion.tipo_bonificacion,
        Liquidacion.codigo_colaborador
    ).all()

    # Agrupar por colaborador+tipo
    agrupado = {}
    for liq in liquidaciones:
        clave = (liq.tipo_bonificacion, liq.codigo_colaborador, liq.nombre_colaborador)
        if clave not in agrupado:
            agrupado[clave] = {"permanencia": 0, "rendimiento": 0, "total": 0}

        grupo = agrupado[clave]
        # Permanencia: auxilio, constitutiva, labor específica
        permanencia = (liq.bonif_auxilio or 0) + (liq.bonif_constitutiva or 0) + (liq.bonif_labor_especifica or 0) + (liq.bonif_apoyo or 0)
        # Rendimiento: bonif rendimiento + HE + dominical + tarea
        rendimiento = (liq.bonif_rendimiento or 0) + (liq.bonif_he_ordinaria or 0) + (liq.bonif_he_dominical or 0) + (liq.bonif_tarea or 0)

        grupo["permanencia"] += permanencia
        grupo["rendimiento"] += rendimiento
        grupo["total"] += liq.total_bonificacion or 0

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["TIPO_BONIFICACION", "CODIGO_COLABORADOR", "NOMBRE_COLABORADOR", "PERMANENCIA", "RENDIMIENTO", "TOTAL"])

    for (tipo, codigo, nombre), montos in sorted(agrupado.items()):
        perm = int(montos["permanencia"]) if montos["permanencia"] else ""
        rend = int(montos["rendimiento"]) if montos["rendimiento"] else ""
        total = int(montos["total"])
        writer.writerow([tipo, codigo, nombre, perm, rend, total])

    return output.getvalue()


def exportar_informe_csv(datos: list, columnas: list) -> str:
    """Exporta cualquier lista de diccionarios como CSV."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columnas)
    writer.writeheader()
    for fila in datos:
        writer.writerow({k: fila.get(k, "") for k in columnas})
    return output.getvalue()
