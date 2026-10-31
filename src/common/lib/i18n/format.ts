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

// Under a kilometre reads as whole metres, otherwise one decimal of kilometres.
export function distanceParts(language: Language, meters: number) {
  return meters < 1000
    ? { unit: 'distanceMeters', value: formatNumber(language, Math.round(meters)) } as const
    : {
      unit: 'distanceKilometers',
      value: formatNumber(language, meters / 1000, { maximumFractionDigits: 1 }),
    } as const;
}

// Keeps a phone number in left-to-right order inside Arabic text, where its
// leading + would otherwise move to the end.
export const leftToRight = (text: string) => `⁦${text}⁩`;
