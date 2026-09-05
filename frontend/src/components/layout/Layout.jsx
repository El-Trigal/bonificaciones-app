import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Building2, ChevronRight, Loader2 } from 'lucide-react';
import Sidebar from './Sidebar';
import useAuthStore from '../../store/authStore';

const ROLES_MULTISEDE = ['SUPER_ADMIN', 'LECTOR_GLOBAL'];

function SinSedeScreen() {
  const { sedes, fetchSedes, cambiarSede } = useAuthStore();
  const [sedeId, setSedeId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sedes.length === 0) fetchSedes();
  }, []);

  async function continuar() {
    if (!sedeId) return;
    setLoading(true);
    try {
      await cambiarSede(Number(sedeId));
      window.location.reload();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-10 max-w-sm w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto">
          <Building2 size={28} className="text-primary-600" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800">Selecciona una sede</h2>
          <p className="text-sm text-gray-500 mt-1">
            Tu cuenta tiene acceso a múltiples sedes. Elige con cuál deseas trabajar.
          </p>
        </div>

        <div className="space-y-3">
          <select
            value={sedeId}
            onChange={(e) => setSedeId(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-gray-50"
          >
            <option value="">— Elige una sede —</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>

          <button
            onClick={continuar}
            disabled={!sedeId || loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-700 text-white rounded-xl text-sm font-medium hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin" /> Cargando…</>
              : <>Continuar <ChevronRight size={16} /></>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user } = useAuthStore();
  const sinSede = ROLES_MULTISEDE.includes(user?.rol) && !user?.sede_activa_id;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-60 flex-1 flex flex-col">
        {sinSede ? <SinSedeScreen /> : (
          <main className="flex-1 p-6 overflow-y-auto">
            <Outlet />
          </main>
        )}
      </div>
    </div>
  );
}
