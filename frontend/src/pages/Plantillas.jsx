import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, FileCode } from 'lucide-react';
import api from '../store/api';
import Modal from '../components/shared/Modal';

const TIPOS = ['RENDIMIENTO_DIARIO', 'CALIDAD', 'HE_DOMINICAL'];
const UNIDADES = ['TALLOS', 'RAMOS'];

const CONFIG_EJEMPLO = {
  header_row: 0,
  columnas: {
    codigo_colaborador: 'CODIGO',
    nombre_colaborador: 'NOMBRE',
    fecha: 'FECHA',
    tallos: 'TALLOS',
    horas_ordinarias: 'HS_ORD',
  },
  labor_fija: 'CORTE',
};

export default function Plantillas() {
  const [items, setItems] = useState([]);
  const [labores, setLabores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [configText, setConfigText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const [{ data: pls }, { data: labs }] = await Promise.all([
        api.get('/plantillas'),
        api.get('/catalogos/labores-rendimiento'),
      ]);
      setItems(pls);
      setLabores(labs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  function abrirCrear() {
    setForm({
      nombre: '', tipo: 'RENDIMIENTO_DIARIO', labor_id: null,
      unidad_origen: 'TALLOS', activo: true,
    });
    setConfigText(JSON.stringify(CONFIG_EJEMPLO, null, 2));
    setError('');
    setModal({ mode: 'create' });
  }
  function abrirEditar(p) {
    setForm({
      nombre: p.nombre, tipo: p.tipo, labor_id: p.labor_id,
      unidad_origen: p.unidad_origen, activo: p.activo,
    });
    setConfigText(JSON.stringify(p.configuracion, null, 2));
    setError('');
    setModal({ mode: 'edit', id: p.id });
  }

  async function guardar() {
    setError('');
    let cfg;
    try { cfg = JSON.parse(configText); }
    catch { setError('JSON de configuración inválido'); return; }
    setSaving(true);
    try {
      const body = { ...form, configuracion: cfg };
      if (modal.mode === 'create') await api.post('/plantillas', body);
      else await api.patch(`/plantillas/${modal.id}`, body);
      setModal(null);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar plantilla?')) return;
    await api.delete(`/plantillas/${id}`);
    await cargar();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas de carga</h1>
          <p className="text-sm text-gray-500">Configuración del parser de archivos por labor</p>
        </div>
        <button onClick={abrirCrear} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark">
          <Plus size={18}/> Nueva plantilla
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Labor</th>
              <th className="px-4 py-3 text-left">Unidad</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">Cargando...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                <FileCode className="inline mr-2" size={18}/> Sin plantillas. Crea la primera.
              </td></tr>
            ) : items.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.nombre}</td>
                <td className="px-4 py-3"><span className="text-xs bg-primary-50 text-primary-800 px-2 py-0.5 rounded">{p.tipo}</span></td>
                <td className="px-4 py-3 text-gray-600">{labores.find(l => l.id === p.labor_id)?.nombre || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{p.unidad_origen}</td>
                <td className="px-4 py-3">{p.activo ? 'Activa' : 'Inactiva'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => abrirEditar(p)} className="text-primary hover:text-primary-dark mr-3"><Edit2 size={16}/></button>
                  <button onClick={() => eliminar(p.id)} className="text-red-600 hover:text-red-700"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal isOpen title={modal.mode === 'create' ? 'Nueva plantilla' : 'Editar plantilla'} onClose={() => setModal(null)} size="xl">
          <div className="space-y-3">
            {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select value={form.tipo} onChange={(e) => setForm({...form, tipo: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Labor (opcional)</label>
                <select value={form.labor_id ?? ''} onChange={(e) => setForm({...form, labor_id: e.target.value ? parseInt(e.target.value) : null})} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">— Ninguna —</option>
                  {labores.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad origen</label>
                <select value={form.unidad_origen} onChange={(e) => setForm({...form, unidad_origen: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.activo} onChange={(e) => setForm({...form, activo: e.target.checked})}/>
              Plantilla activa
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Configuración (JSON)</label>
              <textarea
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                rows={14}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs"
                spellCheck="false"
              />
              <p className="text-xs text-gray-500 mt-1">
                Campos obligatorios: <code>codigo_colaborador</code>, <code>nombre_colaborador</code>, <code>fecha</code>.
                Requiere <code>labor</code> en columnas o <code>labor_fija</code>.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
