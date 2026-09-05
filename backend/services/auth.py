"""Autenticación JWT + matriz de permisos por rol."""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database import get_db
from models import Usuario

SECRET_KEY = os.environ.get("BONIF_SECRET", "change-me-in-prod-please-a-long-random-string")
ALGORITHM = "HS256"
TOKEN_TTL_HOURS = 2
COOKIE_NAME = "bonif_token"


# Roles que pueden operar en múltiples sedes (no tienen sede_id fijo)
ROLES_MULTISEDE = {"SUPER_ADMIN", "LECTOR_GLOBAL"}

# Matriz de permisos por rol
PERMISOS = {
    "SUPER_ADMIN": {
        "cargar_archivos", "editar_registros", "ejecutar_calculo",
        "ver_dashboard", "ver_liquidaciones", "ver_trazabilidad", "ver_informes",
        "editar_catalogos",
        "cerrar_periodo", "marcar_pagado", "aprobar_retroactivos",
        "gestionar_usuarios", "auditoria_completa",
        "gestionar_sedes", "cambiar_sede",
        "descargar_todas_sedes",
    },
    "LECTOR_GLOBAL": {
        # Solo lectura, acceso a todas las sedes mediante SedeSwitcher
        "ver_dashboard", "ver_liquidaciones", "ver_trazabilidad", "ver_informes",
        "cambiar_sede", "descargar_todas_sedes",
    },
    "ADMIN": {
        "cargar_archivos", "editar_registros", "ejecutar_calculo",
        "ver_dashboard", "ver_liquidaciones", "ver_trazabilidad", "ver_informes",
        "editar_catalogos",
        "cerrar_periodo", "marcar_pagado", "aprobar_retroactivos",
        "gestionar_usuarios", "auditoria_completa",
    },
    "AUXILIAR": {
        "cargar_archivos", "editar_registros", "ejecutar_calculo",
        "ver_dashboard", "ver_liquidaciones", "ver_trazabilidad", "ver_informes",
        "editar_catalogos",
    },
    "NOMINA": {
        "cargar_archivos", "editar_registros", "ejecutar_calculo",
        "ver_dashboard", "ver_liquidaciones", "ver_trazabilidad", "ver_informes",
        "editar_catalogos",
        "cerrar_periodo", "marcar_pagado", "aprobar_retroactivos",
    },
    "OPERARIO": {
        "ingresar_datos",
    },
}


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def crear_token(usuario: Usuario, sede_activa_id: Optional[int] = None) -> str:
    """
    Genera el JWT. Para SUPER_ADMIN, sede_activa_id indica la sede en contexto
    (None = sin sede seleccionada aún). Para los demás roles, sede_activa_id
    siempre es el sede_id fijo del usuario.
    """
    effective_sede = sede_activa_id if sede_activa_id is not None else usuario.sede_id
    payload = {
        "sub": str(usuario.id),
        "username": usuario.username,
        "rol": usuario.rol,
        "sede_id": usuario.sede_id,          # sede real del usuario (NULL para SUPER_ADMIN)
        "sede_activa_id": effective_sede,     # sede en contexto para filtrar queries
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decodificar_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> Usuario:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    payload = decodificar_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    user = db.query(Usuario).filter_by(id=int(payload["sub"]), activo=True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")
    # Adjunta la sede activa al objeto usuario para que los routers puedan usarla
    user._sede_activa_id = payload.get("sede_activa_id")
    return user


def get_sede_activa(user: Usuario) -> int:
    """Devuelve el sede_id en contexto para filtrar queries.
    Lanza 400 si el usuario multi-sede no ha seleccionado una sede activa.
    """
    sede = getattr(user, "_sede_activa_id", user.sede_id)
    if sede is None:
        raise HTTPException(
            status_code=400,
            detail="Debes seleccionar una sede antes de continuar. "
                   "Usa el selector de sede en el menú lateral.",
        )
    return sede


def requiere_permiso(permiso: str):
    def _check(user: Usuario = Depends(get_current_user)) -> Usuario:
        if permiso not in PERMISOS.get(user.rol, set()):
            raise HTTPException(status_code=403, detail=f"Sin permiso: {permiso}")
        return user
    return _check
