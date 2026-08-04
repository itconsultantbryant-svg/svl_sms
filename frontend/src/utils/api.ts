import axios from 'axios';

// CRITICAL: Vite requires import.meta.env for environment variables
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Debug logging
console.log('=== API CONFIGURATION ===');
console.log('Environment:', import.meta.env.MODE);
console.log('VITE_API_URL from env:', import.meta.env.VITE_API_URL);
console.log('Using baseURL:', baseURL);
console.log('========================');

export const api = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('svl_token');
  console.log('🔑 Interceptor check:', {
    hasToken: !!token,
    tokenPreview: token ? token.substring(0, 20) + '...' : 'null',
    url: config.url,
    currentAuth: config.headers.Authorization
  });

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const institutionId = localStorage.getItem('institution_id');
  if (institutionId) {
    config.headers['X-Institution-ID'] = institutionId;
  }

  console.log('API Request:', config.method?.toUpperCase(), config.baseURL + config.url);
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.message, error.config?.url);
    if (error.response?.status === 401) {
      localStorage.removeItem('svl_token');
      localStorage.removeItem('svl_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
