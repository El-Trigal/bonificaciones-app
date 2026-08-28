"""Datos semilla — se ejecuta al crear la BD por primera vez."""

from sqlalchemy.orm import Session
from models import (
    Sede, Empleado, Lider, ProductoArea, Semana,
    LaborRendimiento, TipoBonificacion, Usuario
)
from services.auth import hash_password


def seed_database(db: Session):
    """Carga datos iniciales si las tablas están vacías."""

    if db.query(Sede).first():
        return  # Ya está poblada

    # ─── Sedes ─────────────────────────────────────────────
    sedes_data = [
        {"nombre": "Manantiales", "codigo": "MAN"},
        {"nombre": "Caribe",      "codigo": "CAR"},
        {"nombre": "Olas",        "codigo": "OLA"},
        {"nombre": "Aguas Claras","codigo": "AGC"},
    ]
    sedes = {}
    for s in sedes_data:
        sede = Sede(**s)
        db.add(sede)
        db.flush()
        sedes[s["codigo"]] = sede

    man = sedes["MAN"]  # sede principal para datos de ejemplo

    # ─── Usuario SUPER_ADMIN ────────────────────────────────
    # La contraseña se toma de ADMIN_PASSWORD env var; si no existe genera una aleatoria
    import os, secrets as _secrets
    admin_password = os.environ.get("ADMIN_PASSWORD") or _secrets.token_urlsafe(16)
    print(f"[SEED] Contraseña admin generada: {admin_password}  ← cámbiala después de entrar")
    db.add(Usuario(
        username="admin",
        password_hash=hash_password(admin_password),
        nombre_completo="Administrador General",
        email="julian.guevara@floreseltrigal.com",
        rol="SUPER_ADMIN",
        sede_id=None,
        activo=True,
    ))

    # ─── Líderes (sede Manantiales) ─────────────────────────
    lideres_data = [
        "OMAR FERNEY FONNEGRA", "WILSON PEDRAZA", "JOSE ALBEIRO MARIN",
        "CARLOS MARIO MONTOYA", "EVELIO RIOS", "JUAN CARLOS BETANCUR",
        "FREDDY ALEXANDER GARCIA", "LUIS FERNANDO OSPINA", "DIANA MARCELA LOPEZ"
    ]
    lideres = {}
    for nombre in lideres_data:
        lider = Lider(nombre=nombre, sede_id=man.id)
        db.add(lider)
        db.flush()
        lideres[nombre] = lider.id

    # ─── Productos / Áreas (sede Manantiales) ───────────────
    productos_data = [
        "ENRAIZAMIENTO", "MIPE", "CORTE", "POSTCOSECHA", "SIEMBRA",
        "MANTENIMIENTO DE CULTIVO", "RIEGO", "CONTROL DE CALIDAD",
        "LOGÍSTICA", "COMPOSTERA", "TRANSPORTE", "ADMINISTRACIÓN",
        "EMPAQUE", "DESPACHO", "BODEGA", "MAQUINARIA", "GENERAL"
    ]
    for nombre in productos_data:
        db.add(ProductoArea(nombre=nombre, sede_id=man.id))

    # ─── Tipos de bonificación (sede Manantiales) ───────────
    tipos_data = [
        "LABOR ESPECIFICA", "PERSONAL DE APOYO LABOR",
        "AUXILIO DE MANUTENCIÓN", "CONSTITUTIVA SALARIO",
        "PERSONAL DE APOYO CONTROL", "MEDIOS DE TRANSPORTE",
        "TIEMPO", "AJUSTE"
    ]
    for nombre in tipos_data:
        db.add(TipoBonificacion(nombre=nombre, sede_id=man.id))

    # ─── Labores de rendimiento (sede Manantiales) ──────────
    labores_data = [
        {"nombre": "CORTE CR-MW-SL", "rendimiento_min_hora": 45, "tallos_por_ramo": 10,
         "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 0.86, "pct_apoyo": 0.14},
        {"nombre": "CORTE", "rendimiento_min_hora": 45, "tallos_por_ramo": 10,
         "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 0.86, "pct_apoyo": 0.14},
        {"nombre": "CORTE SOLIDAGO", "rendimiento_min_hora": 45, "tallos_por_ramo": 10,
         "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 0.86, "pct_apoyo": 0.14},
        {"nombre": "SIEMBRA CREMON", "rendimiento_min_hora": 0.369, "tallos_por_ramo": 1,
         "pct_a_pagar_colaboradores": 0.90, "pct_cortadores": 0.86, "pct_apoyo": 0.14},
        {"nombre": "DESBOTON", "rendimiento_min_hora": 430, "tallos_por_ramo": 1,
         "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 0.86, "pct_apoyo": 0.14},
        {"nombre": "SIEMBRA BANCOS CREMON", "rendimiento_min_hora": 3360, "tallos_por_ramo": 1,
         "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 1.0, "pct_apoyo": 0.0},
        {"nombre": "SIEMBRA BANCOS SOLIDAGO", "rendimiento_min_hora": 2900, "tallos_por_ramo": 1,
         "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 1.0, "pct_apoyo": 0.0},
        {"nombre": "COLOCACION MALLA", "rendimiento_min_hora": 1944, "tallos_por_ramo": 1,
         "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 1.0, "pct_apoyo": 0.0},
        {"nombre": "MADERA, MALLAS Y MANGUERAS", "rendimiento_min_hora": 4, "tallos_por_ramo": 1,
         "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 1.0, "pct_apoyo": 0.0},
        {"nombre": "DESMALEZAR Y BARRER SOCA CRISANTEMO", "rendimiento_min_hora": 1.16,
         "tallos_por_ramo": 1, "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 1.0, "pct_apoyo": 0.0},
        {"nombre": "INCORPORAR ENMIENDAS Y FERTILIZANTES", "rendimiento_min_hora": 3.5,
         "tallos_por_ramo": 1, "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 1.0, "pct_apoyo": 0.0},
        {"nombre": "CARGAR SOCA A PARIJUELAS", "rendimiento_min_hora": 5.9,
         "tallos_por_ramo": 1, "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 1.0, "pct_apoyo": 0.0},
        {"nombre": "TRANSPORTE SOCA", "rendimiento_min_hora": 4, "tallos_por_ramo": 1,
         "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 1.0, "pct_apoyo": 0.0},
        {"nombre": "PREPARACION CAMAS", "rendimiento_min_hora": 0.34, "tallos_por_ramo": 1,
         "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 1.0, "pct_apoyo": 0.0},
        {"nombre": "EMPAQUE COMPOST", "rendimiento_min_hora": 22, "tallos_por_ramo": 1,
         "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 1.0, "pct_apoyo": 0.0},
        {"nombre": "BARRER CAMAS PARA TRACTOR", "rendimiento_min_hora": 4.2, "tallos_por_ramo": 1,
         "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 1.0, "pct_apoyo": 0.0},
        {"nombre": "BARRER CAMAS CON TRACTOR", "rendimiento_min_hora": 12.5, "tallos_por_ramo": 1,
         "pct_a_pagar_colaboradores": 0.60, "pct_cortadores": 1.0, "pct_apoyo": 0.0},
    ]
    for labor_data in labores_data:
        labor = LaborRendimiento(
            sede_id=man.id,
            salario_base=1423500,
            tarifa_he_ordinaria=7736,
            tarifa_he_dominical=12378,
            semanas_mes_promedio=4.33,
            **labor_data
        )
        labor.recalcular_valores()
        db.add(labor)

    # ─── Semanas 2026 (sede Manantiales) ────────────────────
    festivos_semana = {
        1, 3, 12, 14, 18, 21, 24, 25, 27, 29, 31, 33, 42, 44, 46, 49, 52
    }
    horas_base = 43.5
    for i in range(1, 53):
        codigo = f"2026-{i:02d}"
        tiene_festivo = i in festivos_semana
        horas = horas_base - 7.25 if tiene_festivo else horas_base
        db.add(Semana(
            sede_id=man.id,
            codigo=codigo,
            horas_ordinarias=horas,
            tiene_festivo=tiene_festivo,
            año=2026,
        ))

    # ─── Empleados de ejemplo (sede Manantiales) ────────────
    empleados_ejemplo = [
        (48989, "LOPEZ RIVERA JUAN CAMILO", "OPERARIO"),
        (198199, "ESPAÑA ORTEGA JHAN LUIS", "OPERARIO"),
        (202520, "BORJA ECHAVARRIA JOSE MIGUEL", "OPERARIO"),
        (16603, "OSORIO OSCAR ADOLFO", "OPERARIO"),
        (135685, "MONTOYA ROJAS MATEO", "OPERARIO"),
        (70409, "RAMIREZ CORREA CARLOS ANDRES", "OPERARIO"),
        (152130, "FLOREZ CASTRO LUIS ALBERTO", "OPERARIO"),
        (30001, "GARCIA HERNANDEZ MARIA PAULA", "OPERARIO"),
        (30002, "MARTINEZ LOPEZ DIEGO ALEJANDRO", "OPERARIO"),
        (30003, "RODRIGUEZ CASTRO ANA MARIA", "OPERARIO"),
        (30004, "GOMEZ RUIZ LUIS CARLOS", "OPERARIO"),
        (30005, "HERNANDEZ DIAZ CAMILO ANDRES", "OPERARIO"),
        (30006, "PEREZ MORENO JULIANA", "OPERARIO"),
        (30007, "SANCHEZ VARGAS JOSE DAVID", "OPERARIO"),
        (30008, "RAMIREZ OSPINA DANIELA", "OPERARIO"),
        (30009, "TORRES MEJIA SANTIAGO", "OPERARIO"),
        (30010, "FLOREZ ARIAS VALENTINA", "OPERARIO"),
    ]
    for codigo, nombre, cargo in empleados_ejemplo:
        db.add(Empleado(sede_id=man.id, codigo=codigo, nombre=nombre, cargo=cargo))

    db.commit()
    print("[OK] Datos semilla cargados: 4 sedes + SUPER_ADMIN + catálogos Manantiales")
