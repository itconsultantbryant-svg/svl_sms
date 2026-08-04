import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../utils/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('svl_token');
    if (token) {
      api.get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('svl_token');
          localStorage.removeItem('svl_user');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      console.log('🔐 Login attempt:', username);
      const res = await api.post('/auth/login', { username, password });
      console.log('✅ Login response received:', { hasToken: !!res.data.token, hasUser: !!res.data.user });

      if (!res.data.token) {
        console.error('❌ No token in response:', res.data);
        throw new Error('No token received from server');
      }

      localStorage.setItem('svl_token', res.data.token);
      localStorage.setItem('svl_user', JSON.stringify(res.data.user));
      console.log('💾 Saved to localStorage:', {
        token: localStorage.getItem('svl_token')?.substring(0, 20) + '...',
        user: localStorage.getItem('svl_user')
      });

      setUser(res.data.user);
      console.log('✅ Login complete');
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('svl_token');
    localStorage.removeItem('svl_user');
    localStorage.removeItem('svl_selected_institution');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
