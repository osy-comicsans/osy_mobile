import { distanceValue } from '@/features/settings/utils/units';

import { intlLocale, type Language } from './languages';

export function formatNumber(
  language: Language,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(intlLocale(language), options).format(value);
}

export function formatDateTime(
  language: Language,
  value: Date | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  return new Intl.DateTimeFormat(intlLocale(language), options).format(value);
}

// Under a kilometre reads as metres, otherwise one decimal of kilometres. In miles,
// under a tenth of a mile reads as feet. `step` rounds metres or feet, such as to tens.
export function distanceParts(language: Language, meters: number, units: 'kmh' | 'mph', step = 1) {
  const value = distanceValue(meters, units);
  const rounded = (small: number) => formatNumber(language, Math.round(small / step) * step);
  if (units === 'mph') {
    return value < 0.1
      ? { unit: 'distanceFeet', value: rounded(value * 5280) } as const
      : { unit: 'distanceMiles', value: formatNumber(language, value, { maximumFractionDigits: 1 }) } as const;
  }
  return value < 1
    ? { unit: 'distanceMeters', value: rounded(meters) } as const
    : { unit: 'distanceKilometers', value: formatNumber(language, value, { maximumFractionDigits: 1 }) } as const;
}
