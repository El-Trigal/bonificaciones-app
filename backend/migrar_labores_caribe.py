"""
Migración: labores de la finca Caribe (sede_id=2) desde 'migracion, labores.xlsx'.

Ejecutar desde el directorio backend:
    python migrar_labores_caribe.py [--dry-run]

Opciones:
    --dry-run   Solo muestra lo que haría sin escribir en la BD.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import LaborRendimiento, Lider, Sede

SEDE_ID = 2
EXCEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "migracion, labores.xlsx")

# Parámetros globales del Excel
SALARIO_BASE  = 1_367_600
HORAS_MES     = 235
SEM_MES       = 52 / 12          # 4.3333...

VHO           = SALARIO_BASE / HORAS_MES
TARIFA_HE     = round(VHO * 1.25, 2)   # 7274.47
TARIFA_DOM    = round(VHO * 1.75, 2)   # 10184.25

DRY_RUN = "--dry-run" in sys.argv

# ──────────────────────────────────────────────────────────────
# Leer el Excel
# ──────────────────────────────────────────────────────────────
try:
    import openpyxl
except ImportError:
    print("[ERROR] Instala openpyxl: pip install openpyxl")
    sys.exit(1)

wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
ws = wb.active

# Labores duplicadas: nombre → líder que se conserva (el otro se descarta)
KEEP_LIDER = {
    "AUXILIO DE MANUTENCIÓN": "CRISTINA ALZATE",
}

labores_excel = []
seen_nombres = {}  # nombre → índice en labores_excel (para resolver duplicados)

for row in ws.iter_rows(min_row=2, values_only=True):
    labor_nombre = row[1]
    if not labor_nombre:
        continue
    lider_nombre = row[0]
    rendimiento  = row[2]
    tallos       = row[8]
    pct_pagar    = row[9]
    pct_col      = row[10]
    pct_apoyo    = row[11]

    nombre_upper = str(labor_nombre).strip().upper()
    lider_upper  = str(lider_nombre).strip().upper() if lider_nombre else None

    # Si hay regla de desempate y este NO es el líder correcto, lo saltamos
    if nombre_upper in KEEP_LIDER and lider_upper != KEEP_LIDER[nombre_upper]:
        print(f"  [skip duplicado] '{nombre_upper}' con líder '{lider_upper}' — se conserva '{KEEP_LIDER[nombre_upper]}'")
        continue

    labores_excel.append({
        "lider":    lider_upper,
        "nombre":   nombre_upper,
        "rendimiento_min_hora":        float(rendimiento) if rendimiento is not None else 0.0,
        "tallos_por_ramo":             int(tallos) if tallos is not None else 1,
        "pct_a_pagar_colaboradores":   float(pct_pagar) if pct_pagar is not None else 0.6,
        "pct_cortadores":              float(pct_col)   if pct_col   is not None else 1.0,
        "pct_apoyo":                   float(pct_apoyo) if pct_apoyo is not None else 0.0,
        "semanas_mes_promedio":        SEM_MES,
        "salario_base":                SALARIO_BASE,
        "tarifa_he_ordinaria":         TARIFA_HE,
        "tarifa_he_dominical":         TARIFA_DOM,
    })

# ──────────────────────────────────────────────────────────────
# Ejecutar
# ──────────────────────────────────────────────────────────────
db = SessionLocal()

try:
    sede = db.query(Sede).filter_by(id=SEDE_ID).first()
    if not sede:
        print(f"[ERROR] No existe sede con id={SEDE_ID}")
        sys.exit(1)
    print(f"\n{'[DRY-RUN] ' if DRY_RUN else ''}Sede: {sede.nombre} (id={SEDE_ID})")
    print(f"  VHO = ${SALARIO_BASE:,} / {HORAS_MES}h = ${VHO:,.2f}")
    print(f"  Tarifa HE ordinaria : ${TARIFA_HE:,.2f}")
    print(f"  Tarifa dominical    : ${TARIFA_DOM:,.2f}")
    print(f"  Total labores Excel : {len(labores_excel)}\n")

    # ── Líderes ──────────────────────────────────────────────
    lideres_unicos = sorted({l["lider"] for l in labores_excel if l["lider"]})
    lider_map = {}

    print("=== Líderes ===")
    for nombre in lideres_unicos:
        existente = db.query(Lider).filter_by(sede_id=SEDE_ID, nombre=nombre).first()
        if existente:
            lider_map[nombre] = existente.id
            print(f"  [=] {nombre} (id={existente.id})")
        else:
            print(f"  [+] {nombre} — CREAR")
            if not DRY_RUN:
                nuevo = Lider(sede_id=SEDE_ID, nombre=nombre, activo=True)
                db.add(nuevo)
                db.flush()
                lider_map[nombre] = nuevo.id
                print(f"       → id={nuevo.id}")
            else:
                lider_map[nombre] = None

    if not DRY_RUN:
        db.commit()

    # ── Labores ───────────────────────────────────────────────
    creadas = 0
    omitidas = 0
    print("\n=== Labores ===")

    for l in labores_excel:
        existente = db.query(LaborRendimiento).filter_by(
            sede_id=SEDE_ID, nombre=l["nombre"]
        ).first()

        if existente:
            print(f"  [=] {l['nombre']} (ya existe, id={existente.id})")
            omitidas += 1
            continue

        sin_rend = l["rendimiento_min_hora"] == 0.0
        tag = "[tarea]" if sin_rend else ""
        print(f"  [+] {l['nombre']} {tag} | rend={l['rendimiento_min_hora']} tallos={l['tallos_por_ramo']} "
              f"pct_pagar={l['pct_a_pagar_colaboradores']} col={l['pct_cortadores']}")

        if not DRY_RUN:
            labor = LaborRendimiento(
                sede_id                   = SEDE_ID,
                nombre                    = l["nombre"],
                lider_id                  = lider_map.get(l["lider"]),
                rendimiento_min_hora      = l["rendimiento_min_hora"],
                tallos_por_ramo           = l["tallos_por_ramo"],
                salario_base              = l["salario_base"],
                tarifa_he_ordinaria       = l["tarifa_he_ordinaria"],
                tarifa_he_dominical       = l["tarifa_he_dominical"],
                semanas_mes_promedio      = l["semanas_mes_promedio"],
                pct_a_pagar_colaboradores = l["pct_a_pagar_colaboradores"],
                pct_cortadores            = l["pct_cortadores"],
                pct_apoyo                 = l["pct_apoyo"],
                activo                    = True,
            )
            labor.recalcular_valores()
            db.add(labor)
        creadas += 1

    if not DRY_RUN:
        db.commit()

    print(f"\n{'[DRY-RUN] ' if DRY_RUN else ''}Resultado:")
    print(f"  Líderes creados : {sum(1 for v in lider_map.values() if v is not None or DRY_RUN)}")
    print(f"  Labores creadas : {creadas}")
    print(f"  Labores omitidas (ya existían): {omitidas}")
    if DRY_RUN:
        print("\n  *** Modo dry-run: ningún cambio fue escrito en la BD ***")
    else:
        print("\n  ✓ Migración completada")

finally:
    db.close()
