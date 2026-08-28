import { useEffect, useState } from 'react';
import { Lock, CheckCircle2, FileDown, Eye, Unlock } from 'lucide-react';
import api from '../store/api';
import useAuthStore from '../store/authStore';
import Modal from '../components/shared/Modal';

const fmtCOP = (v) => '$' + Math.round(v || 0).toLocaleString('es-CO');

const ESTADO_STYLE = {
  ABIERTO:  'bg-amber-100 text-amber-800',
  CERRADO:  'bg-blue-100 text-blue-800',
  PAGADO:   'bg-green-100 text-green-800',
};

export default function PeriodosNomina() {
  const { can } = useAuthStore();
  const [periodos, setPeriodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [consolidado, setConsolidado] = useState(null);
  const [error, setError] = useState('');

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get('/periodos', { params: { año: 2026 } });
      setPeriodos(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  async function accion(id, path, confirmMsg) {
    if (!confirm(confirmMsg)) return;
    setError('');
    try {
      await api.post(`/periodos/${id}/${path}`);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error');
    }
  }

  async function verConsolidado(p) {
    setError('');
    try {
      const { data } = await api.get(`/periodos/${p.id}/consolidado`);
      setConsolidado(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar consolidado');
    }
  }

  function exportarCSV() {
    if (!consolidado) return;
    const headers = ['CODIGO', 'NOMBRE', 'TIPOS', 'PERMANENCIA', 'RENDIMIENTO', 'TOTAL'];
    const lineas = [headers.join(',')];
    consolidado.filas.forEach((f) => {
      lineas.push([
        f.codigo, `"${f.nombre}"`, `"${f.tipos.join('; ')}"`,
        Math.round(f.permanencia), Math.round(f.rendimiento), Math.round(f.total),
      ].join(','));
    });
    lineas.push(['', '', 'TOTALES',
      Math.round(consolidado.totales.permanencia),
      Math.round(consolidado.totales.rendimiento),
      Math.round(consolidado.totales.total)].join(','));
    const blob = new Blob(['\ufeff' + lineas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `consolidado_${consolidado.periodo}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Periodos de nómina</h1>
        <p className="text-sm text-gray-500">Quincenas colombianas · pago 15 y fin de mes</p>
      </div>

      {error && <div className="mb-3 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Periodo</th>
              <th className="px-4 py-3 text-left">Rango</th>
              <th className="px-4 py-3 text-left">Pago</th>
              <th className="px-4 py-3 text-left">Semanas</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">Cargando...</td></tr>
            ) : periodos.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono">{p.codigo}</td>
                <td className="px-4 py-2 text-gray-600">{p.fecha_inicio} → {p.fecha_fin}</td>
                <td className="px-4 py-2 font-medium">{p.fecha_pago}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{p.semanas.join(', ') || '—'}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${ESTADO_STYLE[p.estado]}`}>{p.estado}</span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => verConsolidado(p)} className="text-primary hover:text-primary-dark mr-2 inline-flex items-center gap-1 text-xs">
                    <Eye size={14}/> Consolidado
                  </button>
                  {p.estado === 'ABIERTO' && can('cerrar_periodo') && (
                    <button onClick={() => accion(p.id, 'cerrar', `¿Cerrar ${p.codigo}?`)} className="text-blue-600 hover:text-blue-700 mr-2 inline-flex items-center gap-1 text-xs">
                      <Lock size={14}/> Cerrar
                    </button>
                  )}
                  {p.estado === 'CERRADO' && can('cerrar_periodo') && (
                    <button onClick={() => accion(p.id, 'reabrir', `¿Reabrir ${p.codigo}?`)} className="text-amber-600 hover:text-amber-700 mr-2 inline-flex items-center gap-1 text-xs">
                      <Unlock size={14}/> Reabrir
                    </button>
                  )}
                  {p.estado === 'CERRADO' && can('marcar_pagado') && (
                    <button onClick={() => accion(p.id, 'marcar-pagado', `¿Marcar ${p.codigo} como PAGADO? Esta acción no se puede revertir.`)} className="text-green-700 hover:text-green-800 inline-flex items-center gap-1 text-xs">
                      <CheckCircle2 size={14}/> Marcar pagado
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {consolidado && (
        <Modal isOpen title={`Consolidado · ${consolidado.periodo}`} onClose={() => setConsolidado(null)} size="full">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {consolidado.cantidad_colaboradores} colaboradores · Semanas: {consolidado.semanas.join(', ')} · Pago: {consolidado.fecha_pago}
              </div>
              <button onClick={exportarCSV} className="flex items-center gap-2 bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark text-sm">
                <FileDown size={14}/> Exportar CSV
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0 text-xs uppercase text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Código</th>
                      <th className="px-3 py-2 text-left">Nombre</th>
                      <th className="px-3 py-2 text-left">Tipos de bonificación</th>
                      <th className="px-3 py-2 text-right">Permanencia</th>
                      <th className="px-3 py-2 text-right">Rendimiento</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {consolidado.filas.length === 0 ? (
                      <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-400">Sin liquidaciones en este periodo</td></tr>
                    ) : consolidado.filas.map((f) => (
                      <tr key={f.codigo} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-mono">{f.codigo}</td>
                        <td className="px-3 py-1.5">{f.nombre}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-600">{f.tipos.join(', ')}</td>
                        <td className="px-3 py-1.5 text-right">{fmtCOP(f.permanencia)}</td>
                        <td className="px-3 py-1.5 text-right">{fmtCOP(f.rendimiento)}</td>
                        <td className="px-3 py-1.5 text-right font-semibold">{fmtCOP(f.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {consolidado.filas.length > 0 && (
                    <tfoot className="bg-gray-50 font-semibold">
                      <tr>
                        <td colSpan="3" className="px-3 py-2 text-right">TOTALES</td>
                        <td className="px-3 py-2 text-right">{fmtCOP(consolidado.totales.permanencia)}</td>
                        <td className="px-3 py-2 text-right">{fmtCOP(consolidado.totales.rendimiento)}</td>
                        <td className="px-3 py-2 text-right">{fmtCOP(consolidado.totales.total)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
