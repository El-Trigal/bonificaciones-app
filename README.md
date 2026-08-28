# Sistema de Bonificaciones - Flores El Trigal

Sistema de liquidación de bonificaciones para la sede Manantiales. Reemplaza el proceso manual en Excel con trazabilidad completa.

## Requisitos

- **Python 3.10+** (único requisito para usuarios finales)
- Node.js 18+ (solo para desarrollo del frontend)

## Inicio rápido

### Windows
```
Doble clic en iniciar.bat
```

### Linux/Mac
```bash
chmod +x iniciar.sh
./iniciar.sh
```

El sistema abre automáticamente `http://localhost:8000` en el navegador.

## Estructura

```
bonificaciones-app/
├── backend/           # FastAPI + SQLAlchemy + SQLite
│   ├── main.py        # Punto de entrada
│   ├── models.py      # Modelos de base de datos
│   ├── services/      # Motor de cálculo y validador CSV
│   └── routers/       # Endpoints API
├── frontend/          # React 18 + Vite + Tailwind
│   ├── src/           # Código fuente
│   └── dist/          # Build compilado (incluido en repo)
├── data/              # Base de datos SQLite (auto-generada)
├── iniciar.bat        # Lanzador Windows
└── iniciar.sh         # Lanzador Linux/Mac
```

## Funcionalidades

- **Dashboard**: Resumen de bonificaciones por semana, KPIs, gráficos por líder
- **Carga de Datos**: Upload de CSV de rendimiento y labor específica con validación
- **Liquidaciones**: Consulta de resultados con filtros y paginación
- **Trazabilidad**: Desglose paso a paso de cada cálculo (cada peso rastreable)
- **Informes Gerenciales**: Cumplimiento de horas, calidad, eficiencia, festivos, evolución
- **Catálogos**: Gestión de empleados, labores, semanas, líderes, tipos de bonificación

## Motor de cálculo

Replica exactamente la lógica del Excel original:

1. **Producción semanal**: Suma de ramos y horas por día
2. **Verificación 83% horas**: Mínimo de horas ordinarias por semana
3. **Curva de calidad**: Multiplicador de 0% a 100% según % calidad (81%-90%)
4. **Unidades adicionales**: Producción sobre el mínimo requerido
5. **Bonificación**: Unidades adicionales × valor por unidad × calidad × calificación
6. **Adicionales**: Horas extra ordinarias, dominicales y tarea
7. **Redondeo**: A la centena más cercana (round -2)

## Desarrollo del frontend

```bash
cd frontend
npm install
npm run dev     # Servidor de desarrollo en :5173
npm run build   # Compilar para producción
```

## API

Documentación interactiva disponible en `http://localhost:8000/docs` (Swagger UI).
