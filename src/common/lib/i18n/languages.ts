// Pure language rules, kept free of native imports so Node tests can load them.

export const LANGUAGES = ['en', 'fr', 'ar'] as const;
export const FALLBACK_LANGUAGE = 'en';

export type Language = (typeof LANGUAGES)[number];
export type LanguagePreference = Language | 'system';

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
};

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}

export function isRtl(language: Language): boolean {
  return language === 'ar';
}

// Device languages arrive in the user's order, so the first supported one wins.
export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguages: readonly (string | null)[],
): Language {
  if (preference !== 'system') return preference;
  return deviceLanguages.find(isLanguage) ?? FALLBACK_LANGUAGE;
}

// Algerian Arabic text uses Western digits, which Intl does not pick for plain `ar`.
export function intlLocale(language: Language): string {
  return language === 'ar' ? 'ar-u-nu-latn' : language;
}
