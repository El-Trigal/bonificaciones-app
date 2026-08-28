@echo off
echo ============================================
echo   Sistema de Bonificaciones - Flores El Trigal
echo   Sede Manantiales
echo ============================================
echo.
echo Verificando dependencias...
cd /d "%~dp0"
python -m pip install -r backend/requirements.txt --quiet 2>nul
if errorlevel 1 (
    echo [ERROR] No se pudo instalar las dependencias. Verifica que Python este instalado.
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas
echo.
echo Iniciando servidor...
start "" python backend/main.py
timeout /t 3 /nobreak > nul
start "" http://localhost:8000
echo.
echo ============================================
echo   Sistema iniciado en http://localhost:8000
echo   Cierra esta ventana para detener el servidor
echo ============================================
pause
