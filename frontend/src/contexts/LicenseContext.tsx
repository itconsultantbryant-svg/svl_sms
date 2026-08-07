import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../utils/api';

export interface LicenseFeatures {
  canExport: boolean;
  canViewReports: boolean;
  maxStudents: number;
  [key: string]: boolean | number | string;
}

export interface LicenseContextType {
  mode: 'demo' | 'production' | null;
  expiry: Date | null;
  planTier: string | null;
  daysRemaining: number | null;
  isExpired: boolean;
  features: LicenseFeatures;
  isLoading: boolean;
  error: string | null;
  setMode: (mode: 'demo' | 'production') => void;
  refetchLicense: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

const DEFAULT_DEMO_FEATURES: LicenseFeatures = {
  canExport: false,
  canViewReports: false,
  maxStudents: 50,
};

const DEFAULT_PRODUCTION_FEATURES: LicenseFeatures = {
  canExport: true,
  canViewReports: true,
  maxStudents: Infinity,
};

function calculateDaysRemaining(expiryDate: Date): number {
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<'demo' | 'production' | null>(null);
  const [expiry, setExpiry] = useState<Date | null>(null);
  const [planTier, setPlanTier] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [features, setFeatures] = useState<LicenseFeatures>(DEFAULT_DEMO_FEATURES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLicense = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/licensing/check');
      const { mode: licenseMode, expiry: expiryStr, plan_tier, features: licenseFeatures } = res.data;

      const expiryDate = new Date(expiryStr);
      setModeState(licenseMode);
      setExpiry(expiryDate);
      setPlanTier(plan_tier);
      setFeatures(licenseFeatures || (licenseMode === 'demo' ? DEFAULT_DEMO_FEATURES : DEFAULT_PRODUCTION_FEATURES));

      const days = calculateDaysRemaining(expiryDate);
      setDaysRemaining(days);
      setIsExpired(days < 0);
    } catch (err: any) {
      const status = err?.response?.status;
      // 403 (License required) or 404 (No license): show SetupWizard, not demo fallback
      if (status === 403 || status === 404) {
        console.log('No active license — showing setup wizard');
        setModeState(null);
        setError('No active license');
        setIsExpired(false);
        setExpiry(null);
        setPlanTier(null);
        setDaysRemaining(null);
        setFeatures(DEFAULT_DEMO_FEATURES);
      } else {
        // Network or server error: fall back to demo mode with 30-day expiry
        console.error('License check failed:', err);
        setError('Failed to verify license');

        const demoExpiry = new Date();
        demoExpiry.setDate(demoExpiry.getDate() + 30);

        setModeState('demo');
        setExpiry(demoExpiry);
        setPlanTier('demo');
        setFeatures(DEFAULT_DEMO_FEATURES);
        setDaysRemaining(30);
        setIsExpired(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Re-check license when user changes (login/logout) — listen for custom event
  useEffect(() => {
    const onUserChanged = () => {
      try {
        const raw = localStorage.getItem('svl_user');
        if (raw) {
          const u = JSON.parse(raw);
          if (u?.user_type === 'platform_admin') {
            setModeState('production');
            setPlanTier('enterprise');
            setFeatures(DEFAULT_PRODUCTION_FEATURES);
            setExpiry(null);
            setDaysRemaining(null);
            setIsExpired(false);
            setError(null);
            setIsLoading(false);
            return;
          }
        }
      } catch {}
      fetchLicense();
    };

    window.addEventListener('svl:user-changed', onUserChanged as EventListener);
    return () => window.removeEventListener('svl:user-changed', onUserChanged as EventListener);
  }, []);

  // A 403 "license required" response from any endpoint means the institution
  // needs to (re)activate. Re-run the license check so mode flips to null and
  // the SetupWizard gate takes over. Debounced so a 403 flood only triggers
  // one re-check.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onLicenseRequired = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        console.log('🔁 svl:license-required — re-checking license');
        fetchLicense();
      }, 300);
    };

    window.addEventListener('svl:license-required', onLicenseRequired as EventListener);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('svl:license-required', onLicenseRequired as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Platform superadmin is never gated by school license modes
    try {
      const raw = localStorage.getItem('svl_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.user_type === 'platform_admin') {
          setModeState('production');
          setPlanTier('enterprise');
          setFeatures(DEFAULT_PRODUCTION_FEATURES);
          setExpiry(null);
          setDaysRemaining(null);
          setIsExpired(false);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // ignore parse errors
    }

    // Check if user has explicitly chosen a mode (only if valid)
    const savedMode = localStorage.getItem('svl_license_mode') as 'demo' | 'production' | null;
    if (savedMode && localStorage.getItem('svl_token')) {
      setModeState(savedMode);
      setIsLoading(false);
      return;
    }

    // License status is institution-scoped and requires auth — skip until logged in
    const token = localStorage.getItem('svl_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    fetchLicense();
  }, []);

  const setMode = (newMode: 'demo' | 'production') => {
    setModeState(newMode);
    localStorage.setItem('svl_license_mode', newMode);

    if (newMode === 'demo') {
      const demoExpiry = new Date();
      demoExpiry.setDate(demoExpiry.getDate() + 30);
      setExpiry(demoExpiry);
      setDaysRemaining(30);
      setIsExpired(false);
      setFeatures(DEFAULT_DEMO_FEATURES);
      setPlanTier('demo');
    }
  };

  const refetchLicense = async () => {
    await fetchLicense();
  };

  return (
    <LicenseContext.Provider
      value={{
        mode,
        expiry,
        planTier,
        daysRemaining,
        isExpired,
        features,
        isLoading,
        error,
        setMode,
        refetchLicense,
      }}
    >
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const context = useContext(LicenseContext);
  if (!context) throw new Error('useLicense must be used within LicenseProvider');
  return context;
}
