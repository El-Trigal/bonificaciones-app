import { useState, useEffect } from 'react';
import api from '../store/api';
import FormatCOP from '../components/shared/FormatCOP';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { TrazabilidadModal } from './Liquidaciones';
import { Search, User, TrendingUp, Calendar } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const fmtCOP = (v) => '$' + (v || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });

export default function Trazabilidad() {
  const [busqueda, setBusqueda] = useState('');
  const [colaborador, setColaborador] = useState(null);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [resumenSemana, setResumenSemana] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Filters
  const [filtroSemana, setFiltroSemana] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // Traza modal
  const [showTraza, setShowTraza] = useState(false);
  const [trazaData, setTrazaData] = useState(null);
  const [trazaLoading, setTrazaLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!busqueda.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const r = await api.get(`/liquidaciones/colaborador/${encodeURIComponent(busqueda.trim())}`);
      setColaborador(r.data.colaborador || null);
      setLiquidaciones(r.data.liquidaciones || []);
      setResumenSemana(r.data.resumen_por_semana || []);
    } catch {
      setColaborador(null);
      setLiquidaciones([]);
      setResumenSemana([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = async (id) => {
    setShowTraza(true);
    setTrazaLoading(true);
    try {
      const r = await api.get(`/liquidaciones/${id}/trazabilidad`);
      setTrazaData(r.data);
    } catch {
      setTrazaData(null);
    } finally {
      setTrazaLoading(false);
    }
  };

  const filteredLiq = liquidaciones.filter((l) => {
    if (filtroSemana && l.semana !== filtroSemana) return false;
    if (filtroTipo && l.tipo_bonificacion !== filtroTipo) return false;
    return true;
  });

  const semanasUnicas = [...new Set(liquidaciones.map((l) => l.semana))].sort();
  const tiposUnicos = [...new Set(liquidaciones.map((l) => l.tipo_bonificacion))];

  const chartData = resumenSemana.map((s) => ({
    semana: s.semana,
    total: s.total || 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trazabilidad por Colaborador</h1>
        <p className="text-sm text-gray-500 mt-1">Busque un colaborador para ver su historial detallado de bonificaciones</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSearch} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Código o nombre del colaborador</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej: 12345 o Juan Pérez"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !busqueda.trim()}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </form>
      </div>

      {loading && <LoadingSpinner text="Buscando colaborador..." />}

      {!loading && searched && !colaborador && (
        <div className="text-center py-12 text-gray-400">
          <User className="w-12 h-12 mx-auto mb-3" />
          <p className="text-lg">No se encontró el colaborador</p>
          <p className="text-sm">Verifique el código o nombre e intente de nuevo</p>
        </div>
      )}

      {!loading && colaborador && (
        <>
          {/* Employee card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <User className="w-7 h-7 text-emerald-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{colaborador.nombre}</h2>
                <p className="text-sm text-gray-500">Código: <span className="font-mono font-medium">{colaborador.codigo}</span></p>
              </div>
              <div className="ml-auto grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Semanas</p>
                  <p className="text-xl font-bold text-gray-900">{resumenSemana.length}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Liquidaciones</p>
                  <p className="text-xl font-bold text-gray-900">{liquidaciones.length}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Total Bonif.</p>
                  <p className="text-xl font-bold text-emerald-700">
                    {fmtCOP(resumenSemana.reduce((s, r) => s + (r.total || 0), 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Evolución de Bonificación por Semana
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => fmtCOP(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtCOP(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="Bonificación Total" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Filters + Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400" />
              <select value={filtroSemana} onChange={(e) => setFiltroSemana(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500">
                <option value="">Todas las semanas</option>
                {semanasUnicas.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500">
                <option value="">Todos los tipos</option>
                {tiposUnicos.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="ml-auto text-sm text-gray-500">{filteredLiq.length} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Semana</th>
                    <th className="px-4 py-3">Labor</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Rendim.</th>
                    <th className="px-4 py-3 text-right">HE Ord.</th>
                    <th className="px-4 py-3 text-right">HE Dom.</th>
                    <th className="px-4 py-3 text-right">Tarea</th>
                    <th className="px-4 py-3 text-right">Lab. Esp.</th>
                    <th className="px-4 py-3 text-right">Apoyo</th>
                    <th className="px-4 py-3 text-right">Auxilio</th>
                    <th className="px-4 py-3 text-right">Constit.</th>
                    <th className="px-4 py-3 text-right font-bold">Total</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLiq.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600">{item.semana}</td>
                      <td className="px-4 py-2.5">{item.labor}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">{item.tipo_bonificacion}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right"><FormatCOP value={item.bonif_rendimiento} /></td>
                      <td className="px-4 py-2.5 text-right"><FormatCOP value={item.bonif_he_ordinaria} /></td>
                      <td className="px-4 py-2.5 text-right"><FormatCOP value={item.bonif_he_dominical} /></td>
                      <td className="px-4 py-2.5 text-right"><FormatCOP value={item.bonif_tarea} /></td>
                      <td className="px-4 py-2.5 text-right"><FormatCOP value={item.bonif_labor_especifica} /></td>
                      <td className="px-4 py-2.5 text-right"><FormatCOP value={item.bonif_apoyo} /></td>
                      <td className="px-4 py-2.5 text-right"><FormatCOP value={item.bonif_auxilio} /></td>
                      <td className="px-4 py-2.5 text-right"><FormatCOP value={item.bonif_constitutiva} /></td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-700"><FormatCOP value={item.total_bonificacion} /></td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => handleVerDetalle(item.id)}
                          className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredLiq.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">No hay liquidaciones con los filtros seleccionados</div>
            )}
          </div>
        </>
      )}

      <TrazabilidadModal
        isOpen={showTraza}
        onClose={() => { setShowTraza(false); setTrazaData(null); }}
        data={trazaData}
        loading={trazaLoading}
      />
    </div>
  );
}
