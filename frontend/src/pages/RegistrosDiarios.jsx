import { useEffect, useMemo, useState } from 'react';
import { Search, Save, Trash2, Plus } from 'lucide-react';
import api from '../store/api';
import Modal from '../components/shared/Modal';
import SemanaSelect from '../components/shared/SemanaSelect';
import ColumnFilter from '../components/shared/ColumnFilter';

const CAMPOS = [
  { key: 'tallos', label: 'Tallos' },
  { key: 'ramos', label: 'Ramos' },
  { key: 'horas_ordinarias', label: 'H.Ord' },
  { key: 'horas_extra_ordinarias', label: 'HE.Ord' },
  { key: 'horas_dominicales', label: 'H.Dom' },
  { key: 'unidades_tarea', label: 'Ud.Tarea' },
  { key: 'horas_tarea', label: 'H.Tarea' },
];

export default function RegistrosDiarios() {
  const [semana, setSemana] = useState('');
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState({}); // id -> valores editados
  const [saving, setSaving] = useState(null);
  const [nuevoModal, setNuevoModal] = useState(false);
  const [nuevo, setNuevo] = useState({});
  const [error, setError] = useState('');
  const [filtros, setFiltros] = useState({ fecha: [], codigo: [], nombre: [], labor: [], lider: [] });

  const opciones = useMemo(() => ({
    fecha: [...new Set(registros.map(r => r.fecha))].sort(),
    codigo: [...new Set(registros.map(r => r.codigo_colaborador))].sort((a, b) => a - b),
    nombre: [...new Set(registros.map(r => r.nombre_colaborador))].sort(),
    labor: [...new Set(registros.map(r => r.labor))].sort(),
    lider: [...new Set(registros.map(r => r.lider))].sort(),
  }), [registros]);

  const registrosFiltrados = useMemo(() => {
    const sets = {
      fecha: new Set(filtros.fecha),
      codigo: new Set(filtros.codigo),
      nombre: new Set(filtros.nombre),
      labor: new Set(filtros.labor),
      lider: new Set(filtros.lider),
    };
    return registros.filter(r => {
      if (sets.fecha.size && !sets.fecha.has(r.fecha)) return false;
      if (sets.codigo.size && !sets.codigo.has(r.codigo_colaborador)) return false;
      if (sets.nombre.size && !sets.nombre.has(r.nombre_colaborador)) return false;
      if (sets.labor.size && !sets.labor.has(r.labor)) return false;
      if (sets.lider.size && !sets.lider.has(r.lider)) return false;
      return true;
    });
  }, [registros, filtros]);

  const totalFiltros = Object.values(filtros).reduce((a, arr) => a + arr.length, 0);

  async function buscar() {
    if (!semana) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/registros-diarios', { params: { semana } });
      setRegistros(data);
      setEditando({});
    } catch (err) {
      setError(err.response?.data?.detail || 'Error');
    } finally {
      setLoading(false);
    }
  }

  function editarCampo(id, campo, valor) {
    setEditando((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [campo]: valor === '' ? 0 : parseFloat(valor) || 0 },
    }));
  }

  async function guardar(id) {
    const cambios = editando[id];
    if (!cambios) return;
    setSaving(id);
    try {
      await api.patch(`/registros-diarios/${id}`, cambios);
      setRegistros((prev) => prev.map((r) => r.id === id ? { ...r, ...cambios } : r));
      setEditando((prev) => {
        const n = { ...prev }; delete n[id]; return n;
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(null);
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar registro?')) return;
    await api.delete(`/registros-diarios/${id}`);
    setRegistros((prev) => prev.filter((r) => r.id !== id));
  }

  async function crearNuevo() {
    setError('');
    try {
      await api.post('/registros-diarios', nuevo);
      setNuevoModal(false);
      setNuevo({});
      await buscar();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear');
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registros diarios</h1>
          <p className="text-sm text-gray-500">Consolidación diaria por colaborador y labor</p>
        </div>
        <button
          onClick={() => { setNuevo({ fecha: '', codigo_colaborador: '', nombre_colaborador: '', labor: '' }); setNuevoModal(true); }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark"
        >
          <Plus size={18}/> Nuevo manual
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 p-4 mb-4 flex items-end gap-3">
        <div className="flex-1 max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">Semana</label>
          <SemanaSelect value={semana} onChange={setSemana} className="w-full"/>
        </div>
        <button onClick={buscar} disabled={loading} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50">
          <Search size={16}/> {loading ? 'Buscando...' : 'Buscar'}
        </button>
        <div className="text-sm text-gray-600 ml-auto">
          {registrosFiltrados.length} de {registros.length} registros
          {totalFiltros > 0 && (
            <button onClick={() => setFiltros({ fecha: [], codigo: [], nombre: [], labor: [], lider: [] })} className="ml-3 text-xs text-primary hover:underline">
              Limpiar filtros ({totalFiltros})
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-3 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-2 py-2 text-left">
                  <ColumnFilter label="Fecha" options={opciones.fecha} selected={filtros.fecha} onChange={(v) => setFiltros(f => ({...f, fecha: v}))}/>
                </th>
                <th className="px-2 py-2 text-left">
                  <ColumnFilter label="Código" options={opciones.codigo} selected={filtros.codigo} onChange={(v) => setFiltros(f => ({...f, codigo: v}))}/>
                </th>
                <th className="px-2 py-2 text-left">
                  <ColumnFilter label="Nombre" options={opciones.nombre} selected={filtros.nombre} onChange={(v) => setFiltros(f => ({...f, nombre: v}))} width="w-72"/>
                </th>
                <th className="px-2 py-2 text-left">
                  <ColumnFilter label="Labor" options={opciones.labor} selected={filtros.labor} onChange={(v) => setFiltros(f => ({...f, labor: v}))}/>
                </th>
                <th className="px-2 py-2 text-left">
                  <ColumnFilter label="Líder" options={opciones.lider} selected={filtros.lider} onChange={(v) => setFiltros(f => ({...f, lider: v}))}/>
                </th>
                {CAMPOS.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-right">{c.label}</th>
                ))}
                <th className="px-2 py-2">Origen</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {registrosFiltrados.length === 0 ? (
                <tr><td colSpan={6 + CAMPOS.length + 2} className="px-4 py-8 text-center text-gray-400">
                  {semana ? (registros.length === 0 ? 'Sin registros para esta semana' : 'Sin resultados con los filtros aplicados') : 'Ingresa una semana y busca'}
                </td></tr>
              ) : registrosFiltrados.map((r) => {
                const dirty = !!editando[r.id];
                return (
                  <tr key={r.id} className={dirty ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                    <td className="px-2 py-1.5">{r.fecha}</td>
                    <td className="px-2 py-1.5 font-mono">{r.codigo_colaborador}</td>
                    <td className="px-2 py-1.5">{r.nombre_colaborador}</td>
                    <td className="px-2 py-1.5">{r.labor}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.lider}</td>
                    {CAMPOS.map((c) => (
                      <td key={c.key} className="px-1 py-1 text-right">
                        <input
                          type="number" step="any"
                          defaultValue={r[c.key]}
                          onChange={(e) => editarCampo(r.id, c.key, e.target.value)}
                          className="w-20 px-1.5 py-0.5 text-right border border-gray-200 rounded text-xs"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.origen === 'MANUAL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {r.origen}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {dirty && (
                        <button onClick={() => guardar(r.id)} disabled={saving === r.id} className="text-green-700 hover:text-green-800 mr-2">
                          <Save size={14}/>
                        </button>
                      )}
                      <button onClick={() => eliminar(r.id)} className="text-red-600 hover:text-red-700">
                        <Trash2 size={14}/>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {nuevoModal && (
        <Modal isOpen title="Nuevo registro manual" onClose={() => setNuevoModal(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input type="date" value={nuevo.fecha || ''} onChange={(e) => setNuevo({...nuevo, fecha: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                <input type="number" value={nuevo.codigo_colaborador || ''} onChange={(e) => setNuevo({...nuevo, codigo_colaborador: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg"/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input type="text" value={nuevo.nombre_colaborador || ''} onChange={(e) => setNuevo({...nuevo, nombre_colaborador: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Labor</label>
              <input type="text" value={nuevo.labor || ''} onChange={(e) => setNuevo({...nuevo, labor: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {CAMPOS.map((c) => (
                <div key={c.key}>
                  <label className="block text-xs text-gray-600 mb-1">{c.label}</label>
                  <input type="number" step="any" value={nuevo[c.key] || ''} onChange={(e) => setNuevo({...nuevo, [c.key]: parseFloat(e.target.value) || 0})} className="w-full px-2 py-1.5 border rounded text-sm"/>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setNuevoModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancelar</button>
              <button onClick={crearNuevo} className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark">Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
