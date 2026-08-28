# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Local-first web app that replaces an Excel-based bonification (bonificaciones) liquidation process for **Flores El Trigal, sede Manantiales**. The whole system runs from a single Python process: FastAPI serves both the JSON API and the pre-built React SPA from `frontend/dist/`. End users only need Python installed; Node is only for frontend dev.

All domain language and identifiers are in Spanish (semanas, liquidaciones, labores, líderes, calidad, etc.) — keep new code consistent.

## Common commands

### Run the app (production-style, served on :8000)
- Windows: double-click `iniciar.bat` (installs deps, launches `backend/main.py`, opens browser)
- Linux/Mac: `./iniciar.sh`
- Direct: `python backend/main.py`

### Frontend development (hot reload on :5173, proxies `/api` to :8000)
```
cd frontend
npm install
npm run dev
npm run build      # produces frontend/dist/ that backend serves
```
The backend only serves the SPA if `frontend/dist/` exists (see `backend/main.py:73`). After UI changes intended for production, you must `npm run build` — `dist/` is committed to the repo on purpose so end users don't need Node.

### Backend dependencies
```
python -m pip install -r backend/requirements.txt
```

### One-time schema migration (V2 features: periodos nómina, registros diarios, usuarios, etc.)
```
python backend/migracion_v2.py
```
Idempotent. Creates the initial admin user (`admin` / `admin123`). There is no test suite or linter configured.

## Architecture

### Backend (`backend/`)
- **`main.py`** — FastAPI entry point. Calls `Base.metadata.create_all` (so adding a model on a fresh DB just works) and runs `seed.py` if catalog tables are empty. Mounts `frontend/dist/` at `/` after registering all `/api/*` routers.
- **`database.py`** — SQLite at `data/bonificaciones.db`, WAL mode + foreign keys enabled via a `connect` event listener. `get_db()` is the FastAPI dependency.
- **`models.py`** — single-file SQLAlchemy schema. Two parallel data flows coexist (see "Two calculation engines" below):
  - Legacy weekly: `RegistroRendimiento` / `RegistroLaborEspecifica` (one row per colaborador-semana with 7 day-columns).
  - V2 daily: `RegistroDiario` + `RegistroCalidad` (one row per colaborador-labor-día).
  - Output: `Liquidacion` (one row per colaborador-semana-labor-tipo, with full narrative JSON) + `PasoCalculo` (step-by-step trace for the traceability modal).
  - `LaborRendimiento.recalcular_valores()` derives `costo_estandar_tallo/ramo` and `valor_unidad_colaborador/apoyo` from base salary params — call it after editing any salary/percentage field.
- **`routers/`** — one router per resource (`catalogos`, `cargas`, `liquidaciones`, `dashboard`, `informes`, `auditoria`, `auth`, `plantillas`, `registros_diarios`, `calidad`, `calculo`, `periodos`, `ajustes`). Note inconsistent prefixing: some routers set their own prefix internally (auth, plantillas, etc., included with no prefix in `main.py`); others are included with `prefix="/api/..."`. Match the existing pattern of whichever router you're extending.
- **`services/`** — business logic, kept out of routers:
  - `calculador.py` — legacy engine. `calcular_bonif_rendimiento(registro, labor, db)` returns a dict of every intermediate value (totals, 83%-horas check, calidad multiplier, unidades adicionales, bonificaciones extra/dominical/tarea, total). `obtener_multiplicador_calidad` encodes the calidad curve (<0.81 → 0; 0.81–0.89 → linear; ≥0.90 → 1.0).
  - `calculador_v2.py` — newer engine. Consolidates `RegistroDiario` rows into a `SimpleNamespace` shaped like a `RegistroRendimiento` and **reuses** `calcular_bonif_rendimiento` from `calculador.py`. When fixing calculation logic, fix it in `calculador.py` so both engines benefit.
  - `validador_csv.py` — row-by-row CSV validation; caches catalog lookups before iterating.
  - `parser_generico.py` / `parser_calidad.py` — driven by `PlantillaCarga` configs (JSON column mappings, `unidad_origen` TALLOS|RAMOS).
  - `utils_semana.py` — `normalizar_codigo_semana` — use it whenever a `semana` string crosses a boundary.
  - `auth.py` — JWT in an HttpOnly cookie (`bonif_token`) with bearer fallback. Secret from env `BONIF_SECRET`. The `PERMISOS` matrix is the source of truth for role-based access — both backend (`requiere_permiso(...)` dependency) and frontend (`<RequireAuth permiso="..."/>`) reference these same permission strings.

### Frontend (`frontend/src/`)
- **`App.jsx`** — every route is wrapped in `<RequireAuth permiso="...">`. Permission strings must match the backend `PERMISOS` matrix in `services/auth.py`.
- **`store/api.js`** — single axios instance, `baseURL: '/api'`, `withCredentials: true` (auth cookie). Vite proxies `/api` → `:8000` in dev.
- **`store/authStore.js`, `appStore.js`** — Zustand stores. `App.jsx` calls `fetchMe()` on mount to restore the session from the cookie.
- **`pages/`** — one page per top-level route. Shared building blocks live in `components/{ui,shared,auth,layout,calidad}`.
- Stack: React 18 + Vite, React Router 6, Zustand, TanStack Table v8, Recharts, Tailwind, lucide-react icons.

### Calculation domain (single source of truth: `services/calculador.py`)
The engine replicates the Excel exactly. Order matters and is encoded in `PasoCalculo` columns:
1. Sum ramos / horas ordinarias / horas extra over the 7 day-columns.
2. Verify ≥83% of `Semana.horas_ordinarias` worked.
3. Apply `obtener_multiplicador_calidad(pct_calidad)`.
4. `unidades_requeridas = horas_laboradas × rendimiento_min_hora`; subtract to get `unidades_adicionales`.
5. `bonif_rendimiento = unidades_adicionales × valor_unidad_colaborador × multiplicador_calidad × pct_calificacion_colaborador`.
6. Add HE ordinaria, HE dominical, tarea bonifs.
7. Round total to nearest hundred (`round -2`).
If you change any step, also update the narrative JSON written into `Liquidacion.detalle_calculo_narrativo` (used by the traceability modal) and the matching `PasoCalculo` columns — the UI reads from those.

### Two calculation engines — when to use which
- **V2 (`calculador_v2.py` + `RegistroDiario` + `routers/calculo.py`)** is the current flow for newly uploaded data — preferred for any new feature.
- **Legacy (`calculador.py` + `RegistroRendimiento` + `routers/liquidaciones.py`)** still backs older data and is the underlying compute kernel both engines call.
Check which tables the data lives in before assuming which path runs. When in doubt, modify `calculador.py` (kernel) rather than `calculador_v2.py` (adapter).

### Periodos de nómina & ajustes retroactivos
Colombian quincenal periods (`PeriodoNomina`, codes like `2026-04-Q2`). A `Semana` belongs to one period. Once a period is `PAGADO`, recalculating one of its weeks produces an `AjusteRetroactivo` rather than overwriting the paid liquidation — that record then applies in a later period. Don't mutate liquidations in paid periods directly.

## Conventions

- Domain language: Spanish for tables, columns, variables, routes, and UI strings. Don't translate identifiers when editing.
- Money fields: always pesos as `Float`. Final totals are rounded to nearest 100 (`round(x, -2)`).
- New schemas: prefer adding to `models.py` and letting `Base.metadata.create_all` pick them up on next start. For column additions on shipped tables, extend `migracion_v2.py` (use `agregar_columna_si_falta`) rather than dropping the DB.
- Permission gating: add the string to `PERMISOS` in `backend/services/auth.py`, depend on `requiere_permiso("...")` in the router, and reference the same string from `<RequireAuth permiso="...">` in the frontend.
- Don't commit anything in `data/` (SQLite + WAL files + `uploads/`) — that's user data.
