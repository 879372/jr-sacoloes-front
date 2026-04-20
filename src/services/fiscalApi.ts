import axios from 'axios';
import { toast } from 'sonner';

const FISCAL_API_BASE_URL = import.meta.env.VITE_FISCAL_API_URL || 'https://web-production-540f8.up.railway.app/api/fiscal';
const FISCAL_API_KEY = import.meta.env.VITE_FISCAL_API_KEY || '';

const fiscalApi = axios.create({
  baseURL: FISCAL_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar o token JWT ou a API Key
fiscalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('fiscal_access_token');
  
  // Prioridade 1: API Key (Multi-Tenancy B2B)
  if (FISCAL_API_KEY) {
    config.headers['X-Api-Key'] = FISCAL_API_KEY;
  }
  
  // Prioridade 2: JWT (Identidade de Usuário)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// Response interceptor for error handling and token refresh
fiscalApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('fiscal_refresh_token');
      
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${FISCAL_API_BASE_URL}/token/refresh/`, {
            refresh: refreshToken,
          });
          localStorage.setItem('fiscal_access_token', data.access);
          originalRequest.headers.Authorization = `Bearer ${data.access}`;
          return fiscalApi(originalRequest);
        } catch {
          // If refresh fails, we might need to re-login to the fiscal API
          console.error('Fiscal API refresh token failed');
        }
      }
    }

    const errorMessage = error.response?.data?.detail || error.response?.data?.mensagem || 'Erro na API Fiscal';
    toast.error(errorMessage);
    
    return Promise.reject(error);
  }
);

export default fiscalApi;
