import axios from 'axios';

function resolveApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL || '').trim();
  const fallback = 'http://localhost:3001/api';
  if (!raw) return fallback;

  // Accept either https://host or https://host/api
  const normalized = raw.replace(/\/+$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
}

const baseURL = resolveApiBaseUrl();

console.log('=== API CONFIGURATION ===');
console.log('Environment:', import.meta.env.MODE);
console.log('VITE_API_URL from env:', import.meta.env.VITE_API_URL);
console.log('Using baseURL:', baseURL);
console.log('========================');

export const api = axios.create({
  baseURL,
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

  const storedInstitution = localStorage.getItem('svl_selected_institution');
  if (storedInstitution) {
    try {
      const inst = JSON.parse(storedInstitution);
      if (inst?.id) {
        config.headers['X-Institution-ID'] = inst.id;
      }
    } catch (e) {}
  }

  console.log('API Request:', config.method?.toUpperCase(), config.baseURL + config.url);
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.message, error.config?.url);
    const status = error.response?.status;
    const url = String(error.config?.url || '');
    const onLoginPage =
      typeof window !== 'undefined' && window.location.pathname.startsWith('/login');
    const hadToken = !!localStorage.getItem('svl_token');

    // Only force logout/redirect when an existing session becomes invalid.
    // Unauthenticated public calls (license check before login) must not reload the page.
    const isPublicAuthCall =
      url.includes('/auth/login') ||
      url.includes('/licensing/check') ||
      url.includes('/licensing/activate');

    if (status === 401 && hadToken && !onLoginPage && !isPublicAuthCall) {
      localStorage.removeItem('svl_token');
      localStorage.removeItem('svl_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
