import axios from 'axios';

// En producción (Vercel) VITE_API_URL apunta al backend en Render.
// En desarrollo local Vite proxea /api a :8000.
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.detail || error.message || 'Error de conexión';
    console.error('API Error:', msg);
    return Promise.reject(error);
  }
);

export default api;
