export const SCHOOL_PARENT_DOMAIN = 'softwarevalalib.app';

const RESERVED = new Set(['www', 'sms', 'app', 'api', 'mail', 'admin']);

/** Lowercase DNS label for an institution code, or null if it cannot be a subdomain. */
export function schoolSubdomain(code: string): string | null {
  const sub = String(code || '').trim().toLowerCase();
  if (!sub || RESERVED.has(sub) || !/^[a-z0-9-]+$/.test(sub)) return null;
  return sub;
}

export function schoolPortalUrl(code: string): string | null {
  const sub = schoolSubdomain(code);
  return sub ? `https://${sub}.${SCHOOL_PARENT_DOMAIN}` : null;
}

/** School code from a host like seia.softwarevalalib.app. Platform hosts return null. */
export function schoolCodeFromHostname(hostname: string): string | null {
  const host = hostname.split(':')[0].toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.vercel.app') || host.endsWith('.onrender.com')) {
    return null;
  }
  const labels = host.split('.');
  if (labels.length < 3) return null;
  return schoolSubdomain(labels[0]);
}
