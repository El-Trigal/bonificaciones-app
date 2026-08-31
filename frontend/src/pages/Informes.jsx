import { useState, useEffect } from 'react';
import api from '../store/api';
import { useAppStore } from '../store/appStore';
import FormatCOP from '../components/shared/FormatCOP';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { Download, Clock, Star, TrendingUp, CalendarDays, UserX, LineChart as LineChartIcon, AlertTriangle, Search } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Cell, PieChart, Pie,
} from 'recharts';

const fmtCOP = (v) => '$' + (v || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });

const TABS = [
  { key: 'horas', label: 'Cumplimiento Horas', icon: Clock },
  { key: 'calidad', label: 'Distribución Calidad', icon: Star },
  { key: 'eficiencia', label: 'Eficiencia', icon: TrendingUp },
  { key: 'festivos', label: 'Festivos', icon: CalendarDays },
  { key: 'sin_bonif', label: 'Sin Bonificación', icon: UserX },
  { key: 'evolucion', label: 'Evolución', icon: LineChartIcon },
];

const MOTIVO_COLORS = {
  NO_CUMPLE_HORAS: 'bg-red-100 text-red-800',
  NO_CUMPLE_CALIDAD: 'bg-orange-100 text-orange-800',
  NO_SUPERA_MINIMO: 'bg-yellow-100 text-yellow-800',
};

const CHART_COLORS = ['#059669', '#0891b2', '#7c3aed', '#d97706', '#dc2626', '#2563eb', '#be185d', '#65a30d'];

function exportCSV(data, filename) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csv = [headers.join(','), ...data.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Informes() {
  const [activeTab, setActiveTab] = useState('horas');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Informes</h1>
        <p className="text-sm text-gray-500 mt-1">Análisis y reportes del sistema de bonificaciones</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'horas' && <TabHoras />}
      {activeTab === 'calidad' && <TabCalidad />}
      {activeTab === 'eficiencia' && <TabEficiencia />}
      {activeTab === 'festivos' && <TabFestivos />}
      {activeTab === 'sin_bonif' && <TabSinBonificacion />}
      {activeTab === 'evolucion' && <TabEvolucion />}
    </div>
  );
}

/* ========== Tab 1: Cumplimiento Horas ========== */
function TabHoras() {
  const { selectedSemana, setSelectedSemana } = useAppStore();
  const [semana, setSemana] = useState(selectedSemana || '');
  const [lider, setLider] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [semanas, setSemanas] = useState([]);
  const [lideres, setLideres] = useState([]);

  useEffect(() => {
    api.get('/liquidaciones/semanas-con-datos').then((r) => setSemanas(r.data || [])).catch(() => {});
    api.get('/liquidaciones/lideres-disponibles').then((r) => setLideres(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!semana) return;
    setLoading(true);
    const params = { semana };
    if (lider) params.lider = lider;
    api.get('/informes/cumplimiento-horas', { params })
      .then((r) => setData(r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [semana, lider]);

  const lowCompliance = data.filter((d) => d.pct_cumplimiento < 70);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={semana} onChange={(e) => { setSemana(e.target.value); if (e.target.value) setSelectedSemana(e.target.value); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent">
          <option value="">Seleccionar semana</option>
          {semanas.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={lider} onChange={(e) => setLider(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent">
          <option value="">Todos los líderes</option>
          {lideres.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={() => exportCSV(data, `cumplimiento_horas_${semana}.csv`)}
          className="ml-auto inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {lowCompliance.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Alerta: {lowCompliance.length} labor(es) con cumplimiento inferior al 70%</p>
                <p className="text-xs text-red-600 mt-1">{lowCompliance.map((d) => `${d.lider} - ${d.labor} (${d.pct_cumplimiento}%)`).join(', ')}</p>
              </div>
            </div>
          )}

          {data.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="labor" angle={-20} textAnchor="end" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="cumplieron" name="Cumplieron" fill="#059669" />
                  <Bar dataKey="no_cumplieron" name="No cumplieron" fill="#dc2626" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-4 py-3">Líder</th>
                  <th className="px-4 py-3">Labor</th>
                  <th className="px-4 py-3 text-right">Total Colab.</th>
                  <th className="px-4 py-3 text-right">Cumplieron</th>
                  <th className="px-4 py-3 text-right">No Cumplieron</th>
                  <th className="px-4 py-3 text-right">% Cumplimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((r, i) => (
                  <tr key={i} className={`hover:bg-gray-50 ${r.pct_cumplimiento < 70 ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-2.5">{r.lider}</td>
                    <td className="px-4 py-2.5">{r.labor}</td>
                    <td className="px-4 py-2.5 text-right">{r.total_colaboradores}</td>
                    <td className="px-4 py-2.5 text-right text-primary-700 font-medium">{r.cumplieron}</td>
                    <td className="px-4 py-2.5 text-right text-red-600 font-medium">{r.no_cumplieron}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.pct_cumplimiento >= 90 ? 'bg-primary-100 text-primary-800' :
                        r.pct_cumplimiento >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {r.pct_cumplimiento}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">Seleccione una semana para ver datos</p>}
          </div>
        </>
      )}
    </div>
  );
}

/* ========== Tab 2: Distribución Calidad ========== */
function TabCalidad() {
  const { selectedSemana, setSelectedSemana } = useAppStore();
  const [semana, setSemana] = useState(selectedSemana || '');
  const [labor, setLabor] = useState('');
  const [lider, setLider] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [semanas, setSemanas] = useState([]);
  const [lideres, setLideres] = useState([]);

  useEffect(() => {
    api.get('/liquidaciones/semanas-con-datos').then((r) => setSemanas(r.data || [])).catch(() => {});
    api.get('/liquidaciones/lideres-disponibles').then((r) => setLideres(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!semana) return;
    setLoading(true);
    const params = { semana };
    if (labor) params.labor = labor;
    if (lider) params.lider = lider;
    api.get('/informes/distribucion-calidad', { params })
      .then((r) => setData(r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [semana, labor, lider]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={semana} onChange={(e) => { setSemana(e.target.value); if (e.target.value) setSelectedSemana(e.target.value); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent">
          <option value="">Seleccionar semana</option>
          {semanas.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="text" value={labor} onChange={(e) => setLabor(e.target.value)} placeholder="Labor"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent" />
        <select value={lider} onChange={(e) => setLider(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent">
          <option value="">Todos los líderes</option>
          {lideres.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={() => exportCSV(data, `distribucion_calidad_${semana}.csv`)}
          className="ml-auto inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {data.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" />
                  <YAxis dataKey="rango" type="category" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, name) => name === 'bonif_promedio' ? fmtCOP(v) : v} />
                  <Legend />
                  <Bar dataKey="cantidad" name="Cantidad" fill="#059669">
                    {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-4 py-3">Rango de Calidad</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">% del Total</th>
                  <th className="px-4 py-3 text-right">Bonif. Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{r.rango}</td>
                    <td className="px-4 py-2.5 text-right">{r.cantidad}</td>
                    <td className="px-4 py-2.5 text-right">{r.pct_total}%</td>
                    <td className="px-4 py-2.5 text-right"><FormatCOP value={r.bonif_promedio} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">Seleccione una semana para ver datos</p>}
          </div>
        </>
      )}
    </div>
  );
}

/* ========== Tab 3: Eficiencia ========== */
function TabEficiencia() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [lider, setLider] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lideres, setLideres] = useState([]);

  useEffect(() => {
    api.get('/liquidaciones/lideres-disponibles').then((r) => setLideres(r.data || [])).catch(() => {});
  }, []);

  const handleBuscar = () => {
    if (!desde || !hasta) return;
    setLoading(true);
    const params = { desde, hasta };
    if (lider) params.lider = lider;
    api.get('/informes/eficiencia-rendimiento', { params })
      .then((r) => setData(r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  };

  const chartData = data.reduce((acc, r) => {
    const existing = acc.find((a) => a.semana === r.semana);
    if (existing) {
      existing[r.labor] = r.pct_supero_minimo;
    } else {
      acc.push({ semana: r.semana, [r.labor]: r.pct_supero_minimo });
    }
    return acc;
  }, []);
  const labors = [...new Set(data.map((r) => r.labor))];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input type="text" value={desde} onChange={(e) => setDesde(e.target.value)} placeholder="Desde (2026-01)"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent" />
        <input type="text" value={hasta} onChange={(e) => setHasta(e.target.value)} placeholder="Hasta (2026-14)"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent" />
        <select value={lider} onChange={(e) => setLider(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent">
          <option value="">Todos los líderes</option>
          {lideres.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={handleBuscar}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
          Consultar
        </button>
        <button onClick={() => exportCSV(data, `eficiencia_${desde}_${hasta}.csv`)}
          className="ml-auto inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {labors.map((l, i) => (
                    <Line key={l} type="monotone" dataKey={l} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-4 py-3">Labor</th>
                  <th className="px-4 py-3">Semana</th>
                  <th className="px-4 py-3 text-right">Total Colab.</th>
                  <th className="px-4 py-3 text-right">Prom. Und. Adic.</th>
                  <th className="px-4 py-3 text-right">% Superó Mín.</th>
                  <th className="px-4 py-3 text-right">Bonif. Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{r.labor}</td>
                    <td className="px-4 py-2.5">{r.semana}</td>
                    <td className="px-4 py-2.5 text-right">{r.total_colaboradores}</td>
                    <td className="px-4 py-2.5 text-right">{r.prom_unidades_adicionales?.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right">{r.pct_supero_minimo}%</td>
                    <td className="px-4 py-2.5 text-right"><FormatCOP value={r.bonif_promedio} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">Ingrese rango de fechas para consultar</p>}
          </div>
        </>
      )}
    </div>
  );
}

/* ========== Tab 4: Festivos ========== */
function TabFestivos() {
  const [anio, setAnio] = useState('2026');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleBuscar = () => {
    setLoading(true);
    api.get('/informes/impacto-festivos', { params: { año: anio } })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { handleBuscar(); }, []);

  const detalle = data?.detalle || [];
  const resumen = data?.resumen || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input type="text" value={anio} onChange={(e) => setAnio(e.target.value)} placeholder="Año"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24 focus:ring-2 focus:ring-accent" />
        <button onClick={handleBuscar}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
          Consultar
        </button>
        <button onClick={() => exportCSV(detalle, `festivos_${anio}.csv`)}
          className="ml-auto inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {loading ? <LoadingSpinner /> : data && (
        <>
          {/* Summary card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-center">
              <p className="text-xs text-gray-500 uppercase">Bonif. Prom. Semana Normal</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmtCOP(resumen.bonif_promedio_normal)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-center">
              <p className="text-xs text-gray-500 uppercase">Bonif. Prom. Semana Festivo</p>
              <p className="text-xl font-bold text-amber-700 mt-1">{fmtCOP(resumen.bonif_promedio_festivo)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-center">
              <p className="text-xs text-gray-500 uppercase">Impacto Porcentual</p>
              <p className={`text-xl font-bold mt-1 ${(resumen.impacto_porcentual || 0) >= 0 ? 'text-primary-700' : 'text-red-700'}`}>
                {resumen.impacto_porcentual > 0 ? '+' : ''}{resumen.impacto_porcentual}%
              </p>
            </div>
          </div>

          {detalle.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={detalle}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                  <YAxis tickFormatter={(v) => fmtCOP(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtCOP(v)} />
                  <Legend />
                  <Bar dataKey="bonif_promedio" name="Bonif. Promedio">
                    {detalle.map((d, i) => (
                      <Cell key={i} fill={d.tiene_festivo ? '#d97706' : '#059669'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary-600 inline-block"></span> Semana normal</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-600 inline-block"></span> Semana con festivo</span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-4 py-3">Semana</th>
                  <th className="px-4 py-3 text-center">Festivo</th>
                  <th className="px-4 py-3 text-right">Horas Config.</th>
                  <th className="px-4 py-3 text-right">Total Bonif.</th>
                  <th className="px-4 py-3 text-right">Colaboradores</th>
                  <th className="px-4 py-3 text-right">Bonif. Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detalle.map((r, i) => (
                  <tr key={i} className={`hover:bg-gray-50 ${r.tiene_festivo ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-4 py-2.5 font-medium">{r.semana}</td>
                    <td className="px-4 py-2.5 text-center">
                      {r.tiene_festivo ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">Sí</span>
                      ) : (
                        <span className="text-gray-400 text-xs">No</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">{r.horas_configuradas}</td>
                    <td className="px-4 py-2.5 text-right"><FormatCOP value={r.total_bonif} /></td>
                    <td className="px-4 py-2.5 text-right">{r.total_colaboradores}</td>
                    <td className="px-4 py-2.5 text-right"><FormatCOP value={r.bonif_promedio} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ========== Tab 5: Sin Bonificación ========== */
function TabSinBonificacion() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [lider, setLider] = useState('');
  const [motivo, setMotivo] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lideres, setLideres] = useState([]);

  useEffect(() => {
    api.get('/liquidaciones/lideres-disponibles').then((r) => setLideres(r.data || [])).catch(() => {});
  }, []);

  const handleBuscar = () => {
    setLoading(true);
    const params = {};
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    if (lider) params.lider = lider;
    if (motivo) params.motivo = motivo;
    api.get('/informes/colaboradores-sin-bonificacion', { params })
      .then((r) => setData(r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input type="text" value={desde} onChange={(e) => setDesde(e.target.value)} placeholder="Desde"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent" />
        <input type="text" value={hasta} onChange={(e) => setHasta(e.target.value)} placeholder="Hasta"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent" />
        <select value={lider} onChange={(e) => setLider(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent">
          <option value="">Todos los líderes</option>
          {lideres.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent">
          <option value="">Todos los motivos</option>
          <option value="NO_CUMPLE_HORAS">No cumple horas</option>
          <option value="NO_CUMPLE_CALIDAD">No cumple calidad</option>
          <option value="NO_SUPERA_MINIMO">No supera mínimo</option>
        </select>
        <button onClick={handleBuscar}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
          Consultar
        </button>
        <button onClick={() => exportCSV(data, 'sin_bonificacion.csv')}
          className="ml-auto inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Líder</th>
                <th className="px-4 py-3">Labor</th>
                <th className="px-4 py-3 text-right">Semanas Sin Bonif.</th>
                <th className="px-4 py-3">Motivo Más Frecuente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.sort((a, b) => b.semanas_sin_bonif - a.semanas_sin_bonif).map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs">{r.codigo}</td>
                  <td className="px-4 py-2.5 font-medium">{r.nombre}</td>
                  <td className="px-4 py-2.5">{r.lider}</td>
                  <td className="px-4 py-2.5">{r.labor}</td>
                  <td className="px-4 py-2.5 text-right font-bold">{r.semanas_sin_bonif}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MOTIVO_COLORS[r.motivo_mas_frecuente] || 'bg-gray-100 text-gray-700'}`}>
                      {r.motivo_mas_frecuente?.replace(/_/g, ' ') || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">Ingrese filtros y consulte</p>}
        </div>
      )}
    </div>
  );
}

/* ========== Tab 6: Evolución Colaborador ========== */
function TabEvolucion() {
  const [codigo, setCodigo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleBuscar = () => {
    if (!codigo.trim()) return;
    setLoading(true);
    const params = {};
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    api.get(`/informes/evolucion-colaborador/${encodeURIComponent(codigo.trim())}`, { params })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  const datos = data?.datos || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código del colaborador"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent" />
        </div>
        <input type="text" value={desde} onChange={(e) => setDesde(e.target.value)} placeholder="Desde"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent w-32" />
        <input type="text" value={hasta} onChange={(e) => setHasta(e.target.value)} placeholder="Hasta"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent w-32" />
        <button onClick={handleBuscar}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
          Consultar
        </button>
        <button onClick={() => exportCSV(datos, `evolucion_${codigo}.csv`)}
          className="ml-auto inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {loading ? <LoadingSpinner /> : data && (
        <>
          {data.colaborador && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-sm">
              <strong>{data.colaborador.nombre}</strong> - Código: {data.colaborador.codigo}
            </div>
          )}

          {datos.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Evolución Semanal</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={datos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tickFormatter={(v) => fmtCOP(v)} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, name) => name === 'Bonificación' ? fmtCOP(v) : v} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="total_bonificacion" name="Bonificación" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="unidades_ejecutadas" name="Und. Ejecutadas" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="pct_calidad" name="% Calidad" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-4 py-3">Semana</th>
                  <th className="px-4 py-3">Labor</th>
                  <th className="px-4 py-3 text-right">Und. Req.</th>
                  <th className="px-4 py-3 text-right">Und. Ejec.</th>
                  <th className="px-4 py-3 text-right">Und. Adic.</th>
                  <th className="px-4 py-3 text-right">% Calidad</th>
                  <th className="px-4 py-3 text-right">Total Bonif.</th>
                  <th className="px-4 py-3 text-center">Horas</th>
                  <th className="px-4 py-3 text-center">Calidad</th>
                  <th className="px-4 py-3 text-center">Superó Mín.</th>
                  <th className="px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {datos.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{r.semana}</td>
                    <td className="px-4 py-2.5">{r.labor}</td>
                    <td className="px-4 py-2.5 text-right">{r.unidades_requeridas}</td>
                    <td className="px-4 py-2.5 text-right">{r.unidades_ejecutadas}</td>
                    <td className="px-4 py-2.5 text-right">{r.unidades_adicionales}</td>
                    <td className="px-4 py-2.5 text-right">{r.pct_calidad}%</td>
                    <td className="px-4 py-2.5 text-right font-bold text-primary-700"><FormatCOP value={r.total_bonificacion} /></td>
                    <td className="px-4 py-2.5 text-center">{r.cumple_horas ? '✓' : '✗'}</td>
                    <td className="px-4 py-2.5 text-center">{r.cumple_calidad ? '✓' : '✗'}</td>
                    <td className="px-4 py-2.5 text-center">{r.supero_minimo ? '✓' : '✗'}</td>
                    <td className="px-4 py-2.5">
                      {r.motivo && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MOTIVO_COLORS[r.motivo] || 'bg-gray-100 text-gray-700'}`}>
                          {r.motivo?.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {datos.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">Busque un colaborador para ver su evolución</p>}
          </div>
        </>
      )}
    </div>
  );
}
