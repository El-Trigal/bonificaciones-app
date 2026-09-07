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
            {empleados.filter(e => e.activo).map(e => (
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
  const [configNomina, setConfigNomina] = useState({
    salario_base_default: 1423500, horas_mensuales_default: 240,
    recargo_he_diurna_pct: 25, recargo_dominical_pct: 75,
    tarifa_he_ordinaria: 7736, tarifa_he_dominical: 12378,
  });
  const [configModal, setConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({});
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroLider, setFiltroLider] = useState('');

  const defaults = {
    nombre: '', rendimiento_min_hora: '', tallos_por_ramo: 1,
    salario_base: configNomina.salario_base_default,
    tarifa_he_ordinaria: configNomina.tarifa_he_ordinaria,
    tarifa_he_dominical: configNomina.tarifa_he_dominical,
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

  const cargarConfigNomina = async () => {
    try {
      const { data } = await api.get('/catalogos/config-nomina');
      setConfigNomina(data);
    } catch (e) { console.error(e); }
  };

  const abrirConfigModal = () => {
    setConfigForm({
      salario_base_default: configNomina.salario_base_default,
      horas_mensuales_default: configNomina.horas_mensuales_default,
      recargo_he_diurna_pct: configNomina.recargo_he_diurna_pct,
      recargo_dominical_pct: configNomina.recargo_dominical_pct,
    });
    setConfigModal(true);
  };

  const guardarConfigNomina = async () => {
    const salario = parseFloat(configForm.salario_base_default) || 0;
    const horas = parseFloat(configForm.horas_mensuales_default) || 240;
    const pctHe = parseFloat(configForm.recargo_he_diurna_pct) || 0;
    const pctDom = parseFloat(configForm.recargo_dominical_pct) || 0;
    if (!salario || salario <= 0) { alert('Ingrese un salario válido.'); return; }
    const vho = salario / horas;
    const tarifaHe = Math.round(vho * (1 + pctHe / 100));
    const tarifaDom = Math.round(vho * (1 + pctDom / 100));
    const activas = labores.filter(l => l.activo).length;
    const ok = confirm(
      `Este cambio actualizará los valores en ${activas} labor${activas !== 1 ? 'es' : ''} activa${activas !== 1 ? 's' : ''}:\n\n` +
      `• Salario base: $${salario.toLocaleString('es-CO')}\n` +
      `• Tarifa HE ordinaria: $${tarifaHe.toLocaleString('es-CO')}\n` +
      `• Tarifa dominical: $${tarifaDom.toLocaleString('es-CO')}\n\n` +
      `Los valores derivados se recalcularán automáticamente. Afecta liquidaciones futuras.\n\n` +
      `Aceptar = Propagar a todas las labores activas\n` +
      `Cancelar = Solo guardar configuración`
    );
    setGuardandoConfig(true);
    try {
      const { data } = await api.put('/catalogos/config-nomina', { ...configForm, propagar: ok });
      setConfigNomina(data);
      setConfigModal(false);
      if (ok) cargar();
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al guardar');
    } finally {
      setGuardandoConfig(false);
    }
  };

  useEffect(() => {
    cargar();
    cargarConfigNomina();
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

  const laboresFiltradas = labores.filter(l => {
    if (!l.activo) return false;
    const matchNombre = !filtroNombre || l.nombre.toLowerCase().includes(filtroNombre.toLowerCase());
    const matchLider = !filtroLider || String(l.lider_id) === filtroLider;
    return matchNombre && matchLider;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold text-gray-700">Labores</h3>
        <div className="flex gap-2">
          <button onClick={recomputarLideres} disabled={recomputando}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-primary-700 text-primary-700 rounded-lg text-sm hover:bg-primary-50 disabled:opacity-50">
            {recomputando ? 'Recomputando...' : 'Recomputar líderes en registros'}
          </button>
          <button onClick={abrirConfigModal}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-primary-700 text-primary-700 rounded-lg text-sm hover:bg-primary-50">
            <Settings2 size={15} /> Configuración de nómina
          </button>
          <button onClick={() => { setForm({...defaults}); setModal('crear'); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800">
            <Plus size={16} /> Agregar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por labor..."
          value={filtroNombre}
          onChange={e => setFiltroNombre(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm flex-1 max-w-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
        <select
          value={filtroLider}
          onChange={e => setFiltroLider(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="">Todos los líderes</option>
          {lideres.filter(ld => ld.activo).map(ld => (
            <option key={ld.id} value={String(ld.id)}>{ld.nombre}</option>
          ))}
        </select>
        {(filtroNombre || filtroLider) && (
          <button
            onClick={() => { setFiltroNombre(''); setFiltroLider(''); }}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2"
          >
            <X size={14} /> Limpiar
          </button>
        )}
        {(filtroNombre || filtroLider) && (
          <span className="text-sm text-gray-400 self-center">
            {laboresFiltradas.length} de {labores.length}
          </span>
        )}
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
                <th className="text-right p-2">Rend. Unidades/hora</th>
                <th className="text-right p-2">Tallos/Ramo</th>
                <th className="text-right p-2">% Pagar</th>
                <th className="text-right p-2">Val. Unid. Colab.</th>
                <th className="text-right p-2">Val. Unid. Apoyo</th>
                <th className="text-left p-2">Estado</th>
                <th className="p-2">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {laboresFiltradas.map(l => (
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

      {/* Modal configuración de nómina */}
      {(() => {
        const salario = parseFloat(configForm.salario_base_default) || 0;
        const horas   = parseFloat(configForm.horas_mensuales_default) || 240;
        const vho     = salario / horas;
        const fmtP    = v => '$' + Math.round(v || 0).toLocaleString('es-CO');
        const recargos = [
          { key: 'recargo_he_diurna_pct',  label: 'HE Diurna',  badge: 'Art. 168 CST', cls: 'bg-orange-50 text-orange-700' },
          { key: 'recargo_dominical_pct',   label: 'Dominical',  badge: 'Art. 179 CST', cls: 'bg-purple-50 text-purple-700' },
        ];
        return (
          <Modal isOpen={configModal} onClose={() => setConfigModal(false)} title="Configuración Global de Nómina" size="md">
            {/* Parámetros base */}
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Parámetros base</p>
              <div className="flex items-stretch border rounded-lg overflow-hidden bg-gray-50">
                <div className="flex-1 p-3 min-w-0">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Salario mensual</label>
                  <div className="flex items-baseline gap-1">
                    <span className="text-gray-400 font-bold text-base">$</span>
                    <input type="number" value={configForm.salario_base_default ?? ''} min="0" step="100"
                      onChange={e => setConfigForm({...configForm, salario_base_default: e.target.value})}
                      className="w-full bg-transparent border-none outline-none text-lg font-bold text-primary-800" />
                  </div>
                </div>
                <div className="flex items-center justify-center w-8 border-l text-gray-300 text-xl font-light flex-shrink-0">÷</div>
                <div className="p-3 border-l w-28 flex-shrink-0">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Horas/mes</label>
                  <input type="number" value={configForm.horas_mensuales_default ?? ''} min="1" step="1"
                    onChange={e => setConfigForm({...configForm, horas_mensuales_default: e.target.value})}
                    className="w-full bg-transparent border-none outline-none text-lg font-bold text-primary-800" />
                </div>
                <div className="flex items-center justify-center w-8 border-l text-gray-300 text-xl font-light flex-shrink-0">=</div>
                <div className="p-3 border-l bg-green-50 border-green-200 w-36 flex-shrink-0">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-green-600 opacity-70 mb-1">Hora ordinaria</label>
                  <div className="text-lg font-bold text-green-700 font-mono">{vho > 0 ? fmtP(vho) : '—'}</div>
                </div>
              </div>
            </div>

            {/* Recargos */}
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Recargos legales</p>
              <div className="grid grid-cols-2 gap-3">
                {recargos.map(({ key, label, badge, cls }) => {
                  const pct    = parseFloat(configForm[key]) || 0;
                  const factor = 1 + pct / 100;
                  const tarifa = vho * factor;
                  return (
                    <div key={key} className="border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
                        <span className="text-sm font-semibold text-primary-800">{label}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{badge}</span>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-xs text-gray-500 whitespace-nowrap">Recargo</label>
                          <div className="flex items-center border rounded-lg overflow-hidden flex-1 focus-within:border-primary-600">
                            <input type="number" value={configForm[key] ?? ''} min="0" max="999"
                              onChange={e => setConfigForm({...configForm, [key]: e.target.value})}
                              className="flex-1 px-2 py-1.5 text-sm font-bold text-primary-800 border-none outline-none bg-transparent w-0 min-w-0" />
                            <span className="px-2 py-1.5 text-xs font-semibold text-gray-400 border-l bg-gray-50">%</span>
                          </div>
                          <span className="text-xs font-semibold text-gray-500 bg-gray-100 border px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">× {factor.toFixed(2)}</span>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-xs text-gray-400 mb-1 font-mono">{vho > 0 ? `${fmtP(vho)} × ${factor.toFixed(2)}` : '—'}</div>
                          <div className="text-lg font-bold text-green-700 font-mono">{tarifa > 0 ? fmtP(tarifa) : '—'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Al guardar, podrás propagar estas tarifas a todas las labores activas. <strong className="text-gray-600">Solo afecta liquidaciones futuras</strong>; períodos cerrados no cambian.
            </p>
            <button onClick={guardarConfigNomina} disabled={guardandoConfig}
              className="w-full py-2.5 bg-primary-700 text-white rounded-lg hover:bg-primary-800 font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={15} />
              {guardandoConfig ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </Modal>
        );
      })()}

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
// Días en orden: índice 0=Dom,1=Lun,2=Mar,3=Mié,4=Jue,5=Vie,6=Sáb
const DIA_LABELS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DIA_KEYS   = ['horas_dom','horas_lun','horas_mar','horas_mie','horas_jue','horas_vie','horas_sab'];
const DIA_CONFIG = ['horas_dom_default','horas_lun_default','horas_mar_default','horas_mie_default','horas_jue_default','horas_vie_default','horas_sab_default'];

function diasOrdenados(diaInicio) {
  // diaInicio: 0=Dom, 1=Lun
  // Devuelve los índices 0-6 reordenados según el día de inicio
  const orden = [];
  for (let i = 0; i < 7; i++) orden.push((diaInicio + i) % 7);
  return orden;
}

function fechaDia(fechaInicio, diaIdx, diaInicioSemana) {
  // Dado fecha_inicio (string YYYY-MM-DD) y un índice de día (0=Dom..6=Sáb),
  // retorna el día del mes que corresponde a ese día de la semana en esa semana
  if (!fechaInicio) return null;
  const base = new Date(fechaInicio + 'T00:00:00');
  // Ajustar si el inicio es domingo (base puede ser lunes o domingo según config)
  const baseDia = (base.getDay()); // 0=Dom,1=Lun...
  const offset = (diaIdx - baseDia + 7) % 7;
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return d;
}

function mesLabel(semana) {
  if (!semana.fecha_inicio || !semana.fecha_cierre) return '';
  const ini = new Date(semana.fecha_inicio + 'T00:00:00');
  const fin = new Date(semana.fecha_cierre + 'T00:00:00');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  if (ini.getMonth() === fin.getMonth()) return meses[ini.getMonth()];
  return `${meses[ini.getMonth()]}/${meses[fin.getMonth()]}`;
}

function TabSemanas() {
  const añoActual = new Date().getFullYear();
  const [año, setAño] = useState(añoActual);
  const [semanas, setSemanasData] = useState([]);
  const [festivos, setFestivos] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [config, setConfig] = useState({
    dia_inicio_semana: 1,
    horas_lun_default: 8.5, horas_mar_default: 7.25, horas_mie_default: 7.25,
    horas_jue_default: 7.25, horas_vie_default: 7.25, horas_sab_default: 6.0,
    horas_dom_default: 0.0,
  });
  const [configModal, setConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({});
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [editModal, setEditModal] = useState(null); // semana obj
  const [editForm, setEditForm] = useState({});
  const [paginaOffset, setPaginaOffset] = useState(0);
  const PAGE_SIZE = 10;

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: sw }, { data: fest }, { data: cfg }] = await Promise.all([
        api.get('/catalogos/semanas', { params: { año } }),
        api.get('/catalogos/festivos', { params: { año } }),
        api.get('/catalogos/config-semanas'),
      ]);
      setSemanasData(sw);
      setFestivos(new Set(fest));
      setConfig(cfg);
      setPaginaOffset(0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [año]);

  useEffect(() => { cargar(); }, [cargar]);

  const generarSemanas = async () => {
    if (!confirm(`¿Generar semanas del año ${año}?\n\nSe usará la plantilla configurada (horas por día, festivos colombianos automáticos). Las semanas ya existentes no se modifican.`)) return;
    setGenerando(true);
    try {
      const { data } = await api.post('/catalogos/semanas/generar-ano', null, { params: { año } });
      alert(`Semanas generadas: ${data.creadas}${data.omitidas ? `\nYa existían: ${data.omitidas}` : ''}`);
      cargar();
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al generar semanas');
    } finally { setGenerando(false); }
  };

  const abrirConfig = () => { setConfigForm({ ...config }); setConfigModal(true); };

  const guardarConfig = async () => {
    setGuardandoConfig(true);
    const propagar = semanas.length > 0 &&
      confirm(`¿Aplicar esta plantilla a las ${semanas.filter(s => !s.modificacion_manual).length} semanas de ${año} sin modificación manual?`);
    try {
      await api.put('/catalogos/config-semanas', { ...configForm, propagar, año_propagar: propagar ? año : null });
      setConfigModal(false);
      cargar();
    } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    finally { setGuardandoConfig(false); }
  };

  const abrirEditar = (s) => {
    const form = {};
    DIA_KEYS.forEach(k => { form[k] = s[k] ?? config[DIA_CONFIG[DIA_KEYS.indexOf(k)]] ?? 0; });
    setEditForm(form);
    setEditModal(s);
  };

  const guardarEdicion = async () => {
    try {
      await api.put(`/catalogos/semanas/${editModal.id}`, editForm);
      setEditModal(null);
      cargar();
    } catch (e) { alert('Error al guardar'); }
  };

  const resetManual = async (s) => {
    if (!confirm(`¿Resetear la semana ${s.codigo} a los valores de la plantilla global?`)) return;
    const plantilla = {};
    DIA_KEYS.forEach((k, i) => { plantilla[k] = config[DIA_CONFIG[i]]; });
    await api.put(`/catalogos/semanas/${s.id}`, { ...plantilla, modificacion_manual: false });
    cargar();
  };

  const orden = diasOrdenados(config.dia_inicio_semana);
  const paginadas = semanas.slice(paginaOffset, paginaOffset + PAGE_SIZE);
  const totalPags = Math.ceil(semanas.length / PAGE_SIZE);
  const pagActual = Math.floor(paginaOffset / PAGE_SIZE);

  // DIA_CONFIG keys: [dom_default, lun_default, mar_default, mie_default, jue_default, vie_default, sab_default]
  const totalConfig = DIA_CONFIG.reduce((s, k) => s + (parseFloat(configForm[k]) || 0), 0);
  const labConfig = [1,2,3,4,5].reduce((s, idx) => s + (parseFloat(configForm[DIA_CONFIG[idx]]) || 0), 0);
  const finConfig = [0,6].reduce((s, idx) => s + (parseFloat(configForm[DIA_CONFIG[idx]]) || 0), 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h3 className="font-semibold text-gray-800 text-base">Gestión de Horas Laborales por Semana</h3>
          <p className="text-xs text-gray-400 mt-1">Las horas ordinarias determinan el umbral del 83% para acceder a bonificación de rendimiento.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={abrirConfig}
            className="flex items-center gap-1.5 px-3 py-2 border border-primary-700 text-primary-700 rounded-lg text-sm hover:bg-primary-50">
            <Settings2 size={14}/> Configuración
          </button>
          <button onClick={generarSemanas} disabled={generando}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800 disabled:opacity-50">
            <Plus size={14}/> {generando ? 'Generando...' : `Generar ${año}`}
          </button>
        </div>
      </div>

      {/* Controles año + leyenda */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setAño(a => a - 1)} className="p-1 hover:bg-gray-100 rounded"><X size={14} className="rotate-45"/></button>
          <div className="flex items-center gap-1">
            {[añoActual - 1, añoActual, añoActual + 1].map(y => (
              <button key={y} onClick={() => setAño(y)}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${y === año ? 'bg-primary-700 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{y}</button>
            ))}
          </div>
          <button onClick={() => setAño(a => a + 1)} className="p-1 hover:bg-gray-100 rounded"><Plus size={14}/></button>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block"/>&nbsp;Día Festivo</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-400 inline-block"/>&nbsp;Modificación Manual</span>
          <span className="text-gray-400">Inicio semana: <strong>{config.dia_inicio_semana === 0 ? 'Domingo' : 'Lunes'}</strong></span>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : semanas.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
          <p className="text-base mb-1 font-medium">No hay semanas para {año}</p>
          <p className="text-sm">Primero configura la plantilla y luego genera las semanas.</p>
        </div>
      ) : (
        <>
          {/* Grilla tipo calendario */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 w-28">Semana</th>
                  {orden.map(idx => (
                    <th key={idx} className="text-center px-2 py-2 font-semibold text-gray-600 min-w-[80px]">
                      {DIA_LABELS[idx]}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 font-semibold text-gray-600 w-24">Horas Tot.</th>
                  <th className="px-2 py-2 w-16"/>
                </tr>
              </thead>
              <tbody>
                {paginadas.map(s => {
                  const festDias = s.festivos_dias ? JSON.parse(s.festivos_dias) : [];
                  return (
                    <tr key={s.id} className={`border-b hover:bg-gray-50 transition-colors ${s.modificacion_manual ? 'bg-green-50/40' : ''}`}>
                      <td className="px-3 py-2">
                        <div className="font-mono font-bold text-gray-800">{s.codigo}</div>
                        <div className="text-xs text-gray-400">{mesLabel(s)}</div>
                      </td>
                      {orden.map(diaIdx => {
                        const key = DIA_KEYS[diaIdx];
                        const horas = s[key] ?? config[DIA_CONFIG[diaIdx]] ?? 0;
                        const fecha = fechaDia(s.fecha_inicio, diaIdx, config.dia_inicio_semana);
                        const esFestivo = fecha && festivos.has(fecha.toISOString().split('T')[0]);
                        return (
                          <td key={diaIdx} className={`px-2 py-2 text-center border-l border-gray-100 ${esFestivo ? 'bg-blue-50' : ''}`}>
                            <div className={`font-bold text-sm ${esFestivo ? 'text-blue-600' : 'text-gray-800'}`}>
                              {horas > 0 ? `${horas}h` : <span className="text-gray-300">0h</span>}
                            </div>
                            {fecha && <div className="text-xs text-gray-400">{fecha.getDate()}</div>}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right">
                        <span className="font-mono font-bold text-gray-800">{s.horas_ordinarias}h</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => abrirEditar(s)} className="p-1 hover:bg-gray-100 rounded" title="Editar semana">
                            <Pencil size={13}/>
                          </button>
                          {s.modificacion_manual && (
                            <button onClick={() => resetManual(s)} className="p-1 hover:bg-orange-50 rounded text-orange-400" title="Resetear a plantilla global">
                              <X size={13}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPags > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-gray-400">{semanas.length} semanas · página {pagActual + 1} de {totalPags}</span>
              <div className="flex gap-2">
                <button disabled={paginaOffset === 0} onClick={() => setPaginaOffset(p => Math.max(0, p - PAGE_SIZE))}
                  className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-40">← Ant.</button>
                <button disabled={paginaOffset + PAGE_SIZE >= semanas.length} onClick={() => setPaginaOffset(p => p + PAGE_SIZE)}
                  className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-40">Sig. →</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal configuración global */}
      <Modal isOpen={configModal} onClose={() => setConfigModal(false)} title="Configuración de Horas Laborales" size="lg">
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
            Esta configuración se aplica como plantilla al generar o regenerar semanas.
          </div>

          {/* Inicio de semana */}
          <div className="border rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Inicio de semana</p>
            <div className="flex gap-3">
              {[{v:1,l:'Lunes'},{v:0,l:'Domingo'}].map(({v,l}) => (
                <button key={v} onClick={() => setConfigForm(f => ({...f, dia_inicio_semana: v}))}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${configForm.dia_inicio_semana === v ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Horas por día */}
          <div className="border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Horas por día</p>
              <span className="text-xs text-gray-400">Total: <strong>{totalConfig}h</strong></span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {diasOrdenados(configForm.dia_inicio_semana ?? 1).map(diaIdx => {
                const key = DIA_CONFIG[diaIdx];
                return (
                  <div key={diaIdx} className="text-center">
                    <div className="text-xs font-semibold text-gray-500 mb-1.5">{DIA_LABELS[diaIdx]}</div>
                    <input type="number" min="0" max="24" step="0.25"
                      value={configForm[key] ?? ''}
                      onChange={e => setConfigForm(f => ({...f, [key]: parseFloat(e.target.value) || 0}))}
                      className="w-full border rounded-lg px-1 py-2 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                );
              })}
            </div>
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="border rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">TOTAL SEMANA</div>
                <div className="text-xl font-bold text-gray-800">{totalConfig}h</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setConfigModal(false)} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={guardarConfig} disabled={guardandoConfig}
              className="flex-1 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800 disabled:opacity-50">
              {guardandoConfig ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal edición por semana */}
      {editModal && (
        <Modal isOpen={!!editModal} onClose={() => setEditModal(null)} title={`Editar semana ${editModal.codigo}`} size="md">
          <div className="space-y-4">
            <p className="text-xs text-gray-400">
              {editModal.fecha_inicio} → {editModal.fecha_cierre} · {mesLabel(editModal)}
            </p>
            <div className="grid grid-cols-7 gap-2">
              {diasOrdenados(config.dia_inicio_semana).map(diaIdx => {
                const key = DIA_KEYS[diaIdx];
                const fecha = fechaDia(editModal.fecha_inicio, diaIdx, config.dia_inicio_semana);
                const esFestivo = fecha && festivos.has(fecha.toISOString().split('T')[0]);
                return (
                  <div key={diaIdx} className={`text-center border rounded-lg p-2 ${esFestivo ? 'border-blue-300 bg-blue-50' : ''}`}>
                    <div className="text-xs font-semibold text-gray-500 mb-0.5">{DIA_LABELS[diaIdx]}</div>
                    {fecha && <div className="text-xs text-gray-400 mb-1">{fecha.getDate()}</div>}
                    {esFestivo && <div className="text-xs text-blue-500 mb-1">Festivo</div>}
                    <input type="number" min="0" max="24" step="0.25"
                      value={editForm[key] ?? ''}
                      onChange={e => setEditForm(f => ({...f, [key]: parseFloat(e.target.value) || 0}))}
                      className="w-full border rounded px-1 py-1.5 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-sm font-semibold border-t pt-3">
              <span className="text-gray-500">Total semana:</span>
              <span className="text-primary-700 text-lg">{Object.values(editForm).reduce((a,b) => a + (parseFloat(b)||0), 0)}h</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditModal(null)} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={guardarEdicion} className="flex-1 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800">
                <Save size={14} className="inline mr-1"/>Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab Maestros Generales ────────────────────────────
function TabMaestros() {
  const [subTab, setSubTab] = useState(0);
  const subTabs = ['Líderes', 'Productos / Áreas', 'Tipos de Bonificación'];
  const singulares = ['Líder', 'Producto / Área', 'Tipo de Bonificación'];
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
      <CrudSimple key={subTab} endpoint={endpoints[subTab]} label={subTabs[subTab]} singular={singulares[subTab]} />
    </div>
  );
}

function CrudSimple({ endpoint, label, singular }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
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

  const abrirModal = () => { setNombre(''); setModal(true); };

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      await api.post(endpoint, { nombre: nombre.trim() });
      setModal(false);
      cargar();
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async (id) => {
    if (!confirm('¿Desactivar?')) return;
    await api.delete(`${endpoint}/${id}`);
    cargar();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={abrirModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800">
          <Plus size={16} /> Agregar {singular}
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
            {items.filter(item => item.activo).map(item => (
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

      <Modal isOpen={modal} onClose={() => setModal(false)} title={`Nuevo ${singular}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              type="text"
              autoFocus
              value={nombre}
              onChange={e => setNombre(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && guardar()}
              placeholder={`Nombre del ${singular.toLowerCase()}...`}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <button
            onClick={guardar}
            disabled={!nombre.trim() || guardando}
            className="w-full py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed">
            <Save size={16} className="inline mr-2" />
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </Modal>
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
