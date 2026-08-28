"""Migración V2: periodos nómina, registros diarios, plantillas, calidad, usuarios.

Ejecutar UNA VEZ: python migracion_v2.py
- Crea tablas nuevas sin tocar datos existentes.
- Agrega columnas a 'semanas' (fecha_inicio, fecha_cierre, periodo_nomina_id).
- Siembra 24 periodos quincenales 2026.
- Vincula cada semana existente al periodo quincenal correspondiente.
- Crea usuario admin inicial (username=admin, password=admin123 — cambiar en primer login).
"""

import sys
from datetime import date, datetime, timedelta
from calendar import monthrange

import bcrypt
from sqlalchemy import inspect, text

from database import engine, SessionLocal, Base
import models


def columnas_existentes(tabla: str) -> set[str]:
    insp = inspect(engine)
    return {c["name"] for c in insp.get_columns(tabla)}


def agregar_columna_si_falta(tabla: str, columna: str, tipo_sql: str):
    cols = columnas_existentes(tabla)
    if columna not in cols:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {columna} {tipo_sql}"))
        print(f"  [+] Columna {tabla}.{columna} agregada")
    else:
        print(f"  [=] Columna {tabla}.{columna} ya existe")


def crear_tablas_nuevas():
    print("[1/5] Creando tablas nuevas...")
    # create_all es idempotente: no toca tablas existentes
    Base.metadata.create_all(bind=engine)
    print("      OK")


def migrar_semanas():
    print("[2/5] Agregando columnas a 'semanas'...")
    agregar_columna_si_falta("semanas", "fecha_inicio", "DATE")
    agregar_columna_si_falta("semanas", "fecha_cierre", "DATE")
    agregar_columna_si_falta("semanas", "periodo_nomina_id", "INTEGER REFERENCES periodos_nomina(id)")


def sembrar_periodos_2026(db):
    print("[3/5] Sembrando periodos de nomina 2026...")
    existentes = {p.codigo for p in db.query(models.PeriodoNomina).all()}
    creados = 0
    for mes in range(1, 13):
        # Q1: día 1-15, paga día 15
        codigo = f"2026-{mes:02d}-Q1"
        if codigo not in existentes:
            db.add(models.PeriodoNomina(
                codigo=codigo, año=2026, mes=mes, quincena=1,
                fecha_inicio=date(2026, mes, 1),
                fecha_fin=date(2026, mes, 15),
                fecha_pago=date(2026, mes, 15),
                estado="ABIERTO",
            ))
            creados += 1
        # Q2: día 16-fin, paga ultimo día
        ultimo = monthrange(2026, mes)[1]
        codigo = f"2026-{mes:02d}-Q2"
        if codigo not in existentes:
            db.add(models.PeriodoNomina(
                codigo=codigo, año=2026, mes=mes, quincena=2,
                fecha_inicio=date(2026, mes, 16),
                fecha_fin=date(2026, mes, ultimo),
                fecha_pago=date(2026, mes, ultimo),
                estado="ABIERTO",
            ))
            creados += 1
    db.commit()
    print(f"      {creados} periodos creados (total en BD: {db.query(models.PeriodoNomina).count()})")


def vincular_semanas_a_periodos(db):
    """Vincula cada Semana a un PeriodoNomina usando fecha_cierre.
    Si la semana no tiene fecha_cierre, intenta derivar desde su código 'YYYY-WW'.
    """
    print("[4/5] Vinculando semanas a periodos...")
    semanas = db.query(models.Semana).all()
    periodos = db.query(models.PeriodoNomina).all()
    actualizadas = 0
    for s in semanas:
        if s.periodo_nomina_id:
            continue
        # Derivar fecha_cierre desde código si falta
        if not s.fecha_cierre:
            try:
                # Códigos posibles: "2026-07" o "2607"
                cod = s.codigo.replace("-", "")
                if len(cod) == 4:
                    año = 2000 + int(cod[:2])
                    semana_num = int(cod[2:])
                else:
                    año = int(cod[:4])
                    semana_num = int(cod[4:])
                # ISO week → lunes de esa semana + 6 = domingo
                fecha_base = date.fromisocalendar(año, semana_num, 7)
                s.fecha_cierre = fecha_base
                if not s.fecha_inicio:
                    s.fecha_inicio = fecha_base - timedelta(days=6)
            except Exception:
                continue
        # Asignar periodo cuya ventana contenga fecha_cierre
        for p in periodos:
            if p.fecha_inicio <= s.fecha_cierre <= p.fecha_fin:
                s.periodo_nomina_id = p.id
                actualizadas += 1
                break
    db.commit()
    print(f"      {actualizadas} semanas vinculadas")


def crear_admin_inicial(db):
    print("[5/5] Creando usuario admin inicial...")
    if db.query(models.Usuario).filter_by(username="admin").first():
        print("      [=] Usuario 'admin' ya existe")
        return
    pwd_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode("utf-8")
    db.add(models.Usuario(
        username="admin",
        password_hash=pwd_hash,
        nombre_completo="Administrador",
        rol="ADMIN",
        activo=True,
    ))
    db.commit()
    print("      [+] Usuario creado: admin / admin123 (cambiar en primer login)")


def main():
    print("=" * 60)
    print("MIGRACION V2 - Sistema de Bonificaciones")
    print("=" * 60)
    try:
        crear_tablas_nuevas()
        migrar_semanas()
        db = SessionLocal()
        try:
            sembrar_periodos_2026(db)
            vincular_semanas_a_periodos(db)
            crear_admin_inicial(db)
        finally:
            db.close()
        print("=" * 60)
        print("[OK] Migracion completada")
        print("=" * 60)
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
