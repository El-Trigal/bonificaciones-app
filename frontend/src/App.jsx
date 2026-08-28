import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import RequireAuth from './components/auth/RequireAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CargaDatos from './pages/CargaDatos';
import RegistrosDiarios from './pages/RegistrosDiarios';
import Calidad from './pages/Calidad';
import Liquidaciones from './pages/Liquidaciones';
import PeriodosNomina from './pages/PeriodosNomina';
import Ajustes from './pages/Ajustes';
import Trazabilidad from './pages/Trazabilidad';
import Informes from './pages/Informes';
import Catalogos from './pages/Catalogos';
import Plantillas from './pages/Plantillas';
import Usuarios from './pages/Usuarios';
import useAuthStore from './store/authStore';

function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  useEffect(() => { fetchMe(); }, [fetchMe]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<RequireAuth permiso="ver_dashboard"><Dashboard /></RequireAuth>} />
        <Route path="/carga" element={<RequireAuth permiso="cargar_archivos"><CargaDatos /></RequireAuth>} />
        <Route path="/registros-diarios" element={<RequireAuth permiso="ver_liquidaciones"><RegistrosDiarios /></RequireAuth>} />
        <Route path="/calidad" element={<RequireAuth permiso="ejecutar_calculo"><Calidad /></RequireAuth>} />
        <Route path="/liquidaciones" element={<RequireAuth permiso="ver_liquidaciones"><Liquidaciones /></RequireAuth>} />
        <Route path="/periodos" element={<RequireAuth permiso="ver_liquidaciones"><PeriodosNomina /></RequireAuth>} />
        <Route path="/ajustes" element={<RequireAuth permiso="ver_liquidaciones"><Ajustes /></RequireAuth>} />
        <Route path="/trazabilidad" element={<RequireAuth permiso="ver_trazabilidad"><Trazabilidad /></RequireAuth>} />
        <Route path="/informes" element={<RequireAuth permiso="ver_informes"><Informes /></RequireAuth>} />
        <Route path="/catalogos" element={<RequireAuth permiso="editar_catalogos"><Catalogos /></RequireAuth>} />
        <Route path="/plantillas" element={<RequireAuth permiso="editar_catalogos"><Plantillas /></RequireAuth>} />
        <Route path="/usuarios" element={<RequireAuth permiso="gestionar_usuarios"><Usuarios /></RequireAuth>} />
      </Route>
    </Routes>
  );
}

export default App;
