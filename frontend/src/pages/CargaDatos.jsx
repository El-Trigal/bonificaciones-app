import { useEffect, useRef, useState } from 'react';
import { Upload, FileCode, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import api from '../store/api';

export default function CargaDatos() {
  const [plantillas, setPlantillas] = useState([]);
  const [plantillaId, setPlantillaId] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
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
    if (fileRef.current) fileRef.current.value = '';
  }

  async function hacerPreview() {
    setError('');
    if (!plantillaId || !archivo) {
      setError('Selecciona plantilla y archivo');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('plantilla_id', plantillaId);
      fd.append('archivo', archivo);
      const { data } = await api.post('/registros-diarios/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al procesar archivo');
    } finally {
      setLoading(false);
    }
  }

  async function confirmar() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/registros-diarios/confirmar', {
        plantilla_id: parseInt(plantillaId),
        archivo: preview.archivo,
        registros: preview.registros,
      });
      setResultado(data);
      setPreview(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al confirmar');
    } finally {
      setLoading(false);
    }
  }

  const plantillaSel = plantillas.find((p) => p.id === parseInt(plantillaId));

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Carga de datos</h1>
      <p className="text-sm text-gray-500 mb-6">Selecciona plantilla, sube archivo, valida y confirma.</p>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">
          <AlertTriangle size={16}/> {error}
        </div>
      )}

      {resultado && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800 font-medium">
            <CheckCircle size={18}/> Carga confirmada (#{resultado.carga_id})
          </div>
          <div className="text-sm text-green-700 mt-1">
            {resultado.insertados} insertados · {resultado.actualizados} actualizados · {resultado.errores?.length || 0} errores
          </div>
          <button onClick={reset} className="mt-2 text-sm text-primary hover:underline">Cargar otro archivo</button>
        </div>
      )}

      {!resultado && (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileCode size={14} className="inline mr-1"/> Plantilla
            </label>
            <select
              value={plantillaId}
              onChange={(e) => { setPlantillaId(e.target.value); setPreview(null); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              disabled={!!preview}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Upload size={14} className="inline mr-1"/> Archivo (Excel o CSV)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => { setArchivo(e.target.files?.[0] || null); setPreview(null); }}
              disabled={!!preview}
              className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white hover:file:bg-primary-dark"
            />
          </div>

          {!preview && (
            <button
              onClick={hacerPreview}
              disabled={loading || !plantillaId || !archivo}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50"
            >
              <Eye size={16}/> {loading ? 'Procesando...' : 'Validar y previsualizar'}
            </button>
          )}

          {preview && (
            <div className="border-t pt-4 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-500 text-xs">Total filas</div>
                  <div className="font-semibold text-lg">{preview.total_filas}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-green-700 text-xs">Registros OK</div>
                  <div className="font-semibold text-lg text-green-800">{preview.registros_ok}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-red-700 text-xs">Errores</div>
                  <div className="font-semibold text-lg text-red-800">{preview.errores.length}</div>
                </div>
              </div>

              {preview.errores.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <div className="text-sm font-medium text-red-800 mb-1">Errores:</div>
                  <ul className="text-xs text-red-700 space-y-0.5">
                    {preview.errores.slice(0, 50).map((e, i) => (
                      <li key={i}>Fila {e.fila}: {e.error}</li>
                    ))}
                    {preview.errores.length > 50 && <li>...y {preview.errores.length - 50} más</li>}
                  </ul>
                </div>
              )}

              {preview.preview.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 text-xs text-gray-600 font-medium">
                    Vista previa ({preview.preview.length} de {preview.registros_ok})
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Fecha</th>
                          <th className="px-2 py-1.5 text-left">Semana</th>
                          <th className="px-2 py-1.5 text-left">Código</th>
                          <th className="px-2 py-1.5 text-left">Nombre</th>
                          <th className="px-2 py-1.5 text-left">Labor</th>
                          <th className="px-2 py-1.5 text-left">Líder</th>
                          <th className="px-2 py-1.5 text-right">Tallos</th>
                          <th className="px-2 py-1.5 text-right">Ramos</th>
                          <th className="px-2 py-1.5 text-right">H.ord</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {preview.preview.map((r, i) => (
                          <tr key={i}>
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
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={reset} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                <button
                  onClick={confirmar}
                  disabled={loading || preview.registros_ok === 0}
                  className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : `Confirmar (${preview.registros_ok} registros)`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
