import { create } from 'zustand';
import api from './api';

const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  sedes: [],

  async fetchMe() {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, loading: false });
      return data;
    } catch {
      set({ user: null, loading: false });
      return null;
    }
  },

  async login(username, password) {
    const { data } = await api.post('/auth/login', { username, password });
    set({ user: data });
    return data;
  },

  async logout() {
    try { await api.post('/auth/logout'); } catch {}
    set({ user: null, sedes: [] });
  },

  async fetchSedes() {
    try {
      const { data } = await api.get('/auth/sedes');
      set({ sedes: data });
      return data;
    } catch {
      return [];
    }
  },

  async cambiarSede(sedeId) {
    const { data } = await api.post(`/auth/cambiar-sede/${sedeId}`);
    set({ user: data });
    return data;
  },

  can(permiso) {
    return get().user?.permisos?.includes(permiso) ?? false;
  },
}));

export default useAuthStore;
