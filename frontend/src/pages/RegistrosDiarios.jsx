import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Save, Trash2, Plus, AlertTriangle, CalendarDays, User, Wrench } from 'lucide-react';
import api from '../store/api';
import Modal from '../components/shared/Modal';
import SemanaSelect from '../components/shared/SemanaSelect';
import ColumnFilter from '../components/shared/ColumnFilter';
import ComboBox from '../components/shared/ComboBox';

// ─── Helpers de fecha / semana ────────────────────────────────────────────────

/** Computa semana ISO 'YYYY-WW' a partir de una fecha 'YYYY-MM-DD'. */
function isoSemana(fechaStr) {
  if (!fechaStr) return '';
  const d = new Date(fechaStr + 'T12:00:00');
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

function esDomingo(fechaStr) {
  if (!fechaStr) return false;
  return new Date(fechaStr + 'T12:00:00').getDay() === 0;
}

// ─── Campos numéricos del formulario ─────────────────────────────────────────

const CAMPOS = [
  { key: 'tallos',               label: 'Tallos',     group: 'produccion' },
  { key: 'ramos',                label: 'Ramos',      group: 'produccion' },
  { key: 'horas_ordinarias',     label: 'H. Ord',     group: 'horas', festivoBlock: true },
  { key: 'horas_extra_ordinarias', label: 'HE. Ord',  group: 'horas' },
  { key: 'horas_dominicales',    label: 'H. Dom',     group: 'horas' },
  { key: 'unidades_tarea',       label: 'Ud. Tarea',  group: 'tarea' },
  { key: 'horas_tarea',          label: 'H. Tarea',   group: 'tarea' },
];

const CAMPOS_TABLA = CAMPOS.map(c => c.key);

const NUEVO_VACIO = {
  fecha: '', codigo_colaborador: '', nombre_colaborador: '',
  labor: '', lider: '',
  tallos: '', ramos: '', horas_ordinarias: '', horas_extra_ordinarias: '',
  horas_dominicales: '', unidades_tarea: '', horas_tarea: '',
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RegistrosDiarios() {
  // ── Catálogos ──
  const [labores, setLabores] = useState([]);
  const [lideres, setLideres] = useState([]);
  const [festivosCache, setFestivosCache] = useState({});

  // ── Tabla ──
  const [semana, setSemana] = useState('');
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState({});
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');

  // ── Filtros de tabla ──
  const [filtroFecha, setFiltroFecha] = useState([]);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroLabor, setFiltroLabor] = useState('');
  const [filtroLider, setFiltroLider] = useState('');

  // ── Modal ──
  const [modal, setModal] = useState(false);
  const [nuevo, setNuevo] = useState(NUEVO_VACIO);
  const [semanaInfo, setSemanaInfo] = useState(null); // {codigo, esFestivo, esDomingo}
  const [laborSel, setLaborSel] = useState(null);    // objeto labor del catálogo
  const [empleadosOpts, setEmpleadosOpts] = useState([]);
  const [buscandoEmp, setBuscandoEmp] = useState(false);
  const [modalError, setModalError] = useState('');
  const [comboKey, setComboKey] = useState(0);       // fuerza reset de combobox empleado
  const debounceRef = useRef(null);

  // ─── Cargar catálogos al montar ───────────────────────────────────────────

  useEffect(() => {
    api.get('/catalogos/labores-rendimiento', { params: { activo: true } })
      .then(r => setLabores(r.data))
      .catch(() => {});
    api.get('/catalogos/lideres', { params: { activo: true } })
      .then(r => setLideres(r.data))
      .catch(() => {});
  }, []);

  // ─── Auto-buscar al cambiar semana ───────────────────────────────────────

  useEffect(() => {
    if (semana) buscar();
    else { setRegistros([]); setEditando({}); }
  }, [semana]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Opciones de selectores ───────────────────────────────────────────────

  const laborOpciones = useMemo(() =>
    labores.map(l => ({
      value: l.id,
      label: l.nombre,
      sublabel: l.lider_nombre || '',
      meta: null,
      _obj: l,
    })),
  [labores]);

  const opcionesFecha = useMemo(() =>
    [...new Set(registros.map(r => r.fecha))].sort(),
  [registros]);

  // ─── Festivos ─────────────────────────────────────────────────────────────

  const getFestivos = useCallback(async (año) => {
    if (festivosCache[año]) return festivosCache[año];
    try {
      const { data } = await api.get('/catalogos/festivos', { params: { año } });
      setFestivosCache(prev => ({ ...prev, [año]: data }));
      return data;
    } catch {
      return [];
    }
  }, [festivosCache]);

  // ─── Cambio de fecha en modal ─────────────────────────────────────────────

  async function handleFechaChange(fecha) {
    setNuevo(prev => ({ ...prev, fecha, horas_ordinarias: '' }));
    if (!fecha) { setSemanaInfo(null); return; }

    const año = parseInt(fecha.slice(0, 4));
    const semCodigo = isoSemana(fecha);
    const festivos = await getFestivos(año);
    const esFest = festivos.includes(fecha);
    const esDom  = esDomingo(fecha);
    setSemanaInfo({ codigo: semCodigo, esFestivo: esFest, esDomingo: esDom });
  }

  // ─── Búsqueda de empleados (debounced) ────────────────────────────────────

  function buscarEmpleados(query) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) { setEmpleadosOpts([]); return; }
    setBuscandoEmp(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/catalogos/empleados', {
          params: { buscar: query, activo: true },
        });
        setEmpleadosOpts(data.map(e => ({
          value: e.id,
          label: e.nombre,
          meta: e.codigo,
          _obj: e,
        })));
      } catch {
        setEmpleadosOpts([]);
      } finally {
        setBuscandoEmp(false);
      }
    }, 280);
  }

  function handleEmpleadoSelect(opt) {
    if (!opt) {
      setNuevo(prev => ({ ...prev, codigo_colaborador: '', nombre_colaborador: '' }));
      return;
    }
    setNuevo(prev => ({
      ...prev,
      codigo_colaborador: opt._obj.codigo,
      nombre_colaborador: opt._obj.nombre,
    }));
  }

  function handleLaborSelect(opt) {
    if (!opt) {
      setLaborSel(null);
      setNuevo(prev => ({ ...prev, labor: '', lider: '' }));
      return;
    }
    setLaborSel(opt._obj);
    setNuevo(prev => ({
      ...prev,
      labor: opt._obj.nombre,
      lider: opt._obj.lider_nombre || '',
    }));
  }

  // Auto-calcular ramos si la labor usa tallos
  function handleTallosChange(val) {
    const tallos = val === '' ? '' : parseFloat(val) || 0;
    let ramos = nuevo.ramos;
    if (tallos !== '' && laborSel?.tallos_por_ramo > 1) {
      ramos = +(tallos / laborSel.tallos_por_ramo).toFixed(3);
    }
    setNuevo(prev => ({ ...prev, tallos, ramos }));
  }

  // ─── Tabla: buscar, editar, guardar, eliminar ─────────────────────────────

  async function buscar() {
    if (!semana) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/registros-diarios', { params: { semana } });
      setRegistros(data);
      setEditando({});
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al buscar');
    } finally {
      setLoading(false);
    }
  }

  function editarCampo(id, campo, valor) {
    setEditando(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [campo]: valor === '' ? 0 : parseFloat(valor) || 0 },
    }));
  }

  async function guardarFila(id) {
    const cambios = editando[id];
    if (!cambios) return;
    setSaving(id);
    try {
      await api.patch(`/registros-diarios/${id}`, cambios);
      setRegistros(prev => prev.map(r => r.id === id ? { ...r, ...cambios } : r));
      setEditando(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(null);
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      await api.delete(`/registros-diarios/${id}`);
      setRegistros(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al eliminar');
    }
  }

  // ─── Modal: abrir, guardar, guardar-y-otro ────────────────────────────────

  function abrirModal() {
    setNuevo(NUEVO_VACIO);
    setSemanaInfo(null);
    setLaborSel(null);
    setEmpleadosOpts([]);
    setModalError('');
    setComboKey(k => k + 1);
    setModal(true);
  }

  function cerrarModal() {
    setModal(false);
    setSemanaInfo(null);
    setLaborSel(null);
  }

  async function crearRegistro() {
    setModalError('');
    const payload = {
      fecha: nuevo.fecha,
      codigo_colaborador: parseInt(nuevo.codigo_colaborador) || 0,
      nombre_colaborador: nuevo.nombre_colaborador,
      labor: nuevo.labor,
      tallos:                  parseFloat(nuevo.tallos)                  || 0,
      ramos:                   parseFloat(nuevo.ramos)                   || 0,
      horas_ordinarias:        parseFloat(nuevo.horas_ordinarias)        || 0,
      horas_extra_ordinarias:  parseFloat(nuevo.horas_extra_ordinarias)  || 0,
      horas_dominicales:       parseFloat(nuevo.horas_dominicales)       || 0,
      unidades_tarea:          parseFloat(nuevo.unidades_tarea)          || 0,
      horas_tarea:             parseFloat(nuevo.horas_tarea)             || 0,
    };
    try {
      await api.post('/registros-diarios', payload);
      return true;
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Error al guardar');
      return false;
    }
  }

  async function guardar() {
    if (!await crearRegistro()) return;
    cerrarModal();
    await buscar();
  }

  async function guardarYOtro() {
    if (!await crearRegistro()) return;
    // Conservar fecha, colaborador, labor y lider — solo limpiar valores numéricos
    setNuevo(prev => ({
      ...prev,
      tallos: '', ramos: '', horas_ordinarias: '',
      horas_extra_ordinarias: '', horas_dominicales: '',
      unidades_tarea: '', horas_tarea: '',
    }));
    setModalError('');
  }

  // ─── Filtrado de tabla ────────────────────────────────────────────────────

  const registrosFiltrados = useMemo(() => {
    const fFecha  = new Set(filtroFecha);
    const nombre  = filtroNombre.toLowerCase().trim();
    const labor   = filtroLabor.toLowerCase().trim();
    const lider   = filtroLider.toLowerCase().trim();
    return registros.filter(r => {
      if (fFecha.size && !fFecha.has(r.fecha)) return false;
      if (nombre && !r.nombre_colaborador.toLowerCase().includes(nombre)) return false;
      if (labor  && !r.labor.toLowerCase().includes(labor))  return false;
      if (lider  && !r.lider.toLowerCase().includes(lider))  return false;
      return true;
    });
  }, [registros, filtroFecha, filtroNombre, filtroLabor, filtroLider]);

  const hayFiltros = filtroFecha.length > 0 || filtroNombre || filtroLabor || filtroLider;

  function limpiarFiltros() {
    setFiltroFecha([]);
    setFiltroNombre('');
    setFiltroLabor('');
    setFiltroLider('');
  }

  // ─── Estado festivo/domingo para el modal ─────────────────────────────────

  const bloqueaHOrd = semanaInfo?.esFestivo || semanaInfo?.esDomingo;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>

      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registros diarios</h1>
          <p className="text-sm text-gray-500">Consolidación diaria por colaborador y labor</p>
        </div>
        <button
          onClick={abrirModal}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl
                     hover:bg-primary-dark font-medium touch-manipulation"
        >
          <Plus size={18} /> Nuevo manual
        </button>
      </div>

      {/* Barra de búsqueda por semana */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">Semana</label>
          <SemanaSelect value={semana} onChange={setSemana} className="w-full" />
        </div>
        {loading && (
          <span className="text-sm text-gray-400 self-center">Cargando...</span>
        )}
        <div className="text-sm text-gray-500 ml-auto self-center">
          {registrosFiltrados.length} de {registros.length} registros
          {hayFiltros && (
            <button onClick={limpiarFiltros} className="ml-3 text-xs text-primary hover:underline">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Filtros rápidos de tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-4
                      flex flex-wrap gap-2 items-center">
        <span className="text-xs font-medium text-gray-500 mr-1">Filtrar:</span>
        <input
          type="text"
          placeholder="Nombre..."
          value={filtroNombre}
          onChange={e => setFiltroNombre(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-48
                     focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
        />
        <input
          type="text"
          placeholder="Labor..."
          value={filtroLabor}
          onChange={e => setFiltroLabor(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-48
                     focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
        />
        <input
          type="text"
          placeholder="Líder..."
          value={filtroLider}
          onChange={e => setFiltroLider(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-40
                     focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
        />
      </div>

      {error && (
        <div className="mb-3 bg-red-50 text-red-700 px-4 py-2.5 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left whitespace-nowrap">
                  <ColumnFilter
                    label="Fecha"
                    options={opcionesFecha}
                    selected={filtroFecha}
                    onChange={setFiltroFecha}
                  />
                </th>
                <th className="px-3 py-2.5 text-left">Código</th>
                <th className="px-3 py-2.5 text-left">Nombre</th>
                <th className="px-3 py-2.5 text-left">Labor</th>
                <th className="px-3 py-2.5 text-left">Líder</th>
                {CAMPOS.map(c => (
                  <th key={c.key} className="px-2 py-2.5 text-right whitespace-nowrap">{c.label}</th>
                ))}
                <th className="px-3 py-2.5 text-center">Origen</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {registrosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6 + CAMPOS.length + 2} className="px-4 py-10 text-center text-gray-400">
                    {semana
                      ? registros.length === 0
                        ? 'Sin registros para esta semana'
                        : 'Sin resultados con los filtros aplicados'
                      : 'Selecciona una semana y haz clic en Buscar'}
                  </td>
                </tr>
              ) : registrosFiltrados.map(r => {
                const dirty = !!editando[r.id];
                return (
                  <tr key={r.id} className={dirty ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.fecha}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-500">{r.codigo_colaborador}</td>
                    <td className="px-3 py-1.5 max-w-[180px] truncate">{r.nombre_colaborador}</td>
                    <td className="px-3 py-1.5 max-w-[150px] truncate">{r.labor}</td>
                    <td className="px-3 py-1.5 text-gray-500 max-w-[120px] truncate">{r.lider}</td>
                    {CAMPOS.map(c => (
                      <td key={c.key} className="px-1 py-1 text-right">
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          defaultValue={r[c.key]}
                          onChange={e => editarCampo(r.id, c.key, e.target.value)}
                          className="w-20 px-1.5 py-0.5 text-right border border-gray-200 rounded text-xs
                                     focus:outline-none focus:border-primary"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-center">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium
                        ${r.origen === 'MANUAL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                        {r.origen}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {dirty && (
                        <button onClick={() => guardarFila(r.id)} disabled={saving === r.id}
                          className="text-green-700 hover:text-green-800 mr-2 disabled:opacity-50">
                          <Save size={14} />
                        </button>
                      )}
                      <button onClick={() => eliminar(r.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal nuevo registro ── */}
      {modal && (
        <Modal isOpen title="Nuevo registro manual" onClose={cerrarModal}>
          <div className="space-y-5 max-w-lg">

            {/* Fecha + Semana */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={15} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">Fecha</span>
              </div>
              <input
                type="date"
                value={nuevo.fecha}
                onChange={e => handleFechaChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
              {/* Auto-semana */}
              {semanaInfo && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary
                                   text-xs font-semibold px-3 py-1 rounded-full">
                    <CalendarDays size={11} />
                    Semana {semanaInfo.codigo}
                  </span>
                  {semanaInfo.esFestivo && (
                    <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700
                                     text-xs font-semibold px-3 py-1 rounded-full">
                      <AlertTriangle size={11} />
                      Festivo — sin H. Ordinarias
                    </span>
                  )}
                  {!semanaInfo.esFestivo && semanaInfo.esDomingo && (
                    <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700
                                     text-xs font-semibold px-3 py-1 rounded-full">
                      <AlertTriangle size={11} />
                      Domingo — sin H. Ordinarias
                    </span>
                  )}
                </div>
              )}
            </section>

            {/* Colaborador */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <User size={15} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">Colaborador</span>
                {nuevo.codigo_colaborador && (
                  <span className="ml-auto font-mono text-xs text-gray-400">
                    #{nuevo.codigo_colaborador}
                  </span>
                )}
              </div>
              <ComboBox
                key={comboKey}
                placeholder="Buscar por nombre o código..."
                options={empleadosOpts}
                onSearch={buscarEmpleados}
                onSelect={handleEmpleadoSelect}
                loading={buscandoEmp}
              />
              {nuevo.nombre_colaborador && (
                <p className="mt-1.5 text-xs text-gray-500 pl-1">
                  {nuevo.nombre_colaborador}
                </p>
              )}
            </section>

            {/* Labor */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Wrench size={15} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">Labor</span>
              </div>
              <ComboBox
                placeholder="Buscar labor..."
                options={laborOpciones}
                onSelect={handleLaborSelect}
                displayValue={nuevo.labor}
              />
              {nuevo.lider && (
                <p className="mt-1.5 text-xs text-gray-500 pl-1 flex items-center gap-1">
                  <span className="text-gray-400">Líder:</span>
                  <span className="font-medium">{nuevo.lider}</span>
                </p>
              )}
            </section>

            {/* Producción */}
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Producción
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tallos</label>
                  <input
                    type="number" step="any" inputMode="decimal" min="0"
                    value={nuevo.tallos}
                    onChange={e => handleTallosChange(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Ramos
                    {laborSel?.tallos_por_ramo > 1 && (
                      <span className="ml-1 text-gray-400">(auto)</span>
                    )}
                  </label>
                  <input
                    type="number" step="any" inputMode="decimal" min="0"
                    value={nuevo.ramos}
                    onChange={e => setNuevo(p => ({ ...p, ramos: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>
            </section>

            {/* Horas */}
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Horas
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`block text-xs mb-1 ${bloqueaHOrd ? 'text-gray-300' : 'text-gray-600'}`}>
                    H. Ordinarias
                  </label>
                  <input
                    type="number" step="any" inputMode="decimal" min="0"
                    value={bloqueaHOrd ? '' : nuevo.horas_ordinarias}
                    disabled={bloqueaHOrd}
                    onChange={e => setNuevo(p => ({ ...p, horas_ordinarias: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                               disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed
                               disabled:border-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">HE. Ordinarias</label>
                  <input
                    type="number" step="any" inputMode="decimal" min="0"
                    value={nuevo.horas_extra_ordinarias}
                    onChange={e => setNuevo(p => ({ ...p, horas_extra_ordinarias: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">H. Dominicales</label>
                  <input
                    type="number" step="any" inputMode="decimal" min="0"
                    value={nuevo.horas_dominicales}
                    onChange={e => setNuevo(p => ({ ...p, horas_dominicales: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>
              {bloqueaHOrd && (
                <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  {semanaInfo?.esFestivo ? 'Festivo' : 'Domingo'}: usa H. Dominicales para registrar trabajo de este día.
                </p>
              )}
            </section>

            {/* Tarea */}
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Tarea
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Unidades tarea</label>
                  <input
                    type="number" step="any" inputMode="decimal" min="0"
                    value={nuevo.unidades_tarea}
                    onChange={e => setNuevo(p => ({ ...p, unidades_tarea: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Horas tarea</label>
                  <input
                    type="number" step="any" inputMode="decimal" min="0"
                    value={nuevo.horas_tarea}
                    onChange={e => setNuevo(p => ({ ...p, horas_tarea: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>
            </section>

            {/* Error */}
            {modalError && (
              <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm
                              flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                {modalError}
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={cerrarModal}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm
                           font-medium text-gray-600 hover:bg-gray-50 touch-manipulation"
              >
                Cancelar
              </button>
              <button
                onClick={guardarYOtro}
                className="flex-1 px-4 py-3 border border-primary text-primary rounded-xl text-sm
                           font-medium hover:bg-primary/5 touch-manipulation"
              >
                + Otro
              </button>
              <button
                onClick={guardar}
                className="flex-1 bg-primary text-white px-4 py-3 rounded-xl text-sm
                           font-medium hover:bg-primary-dark touch-manipulation"
              >
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
