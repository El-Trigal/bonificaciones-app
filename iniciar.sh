#!/bin/bash
echo "============================================"
echo "  Sistema de Bonificaciones - Flores El Trigal"
echo "  Sede Manantiales"
echo "============================================"
echo ""
echo "Verificando dependencias..."
cd "$(dirname "$0")"
python3 -m pip install -r backend/requirements.txt --quiet 2>/dev/null
echo "[OK] Dependencias instaladas"
echo ""
echo "Iniciando servidor..."
python3 backend/main.py &
SERVER_PID=$!
sleep 3
xdg-open http://localhost:8000 2>/dev/null || open http://localhost:8000 2>/dev/null
echo ""
echo "============================================"
echo "  Sistema iniciado en http://localhost:8000"
echo "  Presiona Ctrl+C para detener el servidor"
echo "============================================"
wait $SERVER_PID
