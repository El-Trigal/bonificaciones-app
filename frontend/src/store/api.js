import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
