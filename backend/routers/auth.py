"""Endpoints de autenticación y gestión de usuarios."""

import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from database import get_db
from models import Usuario, Sede
from services.auth import (
    COOKIE_NAME, PERMISOS, TOKEN_TTL_HOURS,
    crear_token, get_current_user, get_sede_activa,
    hash_password, requiere_permiso, verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

ROLES_VALIDOS = list(PERMISOS.keys())

# En producción (Render) las cookies deben ir con Secure+SameSite=None
# para funcionar cross-domain (Netlify → Render).
_IS_PROD = bool(os.environ.get("DATABASE_URL"))
_COOKIE_KWARGS = dict(
    httponly=True,
    secure=_IS_PROD,
    samesite="none" if _IS_PROD else "lax",
    max_age=TOKEN_TTL_HOURS * 3600,
    path="/",
)


class LoginIn(BaseModel):
    username: str
    password: str


class UsuarioOut(BaseModel):
    id: int
    username: str
    nombre_completo: str
    email: Optional[str] = None
    rol: str
    sede_id: Optional[int] = None
    sede_nombre: Optional[str] = None
    sede_activa_id: Optional[int] = None
    activo: bool
    ultimo_login: Optional[datetime] = None
    permisos: list[str] = []

    class Config:
        from_attributes = True


class UsuarioCreate(BaseModel):
    username: str
    password: str = Field(min_length=6)
    nombre_completo: str
    email: Optional[str] = None
    rol: str
    sede_id: Optional[int] = None  # NULL solo permitido para SUPER_ADMIN


class UsuarioUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    email: Optional[str] = None
    rol: Optional[str] = None
    sede_id: Optional[int] = None
    activo: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6)


def _to_out(u: Usuario, db: Session = None) -> UsuarioOut:
    sede_activa_id = getattr(u, "_sede_activa_id", u.sede_id)
    sede_nombre = u.sede.nombre if u.sede else None
    # Para SUPER_ADMIN que cambió de sede, buscar el nombre de la sede activa
    if sede_nombre is None and sede_activa_id and db:
        sede_activa = db.query(Sede).get(sede_activa_id)
        if sede_activa:
            sede_nombre = sede_activa.nombre
    return UsuarioOut(
        id=u.id,
        username=u.username,
        nombre_completo=u.nombre_completo,
        email=u.email,
        rol=u.rol,
        sede_id=u.sede_id,
        sede_nombre=sede_nombre,
        sede_activa_id=sede_activa_id,
        activo=u.activo,
        ultimo_login=u.ultimo_login,
        permisos=sorted(PERMISOS.get(u.rol, set())),
    )


@router.post("/login", response_model=UsuarioOut)
@limiter.limit("10/minute")
def login(request: Request, data: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter_by(username=data.username, activo=True).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    user.ultimo_login = datetime.utcnow()
    db.commit()
    token = crear_token(user)
    response.set_cookie(key=COOKIE_NAME, value=token, **_COOKIE_KWARGS)
    return _to_out(user, db)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        COOKIE_NAME, path="/",
        secure=_IS_PROD,
        samesite="none" if _IS_PROD else "lax",
    )
    return {"ok": True}


@router.get("/me", response_model=UsuarioOut)
def me(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return _to_out(user, db)


@router.post("/cambiar-sede/{sede_id}", response_model=UsuarioOut)
def cambiar_sede(
    sede_id: int,
    response: Response,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("cambiar_sede")),
):
    """Solo SUPER_ADMIN puede cambiar de sede activa sin re-login."""
    sede = db.query(Sede).filter_by(id=sede_id, activo=True).first()
    if not sede:
        raise HTTPException(status_code=404, detail="Sede no encontrada")
    token = crear_token(user, sede_activa_id=sede_id)
    response.set_cookie(key=COOKIE_NAME, value=token, **_COOKIE_KWARGS)
    user._sede_activa_id = sede_id
    return _to_out(user, db)


@router.get("/sedes")
def listar_sedes(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    """Lista las sedes activas. Disponible para cualquier usuario autenticado."""
    return [
        {"id": s.id, "nombre": s.nombre, "codigo": s.codigo}
        for s in db.query(Sede).filter_by(activo=True).order_by(Sede.nombre).all()
    ]


@router.get("/usuarios", response_model=list[UsuarioOut])
def listar_usuarios(
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("gestionar_usuarios")),
):
    q = db.query(Usuario)
    # ADMIN solo ve usuarios de su sede; SUPER_ADMIN ve todos
    if user.rol != "SUPER_ADMIN":
        q = q.filter_by(sede_id=get_sede_activa(user))
    return [_to_out(u, db) for u in q.order_by(Usuario.username).all()]


@router.post("/usuarios", response_model=UsuarioOut)
def crear_usuario(
    data: UsuarioCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("gestionar_usuarios")),
):
    if data.rol not in ROLES_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Rol inválido: {data.rol}")
    if data.rol == "SUPER_ADMIN" and user.rol != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Solo SUPER_ADMIN puede crear otro SUPER_ADMIN")
    if data.rol != "SUPER_ADMIN" and not data.sede_id:
        raise HTTPException(status_code=400, detail="sede_id es obligatorio para este rol")
    if db.query(Usuario).filter_by(username=data.username).first():
        raise HTTPException(status_code=409, detail="Username ya existe")

    # ADMIN solo puede crear usuarios en su propia sede
    sede_id = data.sede_id
    if user.rol == "ADMIN":
        sede_id = get_sede_activa(user)

    nuevo = Usuario(
        username=data.username,
        password_hash=hash_password(data.password),
        nombre_completo=data.nombre_completo,
        email=data.email,
        rol=data.rol,
        sede_id=sede_id,
        activo=True,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return _to_out(nuevo, db)


@router.patch("/usuarios/{user_id}", response_model=UsuarioOut)
def actualizar_usuario(
    user_id: int, data: UsuarioUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("gestionar_usuarios")),
):
    u = db.query(Usuario).get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # ADMIN solo puede modificar usuarios de su sede
    if user.rol == "ADMIN" and u.sede_id != get_sede_activa(user):
        raise HTTPException(status_code=403, detail="Sin acceso a este usuario")
    if data.rol is not None:
        if data.rol not in ROLES_VALIDOS:
            raise HTTPException(status_code=400, detail=f"Rol inválido: {data.rol}")
        if data.rol == "SUPER_ADMIN" and user.rol != "SUPER_ADMIN":
            raise HTTPException(status_code=403, detail="Solo SUPER_ADMIN puede asignar ese rol")
        u.rol = data.rol
    if data.nombre_completo is not None:
        u.nombre_completo = data.nombre_completo
    if data.email is not None:
        u.email = data.email
    if data.sede_id is not None and user.rol == "SUPER_ADMIN":
        u.sede_id = data.sede_id
    if data.activo is not None:
        u.activo = data.activo
    if data.password:
        u.password_hash = hash_password(data.password)
    db.commit()
    db.refresh(u)
    return _to_out(u, db)


@router.get("/permisos")
def matriz_permisos(_: Usuario = Depends(get_current_user)):
    return {rol: sorted(p) for rol, p in PERMISOS.items()}
