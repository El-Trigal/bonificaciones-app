import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Upload, FileText, Search, BarChart3,
  Settings, Users, LogOut, FileCode, Table2, Award,
  Calendar, History, ChevronDown, Building2,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', permiso: 'ver_dashboard' },
  { to: '/carga', icon: Upload, label: 'Carga de Datos', permiso: 'cargar_archivos' },
  { to: '/registros-diarios', icon: Table2, label: 'Registros Diarios', permiso: 'ver_liquidaciones' },
  { to: '/calidad', icon: Award, label: 'Calidad y Cálculo', permiso: 'ejecutar_calculo' },
  { to: '/liquidaciones', icon: FileText, label: 'Liquidaciones', permiso: 'ver_liquidaciones' },
  { to: '/periodos', icon: Calendar, label: 'Periodos nómina', permiso: 'ver_liquidaciones' },
  { to: '/ajustes', icon: History, label: 'Ajustes retroactivos', permiso: 'ver_liquidaciones' },
  { to: '/trazabilidad', icon: Search, label: 'Trazabilidad', permiso: 'ver_trazabilidad' },
  { to: '/informes', icon: BarChart3, label: 'Informes', permiso: 'ver_informes' },
  { to: '/catalogos', icon: Settings, label: 'Catálogos', permiso: 'editar_catalogos' },
  { to: '/plantillas', icon: FileCode, label: 'Plantillas', permiso: 'editar_catalogos' },
  { to: '/usuarios', icon: Users, label: 'Usuarios', permiso: 'gestionar_usuarios' },
];

function SedeSwitcher({ user }) {
  const { sedes, fetchSedes, cambiarSede } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (sedes.length === 0) fetchSedes();
  }, []);

  async function handleSelect(sedeId) {
    if (sedeId === user.sede_activa_id || switching) return;
    setSwitching(true);
    setOpen(false);
    try {
      await cambiarSede(sedeId);
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  }

  const sedeActual = user.sede_nombre ?? 'Seleccionar sede';

  return (
    <div className="relative mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={switching}
        className="w-full flex items-center justify-between gap-2 bg-primary-800 hover:bg-primary-700 text-white px-3 py-2 rounded-lg text-xs transition"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Building2 size={13} className="shrink-0 text-primary-300" />
          <span className="truncate font-medium">
            {switching ? 'Cambiando…' : sedeActual}
          </span>
        </span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-primary-950 border border-primary-700 rounded-lg shadow-xl overflow-hidden z-50">
          {sedes.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelect(s.id)}
              className={`w-full text-left px-3 py-2 text-xs transition ${
                s.id === user.sede_activa_id
                  ? 'bg-primary-700 text-white font-semibold'
                  : 'text-primary-200 hover:bg-primary-800 hover:text-white'
              }`}
            >
              {s.nombre}
              {s.id === user.sede_activa_id && (
                <span className="ml-1 text-accent">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout, can } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-gradient-to-b from-primary-500 to-primary-700 text-white flex flex-col z-50">
      <div className="p-5 border-b border-primary-400">
        <div className="flex items-center gap-2.5">
          <img src="/brand/icon/espiga-white.png" alt="" className="h-7 w-auto shrink-0" />
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">Bonificaciones</h1>
            <p className="text-primary-300 text-xs">Flores El Trigal &middot; v2.0</p>
          </div>
        </div>
        {user?.rol === 'SUPER_ADMIN' && <SedeSwitcher user={user} inHeader />}
      </div>

      <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
        {links.filter((l) => can(l.permiso)).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-800 text-accent'
                  : 'text-primary-100 hover:bg-primary-600 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {user && (
        <>
          <div className="p-4 border-t border-primary-400 text-xs">
            <div className="text-white font-medium truncate">{user.nombre_completo}</div>
            <div className="text-primary-300 mb-2">
              {user.rol}
              {user.rol !== 'SUPER_ADMIN' && user.sede_nombre && (
                <span className="ml-1 opacity-70">· {user.sede_nombre}</span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 bg-primary-800 hover:bg-primary-900 text-white py-1.5 rounded-md transition"
            >
              <LogOut size={14} /> Salir
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
