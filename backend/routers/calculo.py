"""Ejecución manual del cálculo de bonificaciones por semana."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Usuario
from services.auth import get_sede_activa, requiere_permiso
from services.calculador_v2 import ejecutar_calculo_semana

router = APIRouter(prefix="/api/calculo", tags=["Cálculo"])


class EjecutarIn(BaseModel):
    semana: str


@router.post("/ejecutar")
def ejecutar(
    data: EjecutarIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(requiere_permiso("ejecutar_calculo")),
):
    sede_id = get_sede_activa(user)
    if not sede_id:
        raise HTTPException(400, "Debes seleccionar una sede antes de ejecutar el cálculo")
    try:
        return ejecutar_calculo_semana(db, data.semana, user.username, sede_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
