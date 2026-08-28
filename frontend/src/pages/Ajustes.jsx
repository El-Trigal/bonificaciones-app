import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, History } from 'lucide-react';
import api from '../store/api';
import useAuthStore from '../store/authStore';
import SemanaSelect from '../components/shared/SemanaSelect';

const fmtCOP = (v) => '$' + Math.round(v || 0).toLocaleString('es-CO');

const ESTADO_STYLE = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  APROBADO:  'bg-green-100 text-green-800',
  RECHAZADO: 'bg-gray-100 text-gray-600',
};

export default function Ajustes() {
  const { can } = useAuthStore();
  const [items, setItems] = useState([]);
  const [filtro, setFiltro] = useState('PENDIENTE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ semana: '', motivo: '' });
  const [msg, setMsg] = useState('');

  async function cargar() {
    setLoading(true);
    try {
      const params = filtro === 'TODOS' ? {} : { estado: filtro };
      const { data } = await api.get('/ajustes', { params });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { cargar(); }, [filtro]);

  async function crear() {
    setError(''); setMsg('');
    if (!form.semana) { setError('Indica la semana a recalcular'); return; }
    try {
      const { data } = await api.post('/ajustes/recalcular-semana', form);
      setMsg(`Recálculo para ${data.semana}: ${data.ajustes_creados} ajustes creados. Origen: ${data.periodo_origen} → Destino: ${data.periodo_destino}`);
      setForm({ semana: '', motivo: '' });
      await cargar();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error');
    }
  }

  async function accion(id, path, confirmMsg) {
    if (!confirm(confirmMsg)) return;
    try {
      await api.post(`/ajustes/${id}/${path}`);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error');
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ajustes retroactivos</h1>
        <p className="text-sm text-gray-500">Recalcula semanas ya pagadas — la diferencia se aplica al próximo periodo abierto</p>
      </div>

      {can('ejecutar_calculo') && (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-4 mb-4">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <History size={16}/> Nuevo recálculo
          </h2>
          {error && <div className="mb-3 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          {msg && <div className="mb-3 bg-green-50 text-green-800 px-3 py-2 rounded text-sm">{msg}</div>}
          <div className="flex gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Semana</label>
              <SemanaSelect value={form.semana} onChange={(v) => setForm({...form, semana: v})}/>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">Motivo (opcional)</label>
              <input type="text" value={form.motivo} onChange={(e) => setForm({...form, motivo: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/>
            </div>
            <button onClick={crear} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark">
              Recalcular y generar ajustes
            </button>
          </div>
        </div>
      )}

      <div className="mb-3 flex gap-2">
        {['PENDIENTE', 'APROBADO', 'RECHAZADO', 'TODOS'].map((e) => (
          <button
            key={e}
            onClick={() => setFiltro(e)}
            className={`px-3 py-1.5 rounded-lg text-sm ${filtro === e ? 'bg-primary text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Semana</th>
              <th className="px-3 py-2 text-left">Código</th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left">Labor</th>
              <th className="px-3 py-2 text-right">Antes</th>
              <th className="px-3 py-2 text-right">Nuevo</th>
              <th className="px-3 py-2 text-right">Δ</th>
              <th className="px-3 py-2 text-left">Motivo</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="10" className="px-4 py-8 text-center text-gray-500">Cargando...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="10" className="px-4 py-8 text-center text-gray-400">Sin ajustes</td></tr>
            ) : items.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-3 py-1.5 font-mono">{a.semana_original}</td>
                <td className="px-3 py-1.5 font-mono">{a.codigo_colaborador}</td>
                <td className="px-3 py-1.5">{a.nombre_colaborador}</td>
                <td className="px-3 py-1.5">{a.labor}</td>
                <td className="px-3 py-1.5 text-right text-gray-500">{fmtCOP(a.monto_anterior)}</td>
                <td className="px-3 py-1.5 text-right">{fmtCOP(a.monto_nuevo)}</td>
                <td className={`px-3 py-1.5 text-right font-semibold ${a.diferencia >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {a.diferencia >= 0 ? '+' : ''}{fmtCOP(a.diferencia)}
                </td>
                <td className="px-3 py-1.5 text-xs text-gray-500">{a.motivo || '—'}</td>
                <td className="px-3 py-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded ${ESTADO_STYLE[a.estado]}`}>{a.estado}</span>
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  {a.estado === 'PENDIENTE' && can('aprobar_retroactivos') && (
                    <>
                      <button onClick={() => accion(a.id, 'aprobar', '¿Aprobar ajuste?')} className="text-green-700 hover:text-green-800 mr-2">
                        <CheckCircle2 size={16}/>
                      </button>
                      <button onClick={() => accion(a.id, 'rechazar', '¿Rechazar ajuste?')} className="text-red-600 hover:text-red-700">
                        <XCircle size={16}/>
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
