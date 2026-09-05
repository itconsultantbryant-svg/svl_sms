import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../utils/api';

export interface SchoolBranding {
  institution_name?: string;
  institution_code?: string;
  logo?: string | null;
  website?: string | null;
  motto?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
}

interface BrandContextValue {
  branding: SchoolBranding | null;
  setBranding: (b: SchoolBranding | null) => void;
  loadBrandingByCode: (code: string) => Promise<SchoolBranding | null>;
  refreshBranding: () => Promise<void>;
}

const BrandContext = createContext<BrandContextValue | undefined>(undefined);

const DEFAULT_PRIMARY = '#1e40af';
const DEFAULT_SECONDARY = '#3b82f6';
const DEFAULT_ACCENT = '#f59e0b';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return null;
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
}

function applyCssVars(branding: SchoolBranding | null) {
  const root = document.documentElement;
  const primary = branding?.primary_color || DEFAULT_PRIMARY;
  const secondary = branding?.secondary_color || DEFAULT_SECONDARY;
  const accent = branding?.accent_color || DEFAULT_ACCENT;
  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-secondary', secondary);
  root.style.setProperty('--brand-accent', accent);

  const rgb = hexToRgb(primary);
  if (rgb) {
    root.style.setProperty('--brand-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branding, setBrandingState] = useState<SchoolBranding | null>(null);

  const setBranding = useCallback((b: SchoolBranding | null) => {
    setBrandingState(b);
    applyCssVars(b);
    if (b?.institution_code) {
      localStorage.setItem('svl_school_code', b.institution_code);
    }
  }, []);

  const loadBrandingByCode = useCallback(async (code: string) => {
    try {
      const res = await api.get(`/auth/branding?code=${encodeURIComponent(code)}`);
      const b = res.data?.branding || null;
      if (b) setBranding(b);
      return b;
    } catch {
      return null;
    }
  }, [setBranding]);

  const refreshBranding = useCallback(async () => {
    if (!user || user.user_type === 'platform_admin') {
      applyCssVars(null);
      setBrandingState(null);
      return;
    }
    try {
      const res = await api.get('/settings/branding');
      setBranding(res.data || null);
    } catch {
      if (user.institution_name) {
        setBranding({
          institution_name: user.institution_name,
          institution_code: user.institution_code,
          logo: (user as any).institution_logo,
          website: (user as any).institution_website,
          motto: (user as any).institution_motto,
          primary_color: (user as any).primary_color,
          secondary_color: (user as any).secondary_color,
          accent_color: (user as any).accent_color,
        });
      }
    }
  }, [user, setBranding]);

  useEffect(() => {
    if (user && user.user_type !== 'platform_admin') {
      refreshBranding();
    } else if (!user) {
      const code = localStorage.getItem('svl_school_code');
      if (code) loadBrandingByCode(code);
      else applyCssVars(null);
    } else {
      applyCssVars(null);
      setBrandingState(null);
    }
  }, [user, refreshBranding, loadBrandingByCode]);

  return (
    <BrandContext.Provider value={{ branding, setBranding, loadBrandingByCode, refreshBranding }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used within BrandProvider');
  return ctx;
}
