import type { Language } from '../i18n/languages';

// Loaded here, because a build made before this module was added would crash on import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const speechModule = () => require('expo-speech') as typeof import('expo-speech');

// `onDone` also runs when speech fails, so whatever waits on it is never stuck.
export function speak(text: string, language: Language, onDone?: () => void) {
  try {
    speechModule().speak(text, { language, onDone, onError: onDone });
  } catch {
    // The screen and notifications still carry the message.
    onDone?.();
  }
}

export function stopSpeaking() {
  try {
    void speechModule().stop();
  } catch {
    // Without the module nothing is speaking.
  }
}
