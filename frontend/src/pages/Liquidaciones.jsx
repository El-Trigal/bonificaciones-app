import { useState, useEffect, useCallback } from 'react';
import api from '../store/api';
import { useAppStore } from '../store/appStore';
import FormatCOP from '../components/shared/FormatCOP';
import StatusBadge from '../components/shared/StatusBadge';
import Modal from '../components/shared/Modal';
import Pagination from '../components/shared/Pagination';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { Search, Eye, Download, Filter, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const fmtCOP = (v) => '$' + (v || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });

export default function Liquidaciones() {
  const { selectedSemana, setSelectedSemana } = useAppStore();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [semana, setSemana] = useState(selectedSemana || '');
  const [lider, setLider] = useState('');
  const [tipo, setTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Options
  const [semanas, setSemanas] = useState([]);
  const [lideres, setLideres] = useState([]);
  const [tipos, setTipos] = useState([]);

  // Trazabilidad modal
  const [showTraza, setShowTraza] = useState(false);
  const [trazaData, setTrazaData] = useState(null);
  const [trazaLoading, setTrazaLoading] = useState(false);

  useEffect(() => {
    api.get('/liquidaciones/semanas-con-datos').then((r) => setSemanas(r.data || [])).catch(() => {});
    api.get('/liquidaciones/lideres-disponibles').then((r) => setLideres(r.data || [])).catch(() => {});
    api.get('/liquidaciones/tipos-disponibles').then((r) => setTipos(r.data || [])).catch(() => {});
  }, []);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = { page, per_page: 20 };
    if (semana) params.semana = semana;
    if (lider) params.lider = lider;
    if (tipo) params.tipo = tipo;
    if (busqueda) params.colaborador = busqueda;
    api.get('/liquidaciones', { params })
      .then((r) => {
        setItems(r.data.items || []);
        setTotal(r.data.total || 0);
        setPages(r.data.pages || 1);
      })
      .catch(() => { setItems([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, semana, lider, tipo, busqueda]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const handleExportar = async () => {
    try {
      const r = await api.get('/liquidaciones/exportar-consolidado', {
        params: { semana },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `liquidaciones_${semana || 'todas'}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error exportando:', e);
    }
  };

  const handleBuscar = (e) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liquidaciones</h1>
          <p className="text-sm text-gray-500 mt-1">Consulta detallada de bonificaciones calculadas</p>
        </div>
        <button
          onClick={handleExportar}
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <form onSubmit={handleBuscar} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select value={semana} onChange={(e) => { setSemana(e.target.value); if (e.target.value) setSelectedSemana(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            <option value="">Todas las semanas</option>
            {semanas.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={lider} onChange={(e) => { setLider(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            <option value="">Todos los líderes</option>
            {lideres.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            <option value="">Todos los tipos</option>
            {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar colaborador..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <button type="submit"
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
            Buscar
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Search className="w-10 h-10 mx-auto mb-2" />
            <p>No se encontraron liquidaciones</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Semana</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Líder</th>
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
                  <th className="px-4 py-3 text-center">Horas</th>
                  <th className="px-4 py-3 text-center">Calidad</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600">{item.semana}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{item.codigo_colaborador}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{item.nombre_colaborador}</td>
                    <td className="px-4 py-2.5 text-gray-600">{item.lider}</td>
                    <td className="px-4 py-2.5 text-gray-600">{item.labor}</td>
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
                    <td className="px-4 py-2.5 text-center"><StatusBadge value={item.cumple_minimo_horas} /></td>
                    <td className="px-4 py-2.5 text-center"><StatusBadge value={item.cumple_minimo_calidad} /></td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => handleVerDetalle(item.id)}
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 text-xs font-medium">
                        <Eye className="w-3.5 h-3.5" /> Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 border-t border-gray-200">
          <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
        </div>
      </div>

      {/* Trazabilidad Modal */}
      <TrazabilidadModal
        isOpen={showTraza}
        onClose={() => { setShowTraza(false); setTrazaData(null); }}
        data={trazaData}
        loading={trazaLoading}
      />
    </div>
  );
}

/* ========== Trazabilidad Modal Component ========== */
export function TrazabilidadModal({ isOpen, onClose, data, loading }) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Trazabilidad del Cálculo" size="xl">
      {loading ? (
        <LoadingSpinner text="Cargando trazabilidad..." />
      ) : !data ? (
        <p className="text-gray-500 text-center py-8">No se pudo cargar la trazabilidad</p>
      ) : (
        <TrazabilidadContent data={data} />
      )}
    </Modal>
  );
}

function TrazabilidadContent({ data }) {
  const { liquidacion, detalle_calculo } = data;
  const pasos = detalle_calculo?.pasos || [];
  const advertencias = detalle_calculo?.advertencias || [];
  const tipoCalculo = detalle_calculo?.tipo_calculo || '';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-emerald-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div><span className="text-gray-500">Colaborador:</span> <strong>{liquidacion?.nombre_colaborador}</strong></div>
        <div><span className="text-gray-500">Código:</span> <strong>{liquidacion?.codigo_colaborador}</strong></div>
        <div><span className="text-gray-500">Semana:</span> <strong>{liquidacion?.semana}</strong></div>
        <div><span className="text-gray-500">Labor:</span> <strong>{liquidacion?.labor}</strong></div>
      </div>

      <div className="text-xs text-gray-500">
        Tipo de cálculo: <span className="font-medium text-gray-700">{tipoCalculo}</span>
        {detalle_calculo?.version && <> | Versión: {detalle_calculo.version}</>}
      </div>

      {/* Pasos */}
      {tipoCalculo === 'LABOR_ESPECIFICA' || tipoCalculo === 'APOYO' ? (
        <LaborEspecificaPasos pasos={pasos} />
      ) : (
        <RendimientoPasos pasos={pasos} />
      )}

      {/* Resultado final */}
      {detalle_calculo?.resultado_final !== undefined && (
        <div className="bg-emerald-600 text-white rounded-lg p-4 text-center">
          <p className="text-sm opacity-90">Resultado Final</p>
          <p className="text-2xl font-bold">{fmtCOP(detalle_calculo.resultado_final)}</p>
        </div>
      )}

      {/* Advertencias */}
      {advertencias.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-1 mb-2">
            <AlertTriangle className="w-4 h-4" /> Advertencias
          </h4>
          <ul className="text-sm text-amber-700 space-y-1">
            {advertencias.map((a, i) => <li key={i}>- {a}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function RendimientoPasos({ pasos }) {
  return (
    <div className="space-y-4">
      {pasos.map((paso, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
              {paso.paso}
            </span>
            <span className="text-sm font-semibold text-gray-800">{paso.nombre}</span>
          </div>
          <div className="p-4 text-sm">
            <PasoDetalle paso={paso} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PasoDetalle({ paso }) {
  const d = paso.detalle || {};
  const num = paso.paso;

  // Paso 1: Producción - grid table
  if (num === 1) {
    const dias = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
    return (
      <div className="space-y-3">
        {d.produccion_diaria && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-1 border text-left">Concepto</th>
                  {dias.map((dia) => <th key={dia} className="px-2 py-1 border text-center">{dia}</th>)}
                  <th className="px-2 py-1 border text-center font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-2 py-1 border font-medium">Ramos/Und</td>
                  {dias.map((dia) => (
                    <td key={dia} className="px-2 py-1 border text-center">
                      {d.produccion_diaria?.[dia]?.ramos ?? '-'}
                    </td>
                  ))}
                  <td className="px-2 py-1 border text-center font-bold">{d.total_ramos ?? '-'}</td>
                </tr>
                <tr>
                  <td className="px-2 py-1 border font-medium">Horas</td>
                  {dias.map((dia) => (
                    <td key={dia} className="px-2 py-1 border text-center">
                      {d.produccion_diaria?.[dia]?.horas ?? '-'}
                    </td>
                  ))}
                  <td className="px-2 py-1 border text-center font-bold">{d.total_horas ?? '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {renderKeyValue(d, ['produccion_diaria'])}
      </div>
    );
  }

  // Paso 2: Horas - check
  if (num === 2) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">Cumple mínimo horas:</span>
          {d.cumple ? (
            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle className="w-4 h-4" /> Sí</span>
          ) : (
            <span className="flex items-center gap-1 text-red-600"><XCircle className="w-4 h-4" /> No</span>
          )}
        </div>
        {renderKeyValue(d, ['cumple'])}
      </div>
    );
  }

  // Paso 3: Calidad - check + multiplier
  if (num === 3) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">Cumple calidad:</span>
          {d.cumple ? (
            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle className="w-4 h-4" /> Sí</span>
          ) : (
            <span className="flex items-center gap-1 text-red-600"><XCircle className="w-4 h-4" /> No</span>
          )}
        </div>
        {d.multiplicador !== undefined && (
          <p><span className="font-medium">Multiplicador:</span> {d.multiplicador}</p>
        )}
        {renderKeyValue(d, ['cumple', 'multiplicador'])}
      </div>
    );
  }

  // Paso 4: Unidades - formula
  if (num === 4) {
    return (
      <div className="space-y-2">
        {d.formula && <p className="font-mono bg-gray-100 rounded p-2 text-xs">{d.formula}</p>}
        {d.resultado !== undefined && <p><span className="font-medium">Resultado:</span> {d.resultado}</p>}
        {renderKeyValue(d, ['formula', 'resultado'])}
      </div>
    );
  }

  // Paso 5: Bonificación rendimiento
  if (num === 5) {
    return (
      <div className="space-y-2">
        {d.formula && <p className="font-mono bg-gray-100 rounded p-2 text-xs">{d.formula}</p>}
        {d.valor !== undefined && <p><span className="font-medium">Valor:</span> {fmtCOP(d.valor)}</p>}
        {renderKeyValue(d, ['formula', 'valor'])}
      </div>
    );
  }

  // Paso 6: Adicionales
  if (num === 6) {
    return (
      <div className="space-y-2">
        {d.he_ordinaria !== undefined && <p>HE Ordinaria: <strong>{fmtCOP(d.he_ordinaria)}</strong></p>}
        {d.he_dominical !== undefined && <p>HE Dominical: <strong>{fmtCOP(d.he_dominical)}</strong></p>}
        {d.tarea !== undefined && <p>Tarea: <strong>{fmtCOP(d.tarea)}</strong></p>}
        {renderKeyValue(d, ['he_ordinaria', 'he_dominical', 'tarea'])}
      </div>
    );
  }

  // Paso 7: Total
  if (num === 7) {
    return (
      <div className="space-y-2">
        {d.formula && <p className="font-mono bg-gray-100 rounded p-2 text-xs">{d.formula}</p>}
        {d.total !== undefined && (
          <p className="text-lg font-bold text-emerald-700">{fmtCOP(d.total)}</p>
        )}
        {renderKeyValue(d, ['formula', 'total'])}
      </div>
    );
  }

  // Fallback
  return <div>{renderKeyValue(d, [])}</div>;
}

function LaborEspecificaPasos({ pasos }) {
  return (
    <div className="space-y-4">
      {pasos.map((paso, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center font-bold">
              {paso.paso}
            </span>
            <span className="text-sm font-semibold text-gray-800">{paso.nombre}</span>
          </div>
          <div className="p-4 text-sm">
            {paso.detalle && renderKeyValue(paso.detalle, [])}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderKeyValue(obj, exclude = []) {
  if (!obj) return null;
  const entries = Object.entries(obj).filter(([k]) => !exclude.includes(k));
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {entries.map(([k, v]) => (
        <div key={k}>
          <span className="text-gray-500">{k.replace(/_/g, ' ')}:</span>{' '}
          <span className="font-medium">
            {typeof v === 'boolean' ? (v ? 'Sí' : 'No') : typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}
