import { useEffect, useState } from 'react';
import { UserPlus, Edit2, CheckCircle2, XCircle } from 'lucide-react';
import api from '../store/api';
import Modal from '../components/shared/Modal';
import useAuthStore from '../store/authStore';

const ROLES_ADMIN = ['ADMIN', 'AUXILIAR', 'NOMINA', 'OPERARIO'];
const ROLES_SUPER = ['SUPER_ADMIN', 'ADMIN', 'AUXILIAR', 'NOMINA', 'OPERARIO'];

export default function Usuarios() {
  const { user: yo, sedes, fetchSedes, can } = useAuthStore();
  const esSuperAdmin = yo?.rol === 'SUPER_ADMIN';

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // {mode:'create'|'edit', user?}
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    cargar();
    if (esSuperAdmin && sedes.length === 0) fetchSedes();
  }, []);

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get('/auth/usuarios');
      setUsuarios(data);
    } finally {
      setLoading(false);
    }
  }

  function abrirCrear() {
    setForm({
      username: '',
      password: '',
      nombre_completo: '',
      email: '',
      rol: 'AUXILIAR',
      // SUPER_ADMIN: pre-llena con la sede activa actual; ADMIN: el backend lo fuerza
      sede_id: esSuperAdmin ? (yo?.sede_activa_id ?? '') : undefined,
    });
    setError('');
    setModal({ mode: 'create' });
  }

  function abrirEditar(u) {
    setForm({
      nombre_completo: u.nombre_completo,
      email: u.email ?? '',
      rol: u.rol,
      activo: u.activo,
      password: '',
      sede_id: u.sede_id ?? '',
    });
    setError('');
    setModal({ mode: 'edit', user: u });
  }

  async function guardar() {
    setSaving(true);
    setError('');
    try {
      if (modal.mode === 'create') {
        const body = { ...form };
        // sede_id vacío / no aplica para SUPER_ADMIN sin sede
        if (body.sede_id === '' || body.sede_id === null) delete body.sede_id;
        await api.post('/auth/usuarios', body);
      } else {
        const body = { ...form };
        if (!body.password) delete body.password;
        if (body.sede_id === '' || body.sede_id === null) delete body.sede_id;
        await api.patch(`/auth/usuarios/${modal.user.id}`, body);
      }
      setModal(null);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const rolesDisponibles = esSuperAdmin ? ROLES_SUPER : ROLES_ADMIN;
  const necesitaSede = form.rol && form.rol !== 'SUPER_ADMIN';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500">Gestión de accesos al sistema</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark"
        >
          <UserPlus size={18} /> Nuevo usuario
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Rol</th>
              {esSuperAdmin && <th className="px-4 py-3 text-left">Sede</th>}
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Último login</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {loading ? (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">Cargando...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">Sin usuarios</td></tr>
            ) : usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">{u.username}</td>
                <td className="px-4 py-3">{u.nombre_completo}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex px-2 py-0.5 rounded text-xs bg-primary-50 text-primary-800">{u.rol}</span>
                </td>
                {esSuperAdmin && (
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.sede_nombre ?? '—'}</td>
                )}
                <td className="px-4 py-3">
                  {u.activo
                    ? <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={14}/> Activo</span>
                    : <span className="inline-flex items-center gap-1 text-gray-400"><XCircle size={14}/> Inactivo</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString('es-CO') : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => abrirEditar(u)} className="text-primary hover:text-primary-dark">
                    <Edit2 size={16}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          isOpen={true}
          title={modal.mode === 'create' ? 'Nuevo usuario' : `Editar: ${modal.user.username}`}
          onClose={() => setModal(null)}
        >
          <div className="space-y-3">
            {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

            {modal.mode === 'create' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text" value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
              <input
                type="text" value={form.nombre_completo || ''}
                onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email (opcional)</label>
              <input
                type="email" value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {rolesDisponibles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Selector de sede: visible para SUPER_ADMIN cuando el rol elegido no es SUPER_ADMIN */}
            {esSuperAdmin && necesitaSede && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sede</label>
                <select
                  value={form.sede_id ?? ''}
                  onChange={(e) => setForm({ ...form, sede_id: e.target.value ? Number(e.target.value) : '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">— Seleccionar sede —</option>
                  {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña {modal.mode === 'edit' && <span className="text-gray-400 text-xs">(vacío = no cambiar)</span>}
              </label>
              <input
                type="password" value={form.password || ''}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {modal.mode === 'edit' && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox" checked={!!form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                />
                Usuario activo
              </label>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={saving}
                className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
