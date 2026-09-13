const RESERVED = new Set(['www', 'sms', 'app', 'api', 'mail', 'admin']);

/** School code from a host like seia.softwarevalalib.app. Platform hosts return null. */
export function schoolCodeFromHostname(hostname: string): string | null {
  const host = hostname.split(':')[0].toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.vercel.app') || host.endsWith('.onrender.com')) {
    return null;
  }
  const labels = host.split('.');
  if (labels.length < 3) return null;
  const sub = labels[0];
  if (RESERVED.has(sub) || !/^[a-z0-9-]+$/.test(sub)) return null;
  return sub;
}
