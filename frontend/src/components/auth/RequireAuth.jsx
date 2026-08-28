import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function RequireAuth({ permiso, children }) {
  const { user, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Cargando...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (permiso && !user.permisos?.includes(permiso)) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Sin acceso</h2>
        <p className="text-gray-500 mt-2">Tu rol no tiene el permiso requerido.</p>
      </div>
    );
  }
  return children;
}
