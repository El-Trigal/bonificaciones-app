import { useEffect, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
  XCircle, ArrowRight, RefreshCw, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import api from '../store/api';

export default function CargaDatos() {
  const [plantillas, setPlantillas] = useState([]);
  const [plantillaId, setPlantillaId] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [erroresExpandidos, setErroresExpandidos] = useState(false);
  const [advertenciasExpandidas, setAdvertenciasExpandidas] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    api.get('/plantillas').then(({ data }) => {
      setPlantillas(data.filter((p) => p.activo));
    });
  }, []);

  function reset() {
    setPlantillaId('');
    setArchivo(null);
    setPreview(null);
    setResultado(null);
    setError('');
    setErroresExpandidos(false);
    setAdvertenciasExpandidas(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  const plantillaSel = plantillas.find((p) => p.id === parseInt(plantillaId));
  const esSemanal = plantillaSel?.tipo === 'RENDIMIENTO_SEMANAL';

  async function hacerPreview() {
    setError('');
    if (!plantillaId || !archivo) {
      setError('Selecciona una plantilla y un archivo antes de continuar');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('plantilla_id', plantillaId);
      fd.append('archivo', archivo);
      const endpoint = esSemanal
        ? '/registros-diarios/preview-semanal'
        : '/registros-diarios/preview';
      const { data } = await api.post(endpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al procesar el archivo');
    } finally {
      setLoading(false);
    }
  }

  async function confirmar() {
    setLoading(true);
    setError('');
    try {
      let data;
      if (esSemanal) {
        const res = await api.post('/registros-diarios/confirmar-semanal', {
          plantilla_id: parseInt(plantillaId),
          archivo: preview.archivo,
          registros_diarios: preview.registros_diarios,
          registros_calidad: preview.registros_calidad,
        });
        data = res.data;
      } else {
        const res = await api.post('/registros-diarios/confirmar', {
          plantilla_id: parseInt(plantillaId),
          archivo: preview.archivo,
          registros: preview.registros,
        });
        data = res.data;
      }
      setResultado(data);
      setPreview(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al confirmar');
    } finally {
      setLoading(false);
    }
  }

  // Para el flujo semanal: FESTIVO_HORAS_ORD se muestra pero NO bloquea (el parser ya corrigió h_ord=0)
  const erroresSemanal = preview?.errores ?? [];
  const erroresBloqueo = esSemanal
    ? erroresSemanal.filter((e) => e.tipo !== 'FESTIVO_HORAS_ORD')
    : erroresSemanal;
  const advertencias = preview?.advertencias ?? [];

  const hayErroresBloqueo = erroresBloqueo.length > 0;
  const hayRegistros = esSemanal
    ? (preview?.registros_ok ?? 0) > 0
    : (preview?.registros_ok ?? 0) > 0;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Carga de datos</h1>
      <p className="text-sm text-gray-500 mb-6">Selecciona plantilla, sube el archivo, valida y confirma.</p>

      {/* ── Resultado exitoso ────────────────────────────── */}
      {resultado && (
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-6 space-y-4">
          <div className="flex flex-col items-center text-center gap-2 py-2">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={30} className="text-green-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-800">
              Carga confirmada <span className="text-gray-400 font-normal text-sm">(#{resultado.carga_id})</span>
            </h3>
          </div>
          {esSemanal ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Reg. insertados"   value={resultado.insertados}            color="green" />
              <StatCard label="Reg. actualizados" value={resultado.actualizados}          color="blue"  />
              <StatCard label="Calidad nuevos"     value={resultado.calidad_insertados}   color="green" />
              <StatCard label="Calidad actualizados" value={resultado.calidad_actualizados} color="blue" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Insertados"   value={resultado.insertados}            color="green" />
              <StatCard label="Actualizados" value={resultado.actualizados}          color="blue"  />
              <StatCard label="Errores"      value={resultado.errores?.length ?? 0}  color={resultado.errores?.length ? 'red' : 'gray'} />
            </div>
          )}
          {resultado.errores?.length > 0 && (
            <ul className="text-xs text-red-600 font-mono space-y-1 bg-red-50 rounded-xl px-4 py-3 max-h-36 overflow-y-auto">
              {resultado.errores.map((e, i) => <li key={i}>{JSON.stringify(e)}</li>)}
            </ul>
          )}
          <button
            onClick={reset}
            className="w-full py-2 bg-primary-700 text-white rounded-xl text-sm hover:bg-primary-800"
          >
            Cargar otro archivo
          </button>
        </div>
      )}

      {/* ── Formulario principal ─────────────────────────── */}
      {!resultado && (
        <div className="bg-white rounded-2xl shadow border border-gray-200 overflow-hidden">

          {/* Info de formato */}
          <div className="border-b border-blue-100 bg-blue-50 px-6 py-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
              <Info size={15} /> Formato aceptado
            </div>
            <p className="text-xs text-blue-600">
              {esSemanal
                ? 'Reporte semanal de rendimiento en formato Excel (.xlsx). Las columnas se leen por posición fija.'
                : <>Archivos <span className="font-mono font-semibold">.xlsx</span>,{' '}
                   <span className="font-mono font-semibold">.xls</span> o{' '}
                   <span className="font-mono font-semibold">.csv</span>.
                   Las columnas requeridas dependen de la plantilla seleccionada.</>
              }
            </p>
          </div>

          <div className="p-6 space-y-5">
            {/* Selector de plantilla */}
            {!preview && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla</label>
                  <select
                    value={plantillaId}
                    onChange={(e) => { setPlantillaId(e.target.value); setPreview(null); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    <option value="">— Selecciona una plantilla —</option>
                    {plantillas.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre} · {p.tipo}</option>
                    ))}
                  </select>
                  {plantillaSel && (
                    <p className="text-xs text-gray-500 mt-1">
                      Unidad: {plantillaSel.unidad_origen}
                      {plantillaSel.configuracion?.labor_fija && ` · Labor fija: ${plantillaSel.configuracion.labor_fija}`}
                    </p>
                  )}
                </div>

                {/* Zona de carga de archivo */}
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={28} className="mx-auto text-gray-400 mb-2" />
                  {archivo ? (
                    <div>
                      <p className="text-sm font-medium text-primary-700">{archivo.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{(archivo.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-500">Haz clic para seleccionar un archivo</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {esSemanal ? 'Formato: .xlsx' : 'Formatos: .xlsx, .xls, .csv'}
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={esSemanal ? '.xlsx' : '.xlsx,.xls,.csv'}
                    onChange={(e) => { setArchivo(e.target.files?.[0] || null); setPreview(null); }}
                    className="hidden"
                  />
                </div>
              </>
            )}

            {/* Error global */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2.5 rounded-xl text-sm">
                <XCircle size={15} /> {error}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center gap-3 py-2 text-sm text-gray-500">
                <RefreshCw size={18} className="animate-spin text-primary-600" />
                {preview ? 'Guardando datos…' : 'Analizando archivo…'}
              </div>
            )}

            {/* ── Preview / resultados de validación ── */}
            {preview && !loading && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <FileSpreadsheet size={16} className="text-primary-600" />
                  {archivo?.name}
                </div>

                {/* Resumen estadísticas */}
                {esSemanal ? (
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard label="Filas Excel"       value={preview.total_filas_excel}  color="gray"  />
                    <StatCard label="Reg. diarios"      value={preview.registros_ok}       color="green" />
                    <StatCard label="% Calidad"         value={preview.calidad_ok}         color="blue"  />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard label="Total filas"  value={preview.total_filas}          color="gray"  />
                    <StatCard label="Registros OK" value={preview.registros_ok}         color="green" />
                    <StatCard label="Errores"      value={preview.errores?.length ?? 0} color={preview.errores?.length ? 'red' : 'gray'} />
                  </div>
                )}

                {/* Advertencias (fuzzy labor / festivos) */}
                {esSemanal && advertencias.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-amber-700"
                      onClick={() => setAdvertenciasExpandidas(!advertenciasExpandidas)}
                    >
                      <span className="flex items-center gap-2">
                        <AlertTriangle size={15} />
                        {advertencias.length} {advertencias.length === 1 ? 'advertencia' : 'advertencias'} (no bloqueantes)
                      </span>
                      {advertenciasExpandidas ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    {advertenciasExpandidas && (
                      <ul className="px-4 pb-3 space-y-1 max-h-48 overflow-y-auto">
                        {advertencias.slice(0, 100).map((a, i) => (
                          <li key={i} className="text-xs text-amber-700 font-mono">
                            Fila {a.fila} {a.colaborador ? `(${a.colaborador})` : ''}: {a.mensaje}
                          </li>
                        ))}
                        {advertencias.length > 100 && (
                          <li className="text-xs text-amber-500">…y {advertencias.length - 100} más</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}

                {/* Errores */}
                {erroresSemanal.length > 0 && (
                  <div className="rounded-xl border border-red-100 bg-red-50 overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-red-700"
                      onClick={() => setErroresExpandidos(!erroresExpandidos)}
                    >
                      <span className="flex items-center gap-2">
                        <XCircle size={15} />
                        {erroresSemanal.length} {erroresSemanal.length === 1 ? 'error' : 'errores'} encontrados
                        {esSemanal && erroresBloqueo.length < erroresSemanal.length && (
                          <span className="text-xs font-normal text-red-500 ml-1">
                            ({erroresSemanal.length - erroresBloqueo.length} corregidos automáticamente)
                          </span>
                        )}
                      </span>
                      {erroresExpandidos ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    {erroresExpandidos && (
                      <ul className="px-4 pb-3 space-y-1 max-h-48 overflow-y-auto">
                        {erroresSemanal.slice(0, 100).map((e, i) => (
                          <li key={i} className={`text-xs font-mono ${e.tipo === 'FESTIVO_HORAS_ORD' ? 'text-amber-600' : 'text-red-600'}`}>
                            {e.fila ? `Fila ${e.fila}` : ''}{e.colaborador ? ` (${e.colaborador})` : ''}{e.fila || e.colaborador ? ': ' : ''}{e.mensaje || e.error}
                            {e.tipo === 'FESTIVO_HORAS_ORD' && <span className="ml-1 text-amber-500">[corregido]</span>}
                          </li>
                        ))}
                        {erroresSemanal.length > 100 && (
                          <li className="text-xs text-red-400">…y {erroresSemanal.length - 100} más</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}

                {/* Tabla de preview */}
                {preview.preview?.length > 0 && (
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2.5 text-xs font-medium text-gray-500">
                      Vista previa · {preview.preview.length} de {preview.registros_ok} registros
                    </div>
                    <div className="overflow-x-auto max-h-72">
                      {esSemanal ? (
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              {['Fecha','Día','Semana','Código','Nombre','Labor','Ramos','H.ord','H.extra','H.dom'].map(h => (
                                <th key={h} className="px-2 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {preview.preview.map((r, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-2 py-1">{r.fecha}</td>
                                <td className="px-2 py-1 font-mono">{r.dia}</td>
                                <td className="px-2 py-1 font-mono">{r.semana}</td>
                                <td className="px-2 py-1 font-mono">{r.codigo_colaborador}</td>
                                <td className="px-2 py-1">{r.nombre_colaborador}</td>
                                <td className="px-2 py-1">{r.labor}</td>
                                <td className="px-2 py-1 text-right">{r.ramos}</td>
                                <td className="px-2 py-1 text-right">{r.horas_ordinarias}</td>
                                <td className="px-2 py-1 text-right">{r.horas_extra_ordinarias}</td>
                                <td className="px-2 py-1 text-right">{r.horas_dominicales}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              {['Fecha','Semana','Código','Nombre','Labor','Líder','Tallos','Ramos','H.ord'].map(h => (
                                <th key={h} className="px-2 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {preview.preview.map((r, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-2 py-1">{r.fecha}</td>
                                <td className="px-2 py-1 font-mono">{r.semana}</td>
                                <td className="px-2 py-1 font-mono">{r.codigo_colaborador}</td>
                                <td className="px-2 py-1">{r.nombre_colaborador}</td>
                                <td className="px-2 py-1">{r.labor}</td>
                                <td className="px-2 py-1">{r.lider}</td>
                                <td className="px-2 py-1 text-right">{r.tallos}</td>
                                <td className="px-2 py-1 text-right">{r.ramos}</td>
                                <td className="px-2 py-1 text-right">{r.horas_ordinarias}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {!hayRegistros && (
                  <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-3 rounded-xl text-sm">
                    <AlertTriangle size={15} /> No hay registros válidos. Corrige los errores e intenta de nuevo.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer de acciones */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            {!preview && (
              <button
                onClick={hacerPreview}
                disabled={loading || !plantillaId || !archivo}
                className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-xl text-sm hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Analizar archivo <ArrowRight size={15} />
              </button>
            )}
            {preview && !loading && (
              <>
                <button onClick={reset} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">
                  Volver
                </button>
                <button
                  onClick={confirmar}
                  disabled={!hayRegistros || hayErroresBloqueo}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-xl text-sm hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={15} /> Confirmar ({preview.registros_ok} registros)
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    gray:  'bg-gray-50  text-gray-700  border-gray-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    red:   'bg-red-50   text-red-700   border-red-100',
    blue:  'bg-blue-50  text-blue-700  border-blue-100',
  };
  return (
    <div className={`rounded-xl border p-3 text-center ${colors[color] ?? colors.gray}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-80">{label}</p>
    </div>
  );
}
