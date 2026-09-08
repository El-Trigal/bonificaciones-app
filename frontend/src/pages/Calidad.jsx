import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Upload, Calculator, Eye, User, Wrench, AlertTriangle } from 'lucide-react';
import api from '../store/api';
import Modal from '../components/shared/Modal';
import ComboBox from '../components/shared/ComboBox';
import CargarCalidadMulti from '../components/calidad/CargarCalidadMulti';
import SemanaSelect from '../components/shared/SemanaSelect';

export default function Calidad() {
  const [semana, setSemana] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [msg, setMsg] = useState('');
  const [calculando, setCalculando] = useState(false);
  const [cargaModal, setCargaModal] = useState(false);
  const [detalleModal, setDetalleModal] = useState(null);

  // ── Catálogos y estado del modal ──
  const [labores, setLabores] = useState([]);
  const [empleadosOpts, setEmpleadosOpts] = useState([]);
  const [buscandoEmp, setBuscandoEmp] = useState(false);
  const [laborSel, setLaborSel] = useState(null);
  const [nombreColaborador, setNombreColaborador] = useState('');
  const [comboKey, setComboKey] = useState(0);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.get('/catalogos/labores-rendimiento', { params: { activo: true } })
      .then(r => setLabores(r.data))
      .catch(() => {});
  }, []);

  // ─── Auto-buscar al cambiar semana ───────────────────────────────────────

  useEffect(() => {
    if (semana) buscar();
    else setItems([]);
  }, [semana]); // eslint-disable-line react-hooks/exhaustive-deps

  const laborOpciones = useMemo(() =>
    labores.map(l => ({
      value: l.id,
      label: l.nombre,
      sublabel: l.lider_nombre || '',
      _obj: l,
    })),
  [labores]);

  // ── Búsqueda de empleados (debounced) ──
  function buscarEmpleados(query) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) { setEmpleadosOpts([]); return; }
    setBuscandoEmp(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/catalogos/empleados', {
          params: { buscar: query, activo: true },
        });
        setEmpleadosOpts(data.map(e => ({
          value: e.id,
          label: e.nombre,
          meta: e.codigo,
          _obj: e,
        })));
      } catch {
        setEmpleadosOpts([]);
      } finally {
        setBuscandoEmp(false);
      }
    }, 280);
  }

  function handleEmpleadoSelect(opt) {
    if (!opt) {
      setNombreColaborador('');
      setForm(f => ({ ...f, codigo_colaborador: '' }));
      return;
    }
    setNombreColaborador(opt._obj.nombre);
    setForm(f => ({ ...f, codigo_colaborador: opt._obj.codigo }));
  }

  function handleLaborSelect(opt) {
    if (!opt) {
      setLaborSel(null);
      setForm(f => ({ ...f, labor: '' }));
      return;
    }
    setLaborSel(opt._obj);
    setForm(f => ({ ...f, labor: opt._obj.nombre }));
  }

  function abrirModal() {
    setForm({ codigo_colaborador: '', labor: '', pct_calidad: '', observaciones: '' });
    setLaborSel(null);
    setNombreColaborador('');
    setEmpleadosOpts([]);
    setModalError('');
    setComboKey(k => k + 1);
    setModal(true);
  }

  function cerrarModal() {
    setModal(false);
    setLaborSel(null);
    setNombreColaborador('');
  }

  async function buscar() {
    if (!semana) return;
    setLoading(true);
    setMsg(''); setError('');
    try {
      const { data } = await api.get('/calidad', { params: { semana } });
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function guardar() {
    setModalError('');
    try {
      await api.post('/calidad', { ...form, semana });
      cerrarModal();
      await buscar();
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Error al guardar');
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar registro de calidad?')) return;
    await api.delete(`/calidad/${id}`);
    await buscar();
  }

  async function ejecutarCalculo() {
    if (!semana) { setError('Selecciona semana primero'); return; }
    if (!confirm(`¿Ejecutar cálculo para la semana ${semana}? Esto reemplaza liquidaciones previas.`)) return;
    setCalculando(true);
    setMsg(''); setError('');
    try {
      const { data } = await api.post('/calculo/ejecutar', { semana });
      setMsg(`Cálculo ejecutado: ${data.procesados} colaboradores · ${data.sin_bonificacion} sin bonificación · Total liquidado: $${Math.round(data.total_liquidado).toLocaleString('es-CO')}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al ejecutar cálculo');
    } finally {
      setCalculando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calidad y Cálculo</h1>
          <p className="text-sm text-gray-500">% de calidad semanal + ejecución de cálculo</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCargaModal(true)}
            className="flex items-center gap-2 bg-white border border-primary text-primary px-4 py-2 rounded-lg hover:bg-primary-50"
          >
            <Upload size={18}/> Cargar archivos de calidad
          </button>
          <button
            onClick={ejecutarCalculo}
            disabled={calculando || !semana}
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            <Calculator size={18}/> {calculando ? 'Calculando...' : 'Ejecutar cálculo'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 p-4 mb-4 flex items-end gap-3">
        <div className="flex-1 max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">Semana</label>
          <SemanaSelect value={semana} onChange={setSemana} className="w-full"/>
        </div>
        {loading && (
          <span className="text-sm text-gray-400 self-center">Cargando...</span>
        )}
        <button
          onClick={abrirModal}
          disabled={!semana}
          className="flex items-center gap-2 bg-white border border-primary text-primary px-4 py-2 rounded-lg hover:bg-primary-50 disabled:opacity-50 ml-auto"
        >
          <Plus size={16}/> Nuevo
        </button>
      </div>

      {msg && <div className="mb-3 bg-green-50 text-green-800 px-3 py-2 rounded text-sm">{msg}</div>}
      {error && <div className="mb-3 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Semana</th>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Labor</th>
              <th className="px-4 py-3 text-right">% Calidad</th>
              <th className="px-4 py-3 text-left">Origen</th>
              <th className="px-4 py-3 text-left">Obs.</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-400">Sin registros</td></tr>
            ) : items.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono">{r.semana}</td>
                <td className="px-4 py-2 font-mono">{r.codigo_colaborador}</td>
                <td className="px-4 py-2">{r.labor}</td>
                <td className="px-4 py-2 text-right font-semibold">{(r.pct_calidad * 100).toFixed(1)}%</td>
                <td className="px-4 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${r.origen === 'MANUAL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{r.origen}</span></td>
                <td className="px-4 py-2 text-gray-500 text-xs">{r.observaciones || '—'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {r.observaciones && (
                    <button onClick={() => setDetalleModal(r)} className="text-primary hover:text-primary-dark mr-2" title="Ver detalle">
                      <Eye size={14}/>
                    </button>
                  )}
                  <button onClick={() => eliminar(r.id)} className="text-red-600 hover:text-red-700"><Trash2 size={14}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cargaModal && (
        <CargarCalidadMulti
          onClose={() => setCargaModal(false)}
          onDone={() => { setCargaModal(false); buscar(); }}
          semanaInicial={semana}
        />
      )}

      {detalleModal && (
        <Modal isOpen title={`Detalle calidad — ${detalleModal.codigo_colaborador}`} onClose={() => setDetalleModal(null)} size="lg">
          <DetalleCalidad registro={detalleModal} />
        </Modal>
      )}

      {modal && (
        <Modal isOpen title="Nuevo registro de calidad" onClose={cerrarModal}>
          <div className="space-y-5 max-w-lg">

            {/* Semana (solo lectura) */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
              <span className="text-xs text-gray-500 font-medium">Semana</span>
              <span className="ml-auto font-mono text-sm font-semibold text-primary">{semana}</span>
            </div>

            {/* Colaborador */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <User size={15} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">Colaborador</span>
                {form.codigo_colaborador && (
                  <span className="ml-auto font-mono text-xs text-gray-400">
                    #{form.codigo_colaborador}
                  </span>
                )}
              </div>
              <ComboBox
                key={comboKey}
                placeholder="Buscar por nombre o código..."
                options={empleadosOpts}
                onSearch={buscarEmpleados}
                onSelect={handleEmpleadoSelect}
                loading={buscandoEmp}
              />
              {nombreColaborador && (
                <p className="mt-1.5 text-xs text-gray-500 pl-1">{nombreColaborador}</p>
              )}
            </section>

            {/* Labor */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Wrench size={15} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">Labor</span>
              </div>
              <ComboBox
                placeholder="Buscar labor..."
                options={laborOpciones}
                onSelect={handleLaborSelect}
                displayValue={form.labor || ''}
              />
              {laborSel?.lider_nombre && (
                <p className="mt-1.5 text-xs text-gray-500 pl-1 flex items-center gap-1">
                  <span className="text-gray-400">Líder:</span>
                  <span className="font-medium">{laborSel.lider_nombre}</span>
                </p>
              )}
            </section>

            {/* % Calidad */}
            <section>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                % Calidad
                <span className="ml-1.5 text-xs font-normal text-gray-400">(ej: 0.85 o 85)</span>
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                min="0"
                max="100"
                value={form.pct_calidad || ''}
                onChange={e => setForm(f => ({ ...f, pct_calidad: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </section>

            {/* Observaciones */}
            <section>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Observaciones</label>
              <textarea
                value={form.observaciones || ''}
                onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                rows={2}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none"
              />
            </section>

            {/* Error */}
            {modalError && (
              <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm
                              flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                {modalError}
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={cerrarModal}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm
                           font-medium text-gray-600 hover:bg-gray-50 touch-manipulation"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                className="flex-1 bg-primary text-white px-4 py-3 rounded-xl text-sm
                           font-medium hover:bg-primary-dark touch-manipulation"
              >
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DetalleCalidad({ registro }) {
  let info = null;
  try { info = JSON.parse(registro.observaciones); } catch { /* observaciones plano */ }
  if (!info?.filas) {
    return <div className="text-sm text-gray-600 whitespace-pre-wrap">{registro.observaciones || 'Sin detalle'}</div>;
  }
  return (
    <div className="space-y-3">
      <div className="bg-primary-50 text-primary-900 px-3 py-2 rounded text-sm">
        <div><b>{info.nombre}</b></div>
        <div>Promedio: <b>{(info.promedio * 100).toFixed(2)}%</b> sobre {info.filas.length} {info.filas.length === 1 ? 'muestra' : 'muestras'}</div>
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
          {info.filas.map((f, i) => (
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
  );
}
