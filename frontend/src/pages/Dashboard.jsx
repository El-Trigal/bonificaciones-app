import { useState, useEffect } from 'react';
import api from '../store/api';
import { useAppStore } from '../store/appStore';
import FormatCOP from '../components/shared/FormatCOP';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { DollarSign, Users, FileText, AlertTriangle, Download } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const fmtCOP = (v) => '$' + (v || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });

export default function Dashboard() {
  const { selectedSemana, setSelectedSemana } = useAppStore();
  const [semanas, setSemanas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    api.get('/dashboard/semanas-disponibles').then((r) => {
      const data = r.data || [];
      setSemanas(data);
      if (!selectedSemana && data.length > 0) {
        setSelectedSemana(data[0].semana);
      }
    }).catch(() => setSemanas([]));
  }, []);

  useEffect(() => {
    if (!selectedSemana) return;
    setLoading(true);
    api.get('/dashboard/resumen', { params: { semana: selectedSemana } })
      .then((r) => setResumen(r.data))
      .catch(() => setResumen(null))
      .finally(() => setLoading(false));
  }, [selectedSemana]);

  const handleExportar = async () => {
    setExportando(true);
    try {
      const r = await api.get('/liquidaciones/exportar-consolidado', {
        params: { semana: selectedSemana },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `consolidado_${selectedSemana}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error exportando:', e);
    } finally {
      setExportando(false);
    }
  };

  const kpis = resumen
    ? [
        { label: 'Total a Pagar', value: fmtCOP(resumen.total_a_pagar), icon: DollarSign, color: 'emerald' },
        { label: 'Colaboradores con Bonificación', value: resumen.colaboradores_con_bonificacion, icon: Users, color: 'blue' },
        { label: 'Registros Cargados', value: resumen.registros_cargados, icon: FileText, color: 'violet' },
        { label: 'Sin Bonificación', value: resumen.sin_bonificacion, icon: AlertTriangle, color: 'amber' },
      ]
    : [];

  const colorMap = {
    emerald: 'bg-primary-50 text-primary-700 border-primary-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  const iconBg = {
    emerald: 'bg-primary-100 text-primary-600',
    blue: 'bg-blue-100 text-blue-600',
    violet: 'bg-violet-100 text-violet-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  const liderData = resumen?.resumen_por_lider || [];
  const totalesFooter = liderData.reduce(
    (acc, r) => ({
      rendimiento: acc.rendimiento + (r.rendimiento || 0),
      labor_especifica: acc.labor_especifica + (r.labor_especifica || 0),
      apoyo: acc.apoyo + (r.apoyo || 0),
      auxilio_constitutiva: acc.auxilio_constitutiva + (r.auxilio_constitutiva || 0),
      total: acc.total + (r.total || 0),
    }),
    { rendimiento: 0, labor_especifica: 0, apoyo: 0, auxilio_constitutiva: 0, total: 0 }
  );

  const chartData = liderData.map((r) => ({
    lider: r.lider?.length > 15 ? r.lider.slice(0, 15) + '...' : r.lider,
    Rendimiento: r.rendimiento || 0,
    'Labor Esp.': r.labor_especifica || 0,
    Apoyo: r.apoyo || 0,
    'Aux/Constitutiva': r.auxilio_constitutiva || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Resumen general de bonificaciones</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedSemana || ''}
            onChange={(e) => setSelectedSemana(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-accent focus:border-primary-500"
          >
            <option value="">Seleccionar semana</option>
            {semanas.map((s) => (
              <option key={s.semana} value={s.semana}>
                {s.semana} ({s.colaboradores} colab. - {fmtCOP(s.total)})
              </option>
            ))}
          </select>
          <button
            onClick={handleExportar}
            disabled={!selectedSemana || exportando}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {exportando ? 'Exportando...' : 'Exportar Consolidado'}
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Cargando resumen..." />
      ) : !resumen ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3" />
          <p className="text-lg">Seleccione una semana para ver el resumen</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className={`rounded-xl border p-5 ${colorMap[kpi.color]}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium opacity-80 uppercase tracking-wider">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${iconBg[kpi.color]}`}>
                    <kpi.icon className="w-6 h-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen por Líder */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Resumen por Líder</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Líder</th>
                    <th className="px-6 py-3 text-right">Rendimiento</th>
                    <th className="px-6 py-3 text-right">Labor Esp.</th>
                    <th className="px-6 py-3 text-right">Apoyo</th>
                    <th className="px-6 py-3 text-right">Aux/Constitutiva</th>
                    <th className="px-6 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {liderData.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{r.lider}</td>
                      <td className="px-6 py-3 text-right"><FormatCOP value={r.rendimiento} /></td>
                      <td className="px-6 py-3 text-right"><FormatCOP value={r.labor_especifica} /></td>
                      <td className="px-6 py-3 text-right"><FormatCOP value={r.apoyo} /></td>
                      <td className="px-6 py-3 text-right"><FormatCOP value={r.auxilio_constitutiva} /></td>
                      <td className="px-6 py-3 text-right font-semibold text-primary-700"><FormatCOP value={r.total} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-primary-50 font-bold text-primary-900">
                    <td className="px-6 py-3">TOTAL</td>
                    <td className="px-6 py-3 text-right"><FormatCOP value={totalesFooter.rendimiento} /></td>
                    <td className="px-6 py-3 text-right"><FormatCOP value={totalesFooter.labor_especifica} /></td>
                    <td className="px-6 py-3 text-right"><FormatCOP value={totalesFooter.apoyo} /></td>
                    <td className="px-6 py-3 text-right"><FormatCOP value={totalesFooter.auxilio_constitutiva} /></td>
                    <td className="px-6 py-3 text-right"><FormatCOP value={totalesFooter.total} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Gráfico */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Líder</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="lider" angle={-25} textAnchor="end" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => fmtCOP(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtCOP(v)} />
                  <Legend />
                  <Bar dataKey="Rendimiento" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Labor Esp." stackId="a" fill="#0891b2" />
                  <Bar dataKey="Apoyo" stackId="a" fill="#7c3aed" />
                  <Bar dataKey="Aux/Constitutiva" stackId="a" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
