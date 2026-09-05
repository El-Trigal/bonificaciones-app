import { useState, useEffect, useCallback } from 'react';
import api from '../store/api';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ExcelUploadModal from '../components/shared/ExcelUploadModal';
import { Plus, Upload, Pencil, Trash2, Save, X, Settings2 } from 'lucide-react';

const tabs = ['Empleados', 'Labores', 'Semanas', 'Maestros Generales'];

export default function Catalogos() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Catálogos</h1>
      <div className="flex gap-1 border-b mb-6 flex-wrap">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActiveTab(i)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === i ? 'bg-white border border-b-white text-primary-800 -mb-px' : 'text-gray-500 hover:text-gray-700'
            }`}>{t}</button>
        ))}
      </div>
      {activeTab === 0 && <TabEmpleados />}
      {activeTab === 1 && <TabLabores />}
      {activeTab === 2 && <TabSemanas />}
      {activeTab === 3 && <TabMaestros />}
    </div>
  );
}

const EXCEL_EMPLEADOS_CONFIG = {
  titulo: 'Importar Empleados',
  descripcion: 'Carga masiva desde el archivo Excel de RR.HH.',
  columnas_requeridas: ['ID', 'NOMBRE'],
  columnas_opcionales: ['CARGO'],
  endpoint_validar: '/catalogos/empleados/validar-excel',
  endpoint_confirmar: '/catalogos/empleados/confirmar-excel',
};

// ─── Tab Empleados ─────────────────────────────────────
function TabEmpleados() {
  const [empleados, setEmpleados] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'crear' | empleado obj
  const [form, setForm] = useState({ codigo: '', nombre: '', cargo: 'OPERARIO' });
  const [importModal, setImportModal] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/catalogos/empleados', { params: { buscar: buscar || undefined } });
      setEmpleados(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [buscar]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    try {
      if (modal === 'crear') {
        await api.post('/catalogos/empleados', { ...form, codigo: parseInt(form.codigo) });
      } else {
        await api.put(`/catalogos/empleados/${modal.id}`, { nombre: form.nombre, cargo: form.cargo });
      }
      setModal(null);
      cargar();
    } catch (e) { alert(e.response?.data?.detail || 'Error al guardar'); }
  };

  const desactivar = async (id) => {
    if (!confirm('¿Desactivar este empleado?')) return;
    await api.delete(`/catalogos/empleados/${id}`);
    cargar();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <input type="text" placeholder="Buscar por nombre o código..." value={buscar}
          onChange={e => setBuscar(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-72" />
        <div className="flex gap-2">
          <button
            onClick={() => setImportModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
          >
            <Upload size={16} /> Importar Excel
          </button>
          <button onClick={() => { setForm({ codigo: '', nombre: '', cargo: 'OPERARIO' }); setModal('crear'); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800">
            <Plus size={16} /> Agregar
          </button>
        </div>
      </div>

      <ExcelUploadModal
        isOpen={importModal}
        onClose={() => setImportModal(false)}
        onSuccess={() => { setImportModal(false); cargar(); }}
        config={EXCEL_EMPLEADOS_CONFIG}
      />

      {loading ? <LoadingSpinner /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-3">Código</th>
              <th className="text-left p-3">Nombre</th>
              <th className="text-left p-3">Cargo</th>
              <th className="text-left p-3">Estado</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empleados.map(e => (
              <tr key={e.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono">{e.codigo}</td>
                <td className="p-3">{e.nombre}</td>
                <td className="p-3">{e.cargo}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${e.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {e.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <button onClick={() => { setForm({ nombre: e.nombre, cargo: e.cargo }); setModal(e); }}
                    className="p-1 hover:bg-gray-100 rounded"><Pencil size={15} /></button>
                  {e.activo && <button onClick={() => desactivar(e.id)}
                    className="p-1 hover:bg-red-50 rounded text-red-500 ml-1"><Trash2 size={15} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal === 'crear' ? 'Nuevo Empleado' : 'Editar Empleado'}>
        <div className="space-y-4">
          {modal === 'crear' && (
            <div>
              <label className="block text-sm font-medium mb-1">Código</label>
              <input type="number" value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value})}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cargo</label>
            <input type="text" value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <button onClick={guardar} className="w-full py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-800">
            <Save size={16} className="inline mr-2" />Guardar
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Tab Labores ────────────────────────────────────────
function TabLabores() {
  const [labores, setLabores] = useState([]);
  const [lideres, setLideres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [recomputando, setRecomputando] = useState(false);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [curvaModal, setCurvaModal] = useState(null);

  const defaults = {
    nombre: '', rendimiento_min_hora: '', tallos_por_ramo: 1,
    salario_base: 1423500, tarifa_he_ordinaria: 7736, tarifa_he_dominical: 12378,
    semanas_mes_promedio: 4.33, pct_a_pagar_colaboradores: 0.60,
    pct_cortadores: 0.86, pct_apoyo: 0.14,
  };

  const cargar = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/catalogos/labores-rendimiento');
      setLabores(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    api.get('/catalogos/lideres').then(({ data }) => setLideres(data)).catch(() => setLideres([]));
  }, []);

  async function recomputarLideres() {
    if (!confirm('¿Recomputar el líder en todos los registros diarios? Esto actualiza registros existentes según la configuración actual de labores.')) return;
    setRecomputando(true);
    try {
      const { data } = await api.post('/registros-diarios/recomputar-lider');
      alert(`Revisados: ${data.revisados}\nActualizados: ${data.actualizados}`);
    } catch (e) {
      alert(e.response?.data?.detail || 'Error');
    } finally {
      setRecomputando(false);
    }
  }

  const calcularDerivados = (f) => {
    const sb = parseFloat(f.salario_base) || 0;
    const smp = parseFloat(f.semanas_mes_promedio) || 4.33;
    const rmh = parseFloat(f.rendimiento_min_hora) || 1;
    const tpr = parseInt(f.tallos_por_ramo) || 1;
    const pct = parseFloat(f.pct_a_pagar_colaboradores) || 0.6;
    const pctC = parseFloat(f.pct_cortadores) || 0.86;
    const pctA = parseFloat(f.pct_apoyo) || 0.14;
    const cet = sb / (smp * 43.5 * rmh);
    const cer = cet * tpr;
    const vuc = cer * pct * pctC;
    const vua = cer * pct * pctA;
    return { costo_estandar_tallo: cet, costo_estandar_ramo: cer, valor_unidad_colaborador: vuc, valor_unidad_apoyo: vua };
  };

  const guardar = async () => {
    try {
      const payload = { ...form,
        rendimiento_min_hora: parseFloat(form.rendimiento_min_hora),
        tallos_por_ramo: parseInt(form.tallos_por_ramo),
        salario_base: parseFloat(form.salario_base),
        tarifa_he_ordinaria: parseFloat(form.tarifa_he_ordinaria),
        tarifa_he_dominical: parseFloat(form.tarifa_he_dominical),
        semanas_mes_promedio: parseFloat(form.semanas_mes_promedio),
        pct_a_pagar_colaboradores: parseFloat(form.pct_a_pagar_colaboradores),
        pct_cortadores: parseFloat(form.pct_cortadores),
        pct_apoyo: parseFloat(form.pct_apoyo),
      };
      if (modal === 'crear') {
        await api.post('/catalogos/labores-rendimiento', payload);
      } else {
        await api.put(`/catalogos/labores-rendimiento/${modal.id}`, payload);
      }
      setModal(null);
      cargar();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
  };

  const toggleTodos = (e) => {
    if (e.target.checked) setSeleccionados(new Set(labores.map(l => l.id)));
    else setSeleccionados(new Set());
  };

  const toggleUno = (id) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const abrirCurvaUna = (labor) => {
    setCurvaModal({ laborIds: [labor.id], labores: [{ id: labor.id, nombre: labor.nombre }] });
  };

  const abrirCurvaBulk = () => {
    const sel = labores.filter(l => seleccionados.has(l.id));
    setCurvaModal({ laborIds: sel.map(l => l.id), labores: sel.map(l => ({ id: l.id, nombre: l.nombre })) });
  };

  const derivados = form.rendimiento_min_hora ? calcularDerivados(form) : null;
  const fmt = (v) => '$' + Math.round(v || 0).toLocaleString('es-CO');

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-700">Labores</h3>
        <div className="flex gap-2">
          <button onClick={recomputarLideres} disabled={recomputando}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-primary-700 text-primary-700 rounded-lg text-sm hover:bg-primary-50 disabled:opacity-50">
            {recomputando ? 'Recomputando...' : 'Recomputar líderes en registros'}
          </button>
          <button onClick={() => { setForm({...defaults}); setModal('crear'); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800">
            <Plus size={16} /> Agregar
          </button>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="w-10 px-2 py-2">
                  <input type="checkbox"
                    checked={seleccionados.size === labores.length && labores.length > 0}
                    onChange={toggleTodos} className="rounded" />
                </th>
                <th className="text-left p-2">Labor</th>
                <th className="text-left p-2">Líder</th>
                <th className="text-right p-2">Rend. Mín/h</th>
                <th className="text-right p-2">Tallos/Ramo</th>
                <th className="text-right p-2">% Pagar</th>
                <th className="text-right p-2">Val. Unid. Colab.</th>
                <th className="text-right p-2">Val. Unid. Apoyo</th>
                <th className="text-left p-2">Estado</th>
                <th className="p-2">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {labores.map(l => (
                <tr key={l.id} className={`border-b hover:bg-gray-50 ${seleccionados.has(l.id) ? 'bg-primary-50' : ''}`}>
                  <td className="px-2 py-2">
                    <input type="checkbox" checked={seleccionados.has(l.id)}
                      onChange={() => toggleUno(l.id)} className="rounded" />
                  </td>
                  <td className="p-2 font-medium">{l.nombre}</td>
                  <td className="p-2 text-gray-700">{l.lider_nombre || <span className="text-gray-400 italic">—</span>}</td>
                  <td className="p-2 text-right">{l.rendimiento_min_hora}</td>
                  <td className="p-2 text-right">{l.tallos_por_ramo}</td>
                  <td className="p-2 text-right">{(l.pct_a_pagar_colaboradores * 100).toFixed(0)}%</td>
                  <td className="p-2 text-right font-mono">{fmt(l.valor_unidad_colaborador)}</td>
                  <td className="p-2 text-right font-mono">{fmt(l.valor_unidad_apoyo)}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${l.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {l.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setForm(l); setModal(l); }}
                        className="p-1 hover:bg-gray-100 rounded" title="Editar parámetros"><Pencil size={15} /></button>
                      <button onClick={() => abrirCurvaUna(l)}
                        className="p-1 hover:bg-primary-50 rounded text-primary-600" title="Configurar curva de calidad"><Settings2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Barra de acción masiva */}
      {seleccionados.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">{seleccionados.size} labor{seleccionados.size > 1 ? 'es' : ''} seleccionada{seleccionados.size > 1 ? 's' : ''}</span>
          <button onClick={abrirCurvaBulk}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
            <Settings2 size={14} /> Editar curva de calidad
          </button>
          <button onClick={() => setSeleccionados(new Set())} className="text-gray-400 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>
      )}

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal === 'crear' ? 'Nueva Labor' : 'Editar Labor'} size="xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre de la labor</label>
            <input type="text" value={form.nombre || ''} onChange={e => setForm({...form, nombre: e.target.value})}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Líder responsable</label>
            <select value={form.lider_id ?? ''} onChange={e => setForm({...form, lider_id: e.target.value ? parseInt(e.target.value) : null})}
              className="w-full border rounded-lg px-3 py-2 bg-white">
              <option value="">— Sin líder —</option>
              {lideres.filter(ld => ld.activo).map(ld => (
                <option key={ld.id} value={ld.id}>{ld.nombre}</option>
              ))}
            </select>
          </div>
          {[
            ['rendimiento_min_hora', 'Rendimiento mín/hora', 'Unidades por hora mínimas exigidas'],
            ['tallos_por_ramo', 'Tallos por ramo', 'Factor de conversión'],
            ['salario_base', 'Salario base', 'Base para cálculo de costo estándar'],
            ['tarifa_he_ordinaria', 'Tarifa HE ordinaria', 'Valor hora extra ordinaria'],
            ['tarifa_he_dominical', 'Tarifa HE dominical', 'Valor hora extra dominical'],
            ['semanas_mes_promedio', 'Semanas/mes promedio', 'Generalmente 4.33'],
            ['pct_a_pagar_colaboradores', '% a pagar colaboradores', '0.60 = 60%, 0.90 para siembras'],
            ['pct_cortadores', '% cortadores', '0.86 = 86% va a cortadores directos'],
            ['pct_apoyo', '% apoyo', '0.14 = 14% va a personal de apoyo'],
          ].map(([key, label, hint]) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input type="number" step="any" value={form[key] ?? ''} onChange={e => setForm({...form, [key]: e.target.value})}
                className="w-full border rounded-lg px-3 py-2" />
              <p className="text-xs text-gray-400 mt-1">{hint}</p>
            </div>
          ))}
        </div>

        {derivados && (
          <div className="mt-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
            <h4 className="font-semibold text-primary-800 mb-2">Valores calculados (preview)</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>Costo estándar/tallo: <span className="font-mono font-bold">{fmt(derivados.costo_estandar_tallo)}</span></div>
              <div>Costo estándar/ramo: <span className="font-mono font-bold">{fmt(derivados.costo_estandar_ramo)}</span></div>
              <div>Valor unid. colaborador: <span className="font-mono font-bold text-primary-700">{fmt(derivados.valor_unidad_colaborador)}</span></div>
              <div>Valor unid. apoyo: <span className="font-mono font-bold text-primary-700">{fmt(derivados.valor_unidad_apoyo)}</span></div>
            </div>
          </div>
        )}

        <button onClick={guardar} className="w-full mt-4 py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-800">
          <Save size={16} className="inline mr-2" />Guardar
        </button>
      </Modal>

      {curvaModal && (
        <CurvaCalidadModal
          laborIds={curvaModal.laborIds}
          labores={curvaModal.labores}
          onClose={() => setCurvaModal(null)}
          onSaved={() => { setCurvaModal(null); setSeleccionados(new Set()); }}
        />
      )}
    </div>
  );
}

// ─── Tab Semanas ───────────────────────────────────────
function TabSemanas() {
  const [semanas, setSemanasData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [editVal, setEditVal] = useState({});

  const cargar = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/catalogos/semanas', { params: { año: 2026 } });
      setSemanasData(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const guardarSemana = async (id) => {
    try {
      await api.put(`/catalogos/semanas/${id}`, editVal);
      setEditando(null);
      cargar();
    } catch (e) { alert('Error al guardar'); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="font-semibold text-gray-700 mb-4">Semanas 2026</h3>
      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <table className="text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-2">Semana</th>
                <th className="text-right p-2">Horas Ord.</th>
                <th className="text-center p-2">Festivo</th>
                <th className="p-2">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {semanas.filter((_, i) => i < 26).map(s => (
                <tr key={s.id} className={`border-b ${s.tiene_festivo ? 'bg-amber-50' : ''}`}>
                  <td className="p-2 font-mono">{s.codigo}</td>
                  <td className="p-2 text-right">
                    {editando === s.id ? (
                      <input type="number" step="0.25" value={editVal.horas_ordinarias}
                        onChange={e => setEditVal({...editVal, horas_ordinarias: parseFloat(e.target.value)})}
                        className="w-20 border rounded px-2 py-1 text-right" />
                    ) : s.horas_ordinarias}
                  </td>
                  <td className="p-2 text-center">
                    {editando === s.id ? (
                      <input type="checkbox" checked={editVal.tiene_festivo}
                        onChange={e => setEditVal({...editVal, tiene_festivo: e.target.checked})} />
                    ) : s.tiene_festivo ? '🔴' : ''}
                  </td>
                  <td className="p-2 text-center">
                    {editando === s.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => guardarSemana(s.id)} className="text-green-600"><Save size={14} /></button>
                        <button onClick={() => setEditando(null)} className="text-gray-400"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditando(s.id); setEditVal({ horas_ordinarias: s.horas_ordinarias, tiene_festivo: s.tiene_festivo }); }}
                        className="p-1 hover:bg-gray-100 rounded"><Pencil size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-2">Semana</th>
                <th className="text-right p-2">Horas Ord.</th>
                <th className="text-center p-2">Festivo</th>
                <th className="p-2">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {semanas.filter((_, i) => i >= 26).map(s => (
                <tr key={s.id} className={`border-b ${s.tiene_festivo ? 'bg-amber-50' : ''}`}>
                  <td className="p-2 font-mono">{s.codigo}</td>
                  <td className="p-2 text-right">
                    {editando === s.id ? (
                      <input type="number" step="0.25" value={editVal.horas_ordinarias}
                        onChange={e => setEditVal({...editVal, horas_ordinarias: parseFloat(e.target.value)})}
                        className="w-20 border rounded px-2 py-1 text-right" />
                    ) : s.horas_ordinarias}
                  </td>
                  <td className="p-2 text-center">
                    {editando === s.id ? (
                      <input type="checkbox" checked={editVal.tiene_festivo}
                        onChange={e => setEditVal({...editVal, tiene_festivo: e.target.checked})} />
                    ) : s.tiene_festivo ? '🔴' : ''}
                  </td>
                  <td className="p-2 text-center">
                    {editando === s.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => guardarSemana(s.id)} className="text-green-600"><Save size={14} /></button>
                        <button onClick={() => setEditando(null)} className="text-gray-400"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditando(s.id); setEditVal({ horas_ordinarias: s.horas_ordinarias, tiene_festivo: s.tiene_festivo }); }}
                        className="p-1 hover:bg-gray-100 rounded"><Pencil size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab Maestros Generales ────────────────────────────
function TabMaestros() {
  const [subTab, setSubTab] = useState(0);
  const subTabs = ['Líderes', 'Productos / Áreas', 'Tipos de Bonificación'];
  const endpoints = ['/catalogos/lideres', '/catalogos/productos-areas', '/catalogos/tipos-bonificacion'];

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex gap-2 mb-4">
        {subTabs.map((t, i) => (
          <button key={t} onClick={() => setSubTab(i)}
            className={`px-3 py-1.5 rounded-lg text-sm ${subTab === i ? 'bg-primary-100 text-primary-800 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>
            {t}
          </button>
        ))}
      </div>
      <CrudSimple key={subTab} endpoint={endpoints[subTab]} label={subTabs[subTab]} />
    </div>
  );
}

function CrudSimple({ endpoint, label }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState('');
  const [laboresPorLider, setLaboresPorLider] = useState({});

  const esLideres = endpoint === '/catalogos/lideres';

  const cargar = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(endpoint);
      setItems(data);
      if (esLideres) {
        const { data: labs } = await api.get('/catalogos/labores-rendimiento');
        const mapa = {};
        for (const l of labs) {
          if (l.lider_id) (mapa[l.lider_id] ||= []).push(l.nombre);
        }
        setLaboresPorLider(mapa);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [endpoint]);

  const agregar = async () => {
    if (!nuevo.trim()) return;
    try {
      await api.post(endpoint, { nombre: nuevo.trim() });
      setNuevo('');
      cargar();
    } catch (e) {
      console.error('[CrudSimple] error al agregar:', e.response?.status, e.response?.data, e);
      alert(e.response?.data?.detail || 'Error');
    }
  };

  const desactivar = async (id) => {
    if (!confirm('¿Desactivar?')) return;
    await api.delete(`${endpoint}/${id}`);
    cargar();
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input type="text" value={nuevo} onChange={e => setNuevo(e.target.value)}
          placeholder={`Nuevo ${label.slice(0, -1).toLowerCase()}...`}
          onKeyDown={e => e.key === 'Enter' && agregar()}
          className="border rounded-lg px-3 py-2 text-sm flex-1" />
        <button onClick={agregar}
          className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800">
          <Plus size={16} /> Agregar
        </button>
      </div>
      {loading ? <LoadingSpinner /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-3">Nombre</th>
              {esLideres && <th className="text-left p-3">Labores a cargo</th>}
              <th className="text-left p-3">Estado</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{item.nombre}</td>
                {esLideres && (
                  <td className="p-3 text-gray-600 text-xs">
                    {(laboresPorLider[item.id] || []).length === 0
                      ? <span className="text-gray-400 italic">Sin labores asignadas</span>
                      : (laboresPorLider[item.id] || []).map((n, i) => (
                          <span key={i} className="inline-block bg-primary-50 text-primary-800 px-2 py-0.5 rounded mr-1 mb-1">{n}</span>
                        ))
                    }
                  </td>
                )}
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${item.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {item.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="p-3 text-center">
                  {item.activo && (
                    <button onClick={() => desactivar(item.id)}
                      className="p-1 hover:bg-red-50 rounded text-red-500"><Trash2 size={15} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Modal de edición de curva ──────────────────────────
function CurvaCalidadModal({ laborIds, labores, onClose, onSaved }) {
  const [reglas, setReglas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const esBulk = laborIds.length > 1;

  useEffect(() => {
    api.get(`/catalogos/curva-calidad/${laborIds[0]}`).then(({ data }) => {
      setReglas(data.reglas.map((r) => ({ ...r, _key: Math.random() })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const actualizarMultiplicador = (key, valor) => {
    setReglas((prev) =>
      prev.map((r) => r._key === key ? { ...r, multiplicador: valor } : r)
    );
  };

  const actualizarDesde = (key, valor) => {
    setReglas((prev) =>
      prev.map((r) => r._key === key ? { ...r, pct_calidad: valor } : r)
    );
  };

  const eliminarFila = (key) => {
    setReglas((prev) => prev.filter((r) => r._key !== key));
  };

  const agregarFila = () => {
    const sorted = [...reglas].sort((a, b) => a.pct_calidad - b.pct_calidad);
    const ultimo = sorted[sorted.length - 1];
    const nuevoDesde = ultimo ? Math.min(ultimo.pct_calidad + 1, 100) : 0;
    setReglas((prev) => [...prev, { pct_calidad: nuevoDesde, multiplicador: 1.0, pct_hasta: 100, _key: Math.random() }]);
  };

  // Calcular pct_hasta en tiempo real
  const reglasConHasta = () => {
    const sorted = [...reglas].sort((a, b) => a.pct_calidad - b.pct_calidad);
    return sorted.map((r, i) => ({
      ...r,
      pct_hasta: i < sorted.length - 1 ? sorted[i + 1].pct_calidad - 1 : 100,
    }));
  };

  const guardar = async () => {
    setError('');
    const sorted = [...reglas].sort((a, b) => a.pct_calidad - b.pct_calidad);
    if (!sorted.length) { setError('Debe haber al menos un tramo'); return; }
    if (sorted[0].pct_calidad !== 0) { setError('El primer tramo debe comenzar en 0%'); return; }
    const pcts = sorted.map((r) => r.pct_calidad);
    if (new Set(pcts).size !== pcts.length) { setError('Hay puntos de calidad duplicados'); return; }

    const payload = sorted.map((r) => ({
      pct_calidad: parseInt(r.pct_calidad),
      multiplicador: parseFloat(r.multiplicador),
    }));

    setSaving(true);
    try {
      if (esBulk) {
        await api.put('/catalogos/curva-calidad/bulk', { labor_ids: laborIds, reglas: payload });
      } else {
        await api.put(`/catalogos/curva-calidad/${laborIds[0]}`, { reglas: payload });
      }
      onSaved();
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar');
      setSaving(false);
    }
  };

  const filas = reglasConHasta();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              {esBulk ? `Curva de calidad — ${labores.length} labores` : `Curva de calidad — ${labores[0]?.nombre}`}
            </h2>
            {esBulk && (
              <p className="text-xs text-gray-500 mt-1">
                Se aplicará a: {labores.map((l) => l.nombre).join(', ')}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Calidad desde — hasta → % de bonificación aplicado. Primer tramo siempre desde 0%.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 ml-4"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Desde %</th>
                    <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Hasta %</th>
                    <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">% Bonificación</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filas.map((r, i) => (
                    <tr key={r._key} className="group hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <input
                          type="number" min="0" max="100" step="1"
                          value={r.pct_calidad}
                          onChange={(e) => actualizarDesde(r._key, parseInt(e.target.value) || 0)}
                          disabled={i === 0}
                          className="w-20 border rounded px-2 py-1 text-sm text-center disabled:bg-gray-50 disabled:text-gray-400 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-gray-500 font-mono text-sm">{r.pct_hasta}%</span>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="0" max="100" step="1"
                            value={Math.round(r.multiplicador * 100)}
                            onChange={(e) => actualizarMultiplicador(r._key, (parseInt(e.target.value) || 0) / 100)}
                            className="w-20 border rounded px-2 py-1 text-sm text-center focus:ring-1 focus:ring-primary-500 focus:outline-none"
                          />
                          <span className="text-gray-400 text-xs">%</span>
                          {/* Mini barra visual */}
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[80px]">
                            <div
                              className="h-1.5 rounded-full bg-primary-500 transition-all"
                              style={{ width: `${Math.round(r.multiplicador * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2">
                        {filas.length > 1 && (
                          <button
                            onClick={() => eliminarFila(r._key)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                onClick={agregarFila}
                className="mt-3 flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                <Plus size={15} /> Agregar tramo
              </button>

              {error && (
                <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50 rounded-b-xl">
          <span className="text-xs text-gray-400">{filas.length} tramos configurados</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={saving || loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando...' : <><Save size={14} /> Guardar cambios</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
