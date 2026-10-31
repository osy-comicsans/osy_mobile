import type { Language } from '../i18n/languages';

// Loaded here, because a build made before this module was added would crash on import.
export function speak(text: string, language: Language) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Speech = require('expo-speech') as typeof import('expo-speech');
    Speech.speak(text, { language });
  } catch {
    // The banner and notification still carry the warning.
  }
}
