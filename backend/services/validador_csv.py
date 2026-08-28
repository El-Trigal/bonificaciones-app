"""Validación fila por fila de CSVs de rendimiento y labor específica."""

import csv
import io
from sqlalchemy.orm import Session
from models import Empleado, LaborRendimiento, Semana, Lider, TipoBonificacion


def validar_rendimiento(contenido: str, db: Session) -> dict:
    """Valida CSV de rendimiento fila por fila. Retorna resultado con errores y preview."""
    reader = csv.DictReader(io.StringIO(contenido))
    errores = []
    advertencias = []
    filas_ok = 0
    filas_error = 0
    preview = []
    fila_num = 1

    # Cache de catálogos para no consultar por cada fila
    empleados_codigos = {e.codigo for e in db.query(Empleado.codigo).filter(Empleado.activo == True).all()}
    labores_nombres = {l.nombre for l in db.query(LaborRendimiento.nombre).filter(LaborRendimiento.activo == True).all()}
    semanas_codigos = {s.codigo for s in db.query(Semana.codigo).all()}
    lideres_nombres = {l.nombre for l in db.query(Lider.nombre).filter(Lider.activo == True).all()}

    for row in reader:
        fila_num += 1
        errores_fila = []

        # Limpiar espacios
        row = {k.strip(): (v.strip() if v else "") for k, v in row.items()}

        # Validar codigo_colaborador
        try:
            codigo = int(row.get("codigo_colaborador", ""))
            if codigo not in empleados_codigos:
                errores_fila.append({
                    "fila": fila_num, "nivel": "ERROR", "campo": "codigo_colaborador",
                    "valor": str(codigo),
                    "mensaje": f"Código {codigo} no existe en el catálogo de empleados"
                })
        except (ValueError, TypeError):
            errores_fila.append({
                "fila": fila_num, "nivel": "ERROR", "campo": "codigo_colaborador",
                "valor": row.get("codigo_colaborador", ""),
                "mensaje": "Código de colaborador debe ser un número entero"
            })

        # Validar labor
        labor = row.get("labor", "")
        if labor and labor not in labores_nombres:
            errores_fila.append({
                "fila": fila_num, "nivel": "ERROR", "campo": "labor",
                "valor": labor,
                "mensaje": f"Labor '{labor}' no está en el catálogo de labores de rendimiento. ¿Es una labor específica?"
            })

        # Validar semana
        semana = row.get("semana", "")
        if semana and semana not in semanas_codigos:
            errores_fila.append({
                "fila": fila_num, "nivel": "ERROR", "campo": "semana",
                "valor": semana,
                "mensaje": f"Semana '{semana}' no existe en el catálogo"
            })

        # Validar líder (solo warning)
        lider = row.get("lider", "")
        if lider and lider not in lideres_nombres:
            advertencias.append({
                "fila": fila_num, "nivel": "WARNING", "campo": "lider",
                "valor": lider,
                "mensaje": f"Líder '{lider}' no encontrado, se creará automáticamente"
            })

        # Validar pct_calidad
        try:
            pct = row.get("pct_calidad", "")
            if pct:
                pct_val = float(pct)
                if pct_val < 0 or pct_val > 1:
                    errores_fila.append({
                        "fila": fila_num, "nivel": "ERROR", "campo": "pct_calidad",
                        "valor": pct,
                        "mensaje": "% calidad debe estar entre 0 y 1"
                    })
        except ValueError:
            errores_fila.append({
                "fila": fila_num, "nivel": "ERROR", "campo": "pct_calidad",
                "valor": pct, "mensaje": "% calidad debe ser un número decimal"
            })

        # Validar pct_calificacion_colaborador
        try:
            pct_c = row.get("pct_calificacion_colaborador", "")
            if pct_c:
                pct_c_val = float(pct_c)
                if pct_c_val < 0 or pct_c_val > 1:
                    errores_fila.append({
                        "fila": fila_num, "nivel": "ERROR", "campo": "pct_calificacion_colaborador",
                        "valor": pct_c,
                        "mensaje": "% calificación debe estar entre 0 y 1"
                    })
        except ValueError:
            if pct_c:
                errores_fila.append({
                    "fila": fila_num, "nivel": "ERROR", "campo": "pct_calificacion_colaborador",
                    "valor": pct_c, "mensaje": "% calificación debe ser un número decimal"
                })

        # Validar horas y ramos no negativos
        campos_numericos = [
            "dom_ramos", "dom_hs_ord", "dom_hs_extra",
            "lun_ramos", "lun_hs_ord", "lun_hs_extra",
            "mar_ramos", "mar_hs_ord", "mar_hs_extra",
            "mie_ramos", "mie_hs_ord", "mie_hs_extra",
            "jue_ramos", "jue_hs_ord", "jue_hs_extra",
            "vie_ramos", "vie_hs_ord", "vie_hs_extra",
            "sab_ramos", "sab_hs_ord", "sab_hs_extra",
        ]
        for campo in campos_numericos:
            val = row.get(campo, "0")
            try:
                if val and float(val) < 0:
                    errores_fila.append({
                        "fila": fila_num, "nivel": "ERROR", "campo": campo,
                        "valor": val, "mensaje": f"{campo} no puede ser negativo"
                    })
            except ValueError:
                if val and val.strip():
                    errores_fila.append({
                        "fila": fila_num, "nivel": "ERROR", "campo": campo,
                        "valor": val, "mensaje": f"{campo} debe ser numérico"
                    })

        if errores_fila:
            errores.extend(errores_fila)
            filas_error += 1
        else:
            filas_ok += 1

        if fila_num <= 11:  # Preview primeras 10 filas
            preview.append(row)

    return {
        "total_filas": fila_num - 1,
        "filas_ok": filas_ok,
        "filas_error": filas_error,
        "errores": errores,
        "advertencias": advertencias,
        "preview": preview,
    }


def validar_labor_especifica(contenido: str, db: Session) -> dict:
    """Valida CSV de labor específica fila por fila."""
    reader = csv.DictReader(io.StringIO(contenido))
    errores = []
    advertencias = []
    filas_ok = 0
    filas_error = 0
    preview = []
    fila_num = 1

    empleados_codigos = {e.codigo for e in db.query(Empleado.codigo).filter(Empleado.activo == True).all()}
    semanas_codigos = {s.codigo for s in db.query(Semana.codigo).all()}
    tipos_nombres = {t.nombre.upper() for t in db.query(TipoBonificacion.nombre).filter(TipoBonificacion.activo == True).all()}

    for row in reader:
        fila_num += 1
        errores_fila = []
        row = {k.strip(): (v.strip() if v else "") for k, v in row.items()}

        # Validar codigo_colaborador
        try:
            codigo = int(row.get("codigo_colaborador", ""))
            if codigo not in empleados_codigos:
                errores_fila.append({
                    "fila": fila_num, "nivel": "ERROR", "campo": "codigo_colaborador",
                    "valor": str(codigo),
                    "mensaje": f"Código {codigo} no existe en el catálogo de empleados"
                })
        except (ValueError, TypeError):
            errores_fila.append({
                "fila": fila_num, "nivel": "ERROR", "campo": "codigo_colaborador",
                "valor": row.get("codigo_colaborador", ""),
                "mensaje": "Código de colaborador debe ser un número entero"
            })

        # Validar semana
        semana = row.get("semana", "")
        if semana and semana not in semanas_codigos:
            errores_fila.append({
                "fila": fila_num, "nivel": "ERROR", "campo": "semana",
                "valor": semana,
                "mensaje": f"Semana '{semana}' no existe en el catálogo"
            })

        # Validar tipo_bonificacion (acepta variantes con fechas)
        tipo = row.get("tipo_bonificacion", "").upper()
        tipo_base = tipo.split("-")[0].strip() if "-" in tipo else tipo
        if tipo and tipo_base not in tipos_nombres and tipo not in tipos_nombres:
            # Verificar variantes comunes
            es_valido = any(tipo.startswith(t) for t in tipos_nombres)
            if not es_valido:
                errores_fila.append({
                    "fila": fila_num, "nivel": "ERROR", "campo": "tipo_bonificacion",
                    "valor": tipo,
                    "mensaje": f"Tipo de bonificación '{tipo}' no reconocido"
                })

        # Validar total_bonificacion_manual para tipos no-apoyo
        if "APOYO" not in tipo:
            monto = row.get("total_bonificacion_manual", "")
            if monto:
                try:
                    val = float(monto)
                    if val < 0:
                        errores_fila.append({
                            "fila": fila_num, "nivel": "ERROR",
                            "campo": "total_bonificacion_manual",
                            "valor": monto,
                            "mensaje": "El monto de bonificación no puede ser negativo"
                        })
                except ValueError:
                    errores_fila.append({
                        "fila": fila_num, "nivel": "ERROR",
                        "campo": "total_bonificacion_manual",
                        "valor": monto,
                        "mensaje": "El monto debe ser numérico"
                    })

        if errores_fila:
            errores.extend(errores_fila)
            filas_error += 1
        else:
            filas_ok += 1

        if fila_num <= 11:
            preview.append(row)

    return {
        "total_filas": fila_num - 1,
        "filas_ok": filas_ok,
        "filas_error": filas_error,
        "errores": errores,
        "advertencias": advertencias,
        "preview": preview,
    }
