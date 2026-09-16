export type CurrencyCode = 'USD' | 'LRD';

export const CURRENCY_OPTIONS: Array<{ code: CurrencyCode; symbol: string; label: string }> = [
  { code: 'USD', symbol: '$', label: 'US Dollar (USD)' },
  { code: 'LRD', symbol: 'L$', label: 'Liberian Dollar (LRD)' },
];

export function currencySymbol(code?: string | null, institution?: { currency?: string; currency_symbol?: string; secondary_currency?: string; secondary_currency_symbol?: string } | null): string {
  const normalized = String(code || institution?.currency || 'USD').toUpperCase();
  if (normalized === 'LRD') return institution?.secondary_currency_symbol || 'L$';
  if (normalized === (institution?.currency || 'USD').toUpperCase()) return institution?.currency_symbol || '$';
  return CURRENCY_OPTIONS.find((item) => item.code === normalized)?.symbol || `${normalized} `;
}

export function formatMoney(
  amount: number | string | null | undefined,
  code?: string | null,
  institution?: { currency?: string; currency_symbol?: string; secondary_currency?: string; secondary_currency_symbol?: string } | null
): string {
  const value = Number(amount || 0);
  const symbol = currencySymbol(code, institution);
  return `${symbol}${value.toFixed(2)}`;
}

export function allowedCurrencies(institution?: { currency?: string; secondary_currency?: string; allowed_currencies?: string } | null): CurrencyCode[] {
  const raw = String(institution?.allowed_currencies || `${institution?.currency || 'USD'},${institution?.secondary_currency || 'LRD'}`);
  const list = raw.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean) as CurrencyCode[];
  const unique = Array.from(new Set(list.filter((item) => item === 'USD' || item === 'LRD')));
  return unique.length ? unique : ['USD', 'LRD'];
}
