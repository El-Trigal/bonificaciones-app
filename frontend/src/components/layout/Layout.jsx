import { Outlet } from 'react-router-dom';
import { Building2, AlertTriangle } from 'lucide-react';
import Sidebar from './Sidebar';
import useAuthStore from '../../store/authStore';

const ROLES_MULTISEDE = ['SUPER_ADMIN', 'LECTOR_GLOBAL'];

export default function Layout() {
  const { user } = useAuthStore();
  const sinSede = ROLES_MULTISEDE.includes(user?.rol) && !user?.sede_activa_id;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-60 flex-1 flex flex-col">
        {sinSede && (
          <div className="sticky top-0 z-40 flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-6 py-3">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Sin sede seleccionada.</span>{' '}
              Debes elegir una sede en el selector del menú lateral antes de realizar cualquier operación.
            </p>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-amber-600">
              <Building2 size={13} />
              <span>← Menú lateral</span>
            </div>
          </div>
        )}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
