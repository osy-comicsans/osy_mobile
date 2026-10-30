import { reloadAppAsync } from 'expo';
import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { I18nManager, Platform } from 'react-native';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';

import { FALLBACK_LANGUAGE, isLanguage, isRtl, resolveLanguage, type Language, type LanguagePreference } from './languages';
import { languageStorage } from './languageStorage';
import ar from './locales/ar.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

const PREFERENCE_KEY = 'language-preference';
const RELOAD_ATTEMPT_KEY = 'language-direction-reload';

const zodLocales = { en: z.locales.en, fr: z.locales.fr, ar: z.locales.ar };

function storedPreference(): LanguagePreference {
  const stored = languageStorage.getItem(PREFERENCE_KEY);
  return isLanguage(stored) ? stored : 'system';
}

function deviceLanguages() {
  return getLocales().map((locale) => locale.languageCode);
}

let preference = storedPreference();
let language = resolveLanguage(preference, deviceLanguages());
// Fonts and styles are chosen at startup, so only a reload can change direction.
const layoutIsRtl = Platform.OS === 'web' ? isRtl(language) : I18nManager.isRTL;

export const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr }, ar: { translation: ar } },
  lng: language,
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: { escapeValue: false },
  initAsync: false,
});
z.config(zodLocales[language]());

// Returns false while a reload is on its way, so the old layout is never shown.
function applyDirection(): boolean {
  const rtl = isRtl(language);
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.lang = language;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }
  if (Platform.OS !== 'web') {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
  if (layoutIsRtl === rtl) {
    languageStorage.removeItem(RELOAD_ATTEMPT_KEY);
    return true;
  }

  // Expo Go ignores forceRTL, so a second attempt would reload forever.
  if (languageStorage.getItem(RELOAD_ATTEMPT_KEY)) return true;
  languageStorage.setItem(RELOAD_ATTEMPT_KEY, '1');
  void reloadAppAsync('Language direction changed');
  return false;
}

export const directionReady = applyDirection();

function applyLanguage(next: Language) {
  if (next === language) return;
  language = next;
  z.config(zodLocales[next]());
  void i18n.changeLanguage(next);
  applyDirection();
}

export function getLanguage(): Language {
  return language;
}

export function getLanguagePreference(): LanguagePreference {
  return preference;
}

export function setLanguagePreference(next: LanguagePreference) {
  preference = next;
  if (next === 'system') languageStorage.removeItem(PREFERENCE_KEY);
  else languageStorage.setItem(PREFERENCE_KEY, next);
  applyLanguage(resolveLanguage(next, deviceLanguages()));
}

// Android can change the device or per-app language while the app is in the background.
export function refreshDeviceLanguage() {
  applyLanguage(resolveLanguage(preference, deviceLanguages()));
}
