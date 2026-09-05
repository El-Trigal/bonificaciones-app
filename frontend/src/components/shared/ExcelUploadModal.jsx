/**
 * ExcelUploadModal — modal reutilizable para importar archivos Excel.
 *
 * Props:
 *   isOpen          Boolean
 *   onClose         () => void
 *   onSuccess       (resultado) => void   llamado tras confirmar
 *   config          objeto con:
 *     titulo              string           e.g. "Importar Empleados"
 *     descripcion         string           texto corto de ayuda
 *     columnas_requeridas string[]         columnas obligatorias del Excel
 *     columnas_opcionales string[]         columnas opcionales (puede ser [])
 *     endpoint_validar    string           ruta API para validar (sin /api)
 *     endpoint_confirmar  string           ruta API para confirmar (sin /api)
 *     renderPreview       (preview) => JSX render de tabla de preview (opcional)
 *
 * Fases: 'formato' → 'validando' → 'resultado' → 'confirmando' → 'exito'
 */

import { useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle,
  Info, ArrowRight, RefreshCw, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import api from '../../store/api';

export default function ExcelUploadModal({ isOpen, onClose, onSuccess, config }) {
  const [fase, setFase] = useState('formato');
  const [archivo, setArchivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [exito, setExito] = useState(null);
  const [errorGlobal, setErrorGlobal] = useState('');
  const [erroresExpandidos, setErroresExpandidos] = useState(false);
  const fileRef = useRef();

  if (!isOpen) return null;

  const reset = () => {
    setFase('formato');
    setArchivo(null);
    setResultado(null);
    setExito(null);
    setErrorGlobal('');
    setErroresExpandidos(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const seleccionarArchivo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setArchivo(f);
    setErrorGlobal('');
  };

  const validar = async () => {
    if (!archivo) { setErrorGlobal('Selecciona un archivo Excel primero'); return; }
    setFase('validando');
    setErrorGlobal('');
    try {
      const fd = new FormData();
      fd.append('archivo', archivo);
      const { data } = await api.post(config.endpoint_validar, fd);
      setResultado(data);
      setFase('resultado');
    } catch (err) {
      setErrorGlobal(err.response?.data?.detail || 'Error al procesar el archivo');
      setFase('formato');
    }
  };

  const confirmar = async () => {
    setFase('confirmando');
    setErrorGlobal('');
    try {
      const fd = new FormData();
      fd.append('archivo', archivo);
      const { data } = await api.post(config.endpoint_confirmar, fd);
      setExito(data);
      setFase('exito');
      onSuccess?.(data);
    } catch (err) {
      setErrorGlobal(err.response?.data?.detail || 'Error al confirmar la importación');
      setFase('resultado');
    }
  };

  const hayErrores = resultado?.errores?.length > 0;
  const hayValidas = resultado?.validas > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
              <FileSpreadsheet size={20} className="text-primary-700" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">{config.titulo}</h2>
              {config.descripcion && (
                <p className="text-xs text-gray-500">{config.descripcion}</p>
              )}
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ── FASE: formato ─────────────────────────────── */}
          {(fase === 'formato' || fase === 'validando') && (
            <>
              {/* Info de columnas */}
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
                  <Info size={15} /> Formato requerido
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                      Columnas obligatorias
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {config.columnas_requeridas.map((c) => (
                        <span key={c} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-xs font-mono">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  {config.columnas_opcionales?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                        Columnas opcionales
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {config.columnas_opcionales.map((c) => (
                          <span key={c} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-mono">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-blue-600">
                  El sistema detecta automáticamente la fila de encabezados. Las columnas restantes del Excel son ignoradas.
                </p>
              </div>

              {/* Zona de carga */}
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
                    <p className="text-xs text-gray-400 mt-0.5">Formatos aceptados: .xlsx, .xls</p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={seleccionarArchivo}
                  className="hidden"
                />
              </div>

              {errorGlobal && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2.5 rounded-lg text-sm">
                  <XCircle size={15} /> {errorGlobal}
                </div>
              )}
            </>
          )}

          {/* ── FASE: resultado ───────────────────────────── */}
          {fase === 'resultado' && resultado && (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  label="Total filas"
                  value={resultado.total_filas}
                  color="gray"
                />
                <StatCard
                  label="Válidas"
                  value={resultado.validas}
                  color="green"
                />
                <StatCard
                  label="Con errores"
                  value={resultado.errores?.length ?? 0}
                  color={hayErrores ? 'red' : 'gray'}
                />
              </div>

              {/* Errores */}
              {hayErrores && (
                <div className="rounded-xl border border-red-100 bg-red-50 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-red-700"
                    onClick={() => setErroresExpandidos(!erroresExpandidos)}
                  >
                    <span className="flex items-center gap-2">
                      <XCircle size={15} /> {resultado.errores.length} {resultado.errores.length === 1 ? 'error' : 'errores'} encontrados
                    </span>
                    {erroresExpandidos ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  {erroresExpandidos && (
                    <ul className="px-4 pb-3 space-y-1 max-h-36 overflow-y-auto">
                      {resultado.errores.map((e, i) => (
                        <li key={i} className="text-xs text-red-600 font-mono">{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Preview personalizado o genérico */}
              {hayValidas && (
                config.renderPreview
                  ? config.renderPreview(resultado.preview)
                  : <DefaultPreview preview={resultado.preview} />
              )}

              {!hayValidas && (
                <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-3 rounded-xl text-sm">
                  <AlertTriangle size={15} /> No hay filas válidas para importar. Corrige los errores y vuelve a intentarlo.
                </div>
              )}

              {errorGlobal && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2.5 rounded-lg text-sm">
                  <XCircle size={15} /> {errorGlobal}
                </div>
              )}
            </>
          )}

          {/* ── FASE: éxito ───────────────────────────────── */}
          {fase === 'exito' && exito && (
            <div className="py-4 space-y-4">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle2 size={30} className="text-green-500" />
                </div>
                <h3 className="text-base font-semibold text-gray-800">Importación completada</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Nuevos" value={exito.creados} color="green" />
                <StatCard label="Actualizados" value={exito.actualizados} color="blue" />
                <StatCard label="Errores" value={exito.errores?.length ?? 0} color={exito.errores?.length ? 'red' : 'gray'} />
              </div>
              {exito.errores?.length > 0 && (
                <ul className="text-xs text-red-600 font-mono space-y-1 bg-red-50 rounded-lg px-3 py-2">
                  {exito.errores.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Loading overlay */}
          {(fase === 'validando' || fase === 'confirmando') && (
            <div className="flex items-center justify-center gap-3 py-4 text-sm text-gray-500">
              <RefreshCw size={18} className="animate-spin text-primary-600" />
              {fase === 'validando' ? 'Analizando archivo…' : 'Importando datos…'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          {fase === 'formato' && (
            <>
              <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={validar}
                disabled={!archivo}
                className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Analizar archivo <ArrowRight size={15} />
              </button>
            </>
          )}

          {fase === 'resultado' && (
            <>
              <button onClick={reset} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Volver
              </button>
              <button
                onClick={confirmar}
                disabled={!hayValidas}
                className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 size={15} /> Confirmar importación
              </button>
            </>
          )}

          {fase === 'exito' && (
            <button onClick={handleClose} className="px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800">
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes internos ──────────────────────────────────

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

// Preview genérico para empleados (nuevos + actualizaciones)
function DefaultPreview({ preview }) {
  if (!preview) return null;
  const { nuevos = [], actualizaciones = [] } = preview;

  return (
    <div className="space-y-3">
      {nuevos.length > 0 && (
        <PreviewSection
          titulo={`${nuevos.length} empleado${nuevos.length !== 1 ? 's' : ''} nuevo${nuevos.length !== 1 ? 's' : ''}`}
          color="green"
          rows={nuevos}
          cols={[
            { key: 'codigo', label: 'ID' },
            { key: 'nombre', label: 'Nombre' },
            { key: 'cargo', label: 'Cargo' },
          ]}
        />
      )}
      {actualizaciones.length > 0 && (
        <PreviewSection
          titulo={`${actualizaciones.length} actualización${actualizaciones.length !== 1 ? 'es' : ''}`}
          color="blue"
          rows={actualizaciones}
          cols={[
            { key: 'codigo', label: 'ID' },
            { key: 'nombre', label: 'Nombre' },
            { key: 'cargo', label: 'Cargo' },
            { key: 'cambios', label: 'Cambios', render: (v) => v.length ? v.join(' · ') : <span className="text-gray-400">Sin cambios</span> },
          ]}
        />
      )}
    </div>
  );
}

function PreviewSection({ titulo, color, rows, cols }) {
  const [expandido, setExpandido] = useState(false);
  const colorMap = {
    green: { badge: 'bg-green-100 text-green-700', header: 'bg-green-50', border: 'border-green-100' },
    blue:  { badge: 'bg-blue-100  text-blue-700',  header: 'bg-blue-50',  border: 'border-blue-100'  },
  };
  const c = colorMap[color] ?? colorMap.green;
  const visible = expandido ? rows : rows.slice(0, 5);

  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden`}>
      <div className={`flex items-center justify-between px-4 py-2.5 ${c.header}`}>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>{titulo}</span>
        {rows.length > 5 && (
          <button className="text-xs text-gray-500 hover:text-gray-700" onClick={() => setExpandido(!expandido)}>
            {expandido ? 'Ver menos' : `Ver todos (${rows.length})`}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-white">
              {cols.map((c) => (
                <th key={c.key} className="text-left px-3 py-2 font-medium text-gray-500">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                {cols.map((col) => (
                  <td key={col.key} className="px-3 py-2 text-gray-700 font-mono">
                    {col.render ? col.render(row[col.key]) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
