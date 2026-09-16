import { useQuery } from '@tanstack/react-query';
import api from '../../utils/api';
import { allowedCurrencies, CurrencyCode, CURRENCY_OPTIONS } from '../../utils/currency';

export function useInstitutionCurrency() {
  const { data: institution } = useQuery({
    queryKey: ['institution'],
    queryFn: () => api.get('/settings/institution').then((r) => r.data),
    staleTime: 60_000,
  });
  const codes = allowedCurrencies(institution);
  return { institution, codes, defaultCode: (codes[0] || 'USD') as CurrencyCode };
}

export function CurrencySelect({
  value,
  onChange,
  className = 'input-field',
  label = 'Currency',
}: {
  value: string;
  onChange: (code: CurrencyCode) => void;
  className?: string;
  label?: string;
}) {
  const { codes } = useInstitutionCurrency();
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        className={className}
        value={value}
        onChange={(e) => onChange((e.target.value === 'LRD' ? 'LRD' : 'USD') as CurrencyCode)}
      >
        {CURRENCY_OPTIONS.filter((item) => codes.includes(item.code)).map((item) => (
          <option key={item.code} value={item.code}>{item.label}</option>
        ))}
      </select>
    </div>
  );
}
