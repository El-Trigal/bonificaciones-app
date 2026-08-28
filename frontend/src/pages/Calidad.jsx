import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Upload, Calculator, Eye, Check } from 'lucide-react';
import api from '../store/api';
import Modal from '../components/shared/Modal';
import CargarCalidadMulti from '../components/calidad/CargarCalidadMulti';
import SemanaSelect from '../components/shared/SemanaSelect';

export default function Calidad() {
  const [semana, setSemana] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [calculando, setCalculando] = useState(false);
  const [cargaModal, setCargaModal] = useState(false);
  const [detalleModal, setDetalleModal] = useState(null);

  async function buscar() {
    if (!semana) return;
    setLoading(true);
    setMsg(''); setError('');
    try {
      const { data } = await api.get('/calidad', { params: { semana } });
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function guardar() {
    setError('');
    try {
      await api.post('/calidad', { ...form, semana });
      setModal(false);
      setForm({});
      await buscar();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar registro de calidad?')) return;
    await api.delete(`/calidad/${id}`);
    await buscar();
  }

  async function ejecutarCalculo() {
    if (!semana) { setError('Selecciona semana primero'); return; }
    if (!confirm(`¿Ejecutar cálculo para la semana ${semana}? Esto reemplaza liquidaciones previas.`)) return;
    setCalculando(true);
    setMsg(''); setError('');
    try {
      const { data } = await api.post('/calculo/ejecutar', { semana });
      setMsg(`Cálculo ejecutado: ${data.procesados} colaboradores · ${data.sin_bonificacion} sin bonificación · Total liquidado: $${Math.round(data.total_liquidado).toLocaleString('es-CO')}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al ejecutar cálculo');
    } finally {
      setCalculando(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calidad y Cálculo</h1>
          <p className="text-sm text-gray-500">% de calidad semanal + ejecución de cálculo</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCargaModal(true)}
            className="flex items-center gap-2 bg-white border border-primary text-primary px-4 py-2 rounded-lg hover:bg-primary-50"
          >
            <Upload size={18}/> Cargar archivos de calidad
          </button>
          <button
            onClick={ejecutarCalculo}
            disabled={calculando || !semana}
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            <Calculator size={18}/> {calculando ? 'Calculando...' : 'Ejecutar cálculo'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 p-4 mb-4 flex items-end gap-3">
        <div className="flex-1 max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">Semana</label>
          <SemanaSelect value={semana} onChange={setSemana} className="w-full"/>
        </div>
        <button onClick={buscar} disabled={loading} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50">
          <Search size={16}/> Buscar
        </button>
        <button
          onClick={() => { setForm({ codigo_colaborador: '', labor: '', pct_calidad: '' }); setModal(true); }}
          disabled={!semana}
          className="flex items-center gap-2 bg-white border border-primary text-primary px-4 py-2 rounded-lg hover:bg-primary-50 disabled:opacity-50"
        >
          <Plus size={16}/> Nuevo
        </button>
      </div>

      {msg && <div className="mb-3 bg-green-50 text-green-800 px-3 py-2 rounded text-sm">{msg}</div>}
      {error && <div className="mb-3 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Semana</th>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Labor</th>
              <th className="px-4 py-3 text-right">% Calidad</th>
              <th className="px-4 py-3 text-left">Origen</th>
              <th className="px-4 py-3 text-left">Obs.</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-400">Sin registros</td></tr>
            ) : items.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono">{r.semana}</td>
                <td className="px-4 py-2 font-mono">{r.codigo_colaborador}</td>
                <td className="px-4 py-2">{r.labor}</td>
                <td className="px-4 py-2 text-right font-semibold">{(r.pct_calidad * 100).toFixed(1)}%</td>
                <td className="px-4 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${r.origen === 'MANUAL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{r.origen}</span></td>
                <td className="px-4 py-2 text-gray-500 text-xs">{r.observaciones || '—'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {r.observaciones && (
                    <button onClick={() => setDetalleModal(r)} className="text-primary hover:text-primary-dark mr-2" title="Ver detalle">
                      <Eye size={14}/>
                    </button>
                  )}
                  <button onClick={() => eliminar(r.id)} className="text-red-600 hover:text-red-700"><Trash2 size={14}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cargaModal && (
        <CargarCalidadMulti
          onClose={() => setCargaModal(false)}
          onDone={() => { setCargaModal(false); buscar(); }}
          semanaInicial={semana}
        />
      )}

      {detalleModal && (
        <Modal isOpen title={`Detalle calidad — ${detalleModal.codigo_colaborador}`} onClose={() => setDetalleModal(null)} size="lg">
          <DetalleCalidad registro={detalleModal} />
        </Modal>
      )}

      {modal && (
        <Modal isOpen title="Nuevo registro de calidad" onClose={() => setModal(false)}>
          <div className="space-y-3">
            {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semana</label>
              <input type="text" value={semana} disabled className="w-full px-3 py-2 border bg-gray-50 rounded-lg"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código colaborador</label>
              <input type="number" value={form.codigo_colaborador || ''} onChange={(e) => setForm({...form, codigo_colaborador: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Labor</label>
              <input type="text" value={form.labor || ''} onChange={(e) => setForm({...form, labor: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">% Calidad (0.85 o 85)</label>
              <input type="number" step="0.01" value={form.pct_calidad || ''} onChange={(e) => setForm({...form, pct_calidad: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border rounded-lg"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
              <textarea value={form.observaciones || ''} onChange={(e) => setForm({...form, observaciones: e.target.value})} rows={2} className="w-full px-3 py-2 border rounded-lg"/>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancelar</button>
              <button onClick={guardar} className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark">Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DetalleCalidad({ registro }) {
  let info = null;
  try { info = JSON.parse(registro.observaciones); } catch { /* observaciones plano */ }
  if (!info?.filas) {
    return <div className="text-sm text-gray-600 whitespace-pre-wrap">{registro.observaciones || 'Sin detalle'}</div>;
  }
  return (
    <div className="space-y-3">
      <div className="bg-primary-50 text-primary-900 px-3 py-2 rounded text-sm">
        <div><b>{info.nombre}</b></div>
        <div>Promedio: <b>{(info.promedio * 100).toFixed(2)}%</b> sobre {info.filas.length} {info.filas.length === 1 ? 'muestra' : 'muestras'}</div>
      </div>
      <table className="w-full text-sm border">
        <thead className="bg-gray-50 text-xs uppercase text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left">Archivo</th>
            <th className="px-3 py-2 text-left">Nombre en Excel</th>
            <th className="px-3 py-2 text-right">N muestras</th>
            <th className="px-3 py-2 text-right">CFD</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {info.filas.map((f, i) => (
            <tr key={i}>
              <td className="px-3 py-1.5 text-xs text-gray-600">{f.archivo}</td>
              <td className="px-3 py-1.5">{f.nombre_excel}</td>
              <td className="px-3 py-1.5 text-right">{f.n_muestras}</td>
              <td className="px-3 py-1.5 text-right font-mono">{(f.cfd_producto * 100).toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
