import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('svl_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add institution header for platform admins
  const userStr = localStorage.getItem('svl_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.user_type === 'platform_admin') {
        const instStr = localStorage.getItem('svl_selected_institution');
        if (instStr) {
          const inst = JSON.parse(instStr);
          config.headers['X-Institution-ID'] = inst.id;
        }
      }
    } catch (error) {
      console.error('Failed to parse user data:', error);
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('svl_token');
      localStorage.removeItem('svl_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
