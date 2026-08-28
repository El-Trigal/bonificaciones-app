import { useEffect, useState } from 'react';
import { Upload, Eye, Check, UserPlus, X } from 'lucide-react';
import api from '../../store/api';
import Modal from '../shared/Modal';
import SemanaSelect from '../shared/SemanaSelect';

export default function CargarCalidadMulti({ onClose, onDone, semanaInicial = '' }) {
  const [paso, setPaso] = useState(1); // 1=upload, 2=revisar
  const [semana, setSemana] = useState(semanaInicial);
  const [labor, setLabor] = useState('');
  const [labores, setLabores] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [nuevoEmp, setNuevoEmp] = useState(null); // {idx, codigo, nombre}

  useEffect(() => {
    api.get('/catalogos/labores-rendimiento').then(({ data }) => {
      setLabores(data);
      if (data.length && !labor) setLabor(data[0].nombre);
    });
  }, []);

  async function previsualizar() {
    setError('');
    if (!semana) { setError('Ingresa la semana'); return; }
    if (!labor) { setError('Selecciona la labor'); return; }
    if (!archivos.length) { setError('Selecciona al menos un archivo'); return; }
    const fd = new FormData();
    fd.append('semana', semana);
    fd.append('labor', labor);
    for (const f of archivos) fd.append('archivos', f);
    setCargando(true);
    try {
      const { data } = await api.post('/calidad/preview-multicarga', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data);
      setPaso(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al previsualizar');
    } finally {
      setCargando(false);
    }
  }

  function asignarSugerencia(idxPendiente, sugerencia) {
    const nuevo = { ...preview };
    const pend = nuevo.pendientes[idxPendiente];
    nuevo.resueltos.push({
      codigo: sugerencia.codigo,
      nombre: sugerencia.nombre,
      pct_calidad: pend.valor_prom,
      detalle: pend.detalle,
    });
    nuevo.pendientes = nuevo.pendientes.filter((_, i) => i !== idxPendiente);
    nuevo.resueltos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setPreview(nuevo);
  }

  function ignorar(idxPendiente) {
    const nuevo = { ...preview };
    nuevo.pendientes = nuevo.pendientes.filter((_, i) => i !== idxPendiente);
    setPreview(nuevo);
  }

  async function crearEmpleado() {
    if (!nuevoEmp.codigo || !nuevoEmp.nombre) return;
    try {
      await api.post('/catalogos/empleados', {
        codigo: parseInt(nuevoEmp.codigo),
        nombre: nuevoEmp.nombre,
      });
      asignarSugerencia(nuevoEmp.idx, { codigo: parseInt(nuevoEmp.codigo), nombre: nuevoEmp.nombre });
      setNuevoEmp(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear empleado');
    }
  }

  async function confirmar() {
    setCargando(true); setError('');
    try {
      const body = {
        semana,
        labor,
        archivo_resumen: archivos.map(a => a.name).join(', '),
        items: preview.resueltos.map(r => ({
          codigo: r.codigo,
          nombre: r.nombre,
          pct_calidad: r.pct_calidad,
          detalle: r.detalle,
        })),
      };
      const { data } = await api.post('/calidad/confirmar-multicarga', body);
      alert(`Guardado: ${data.insertados} nuevos, ${data.actualizados} actualizados`);
      onDone();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al confirmar');
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal isOpen title="Cargar archivos de calidad" onClose={onClose} size="full">
      {error && <div className="mb-3 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

      {paso === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semana</label>
              <SemanaSelect value={semana} onChange={setSemana} className="w-full"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Labor</label>
              <select value={labor} onChange={(e) => setLabor(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                {labores.map(l => <option key={l.id} value={l.nombre}>{l.nombre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivos (CSV o XLSX, varios permitidos)</label>
            <input
              type="file"
              multiple
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setArchivos(Array.from(e.target.files))}
              className="block w-full text-sm"
            />
            {archivos.length > 0 && (
              <ul className="mt-2 text-xs text-gray-600 list-disc list-inside">
                {archivos.map((a, i) => <li key={i}>{a.name}</li>)}
              </ul>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button>
            <button onClick={previsualizar} disabled={cargando} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2">
              <Upload size={16}/> {cargando ? 'Procesando...' : 'Previsualizar'}
            </button>
          </div>
        </div>
      )}

      {paso === 2 && preview && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <span className="bg-green-50 text-green-800 px-3 py-1.5 rounded">
              <b>{preview.resueltos.length}</b> resueltos
            </span>
            <span className={`px-3 py-1.5 rounded ${preview.pendientes.length ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-500'}`}>
              <b>{preview.pendientes.length}</b> pendientes
            </span>
            <span className="text-gray-500">Semana {preview.semana} · Labor {preview.labor}</span>
          </div>

          {preview.errores_parseo?.length > 0 && (
            <div className="bg-amber-50 text-amber-900 px-3 py-2 rounded text-xs">
              {preview.errores_parseo.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          {preview.pendientes.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Pendientes de conciliación</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 text-xs uppercase text-amber-900">
                    <tr>
                      <th className="px-3 py-2 text-left">Nombre en Excel</th>
                      <th className="px-3 py-2 text-right">% Promedio</th>
                      <th className="px-3 py-2 text-left">Sugerencias</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.pendientes.map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{p.nombre_excel}</td>
                        <td className="px-3 py-2 text-right">{(p.valor_prom * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2">
                          {p.sugerencias.length === 0 ? (
                            <span className="text-xs text-gray-400">Sin coincidencias</span>
                          ) : (
                            <div className="space-y-1">
                              {p.sugerencias.map((s) => (
                                <button key={s.codigo} onClick={() => asignarSugerencia(i, s)}
                                  className="block text-left text-xs bg-white border border-green-300 hover:bg-green-50 px-2 py-1 rounded">
                                  <Check size={12} className="inline mr-1 text-green-600"/>
                                  <span className="font-mono">{s.codigo}</span> — {s.nombre}
                                  <span className="text-gray-400 ml-2">({Math.round(s.score * 100)}%)</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button onClick={() => setNuevoEmp({ idx: i, codigo: '', nombre: p.nombre_excel })}
                            className="text-xs text-primary hover:text-primary-dark mr-2">
                            <UserPlus size={14} className="inline"/> Nuevo
                          </button>
                          <button onClick={() => ignorar(i)} className="text-xs text-gray-500 hover:text-red-600">
                            <X size={14} className="inline"/> Ignorar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Resueltos ({preview.resueltos.length})</h3>
            <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Código</th>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-right"># filas</th>
                    <th className="px-3 py-2 text-right">% Calidad</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.resueltos.map((r) => (
                    <tr key={r.codigo} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-mono">{r.codigo}</td>
                      <td className="px-3 py-1.5">{r.nombre}</td>
                      <td className="px-3 py-1.5 text-right">{r.detalle.length}</td>
                      <td className="px-3 py-1.5 text-right font-semibold">{(r.pct_calidad * 100).toFixed(2)}%</td>
                      <td className="px-3 py-1.5 text-right">
                        <button onClick={() => setDetalle(r)} className="text-primary hover:text-primary-dark" title="Ver detalle">
                          <Eye size={14}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2 justify-between pt-2 border-t">
            <button onClick={() => setPaso(1)} className="px-4 py-2 border rounded-lg">← Atrás</button>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button>
              <button onClick={confirmar} disabled={cargando || preview.resueltos.length === 0}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2">
                <Check size={16}/> {cargando ? 'Guardando...' : `Confirmar ${preview.resueltos.length} registros`}
              </button>
            </div>
          </div>
        </div>
      )}

      {detalle && (
        <Modal isOpen title={`Detalle — ${detalle.nombre}`} onClose={() => setDetalle(null)} size="lg">
          <div className="space-y-3">
            <div className="bg-primary-50 text-primary-900 px-3 py-2 rounded text-sm">
              Promedio: <b>{(detalle.pct_calidad * 100).toFixed(2)}%</b> sobre {detalle.detalle.length} muestras
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
                {detalle.detalle.map((f, i) => (
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
        </Modal>
      )}

      {nuevoEmp && (
        <Modal isOpen title="Crear empleado" onClose={() => setNuevoEmp(null)} size="md">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
              <input type="number" value={nuevoEmp.codigo} onChange={(e) => setNuevoEmp({ ...nuevoEmp, codigo: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" autoFocus/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input type="text" value={nuevoEmp.nombre} onChange={(e) => setNuevoEmp({ ...nuevoEmp, nombre: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"/>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setNuevoEmp(null)} className="flex-1 px-4 py-2 border rounded-lg">Cancelar</button>
              <button onClick={crearEmpleado} className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark">
                Crear y asignar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
