import axios from 'axios';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: injects access token if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}` ;
  }
  return config;
});

// Response interceptor: handles silent refresh and 401s
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // 1. Silent Refresh for 401s
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
            refresh: refreshToken,
          });
          
          localStorage.setItem('access_token', data.access);
          originalRequest.headers.Authorization = `Bearer ${data.access}`;
          return api(originalRequest);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
          return Promise.reject(error);
        }
      }
    }

    // 2. Global Error Feedback (Toasts)
    // Ignore if it was a 401 that is being handled, or if it's a "silent" request
    if (error.response?.status !== 401) {
      const message = error.response?.data?.error || 
                      error.response?.data?.detail || 
                      error.response?.data?.message || 
                      'Erro na comunicação com o servidor';
      
      toast.error(message, {
        description: 'Verifique sua conexão ou contate o suporte.',
        duration: 4000,
      });
    }

    return Promise.reject(error);
  }
);

export default api;
