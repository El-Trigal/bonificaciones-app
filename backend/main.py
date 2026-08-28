"""FastAPI principal — punto de entrada de la aplicación."""

import os
import sys

# Agregar directorio backend al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import engine, Base, SessionLocal
from seed import seed_database

# Crear tablas
Base.metadata.create_all(bind=engine)

# Seed de datos iniciales
db = SessionLocal()
try:
    seed_database(db)
finally:
    db.close()

app = FastAPI(
    title="Sistema de Bonificaciones - Flores El Trigal",
    description="Liquidación de bonificaciones - Sede Manantiales",
    version="1.0.0",
)

# CORS para desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Registrar routers ────────────────────────────────────
from routers import catalogos, cargas, liquidaciones, dashboard, informes, auditoria
from routers import auth as auth_router
from routers import plantillas as plantillas_router
from routers import registros_diarios as diarios_router
from routers import calidad as calidad_router
from routers import calculo as calculo_router
from routers import periodos as periodos_router
from routers import ajustes as ajustes_router

app.include_router(auth_router.router)
app.include_router(plantillas_router.router)
app.include_router(diarios_router.router)
app.include_router(calidad_router.router)
app.include_router(calculo_router.router)
app.include_router(periodos_router.router)
app.include_router(ajustes_router.router)
app.include_router(catalogos.router, prefix="/api/catalogos", tags=["Catálogos"])
app.include_router(cargas.router, prefix="/api/cargas", tags=["Cargas"])
app.include_router(liquidaciones.router, prefix="/api/liquidaciones", tags=["Liquidaciones"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(informes.router, prefix="/api/informes", tags=["Informes"])
app.include_router(auditoria.router, prefix="/api/auditoria", tags=["Auditoría"])


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "1.0.0", "sistema": "Bonificaciones Flores El Trigal"}


# ─── Servir frontend estático ──────────────────────────────
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
