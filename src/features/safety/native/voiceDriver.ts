import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { Language } from '@/common/lib/i18n/languages';
import { speak, stopSpeaking } from '@/common/lib/native/speech';

import type { VoiceDriver, VoicePermission } from '../utils/voiceCheckIn';

type Recognition = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;
type Subscription = ReturnType<Recognition['addListener']>;

// Expo Go and builds made before this module was added have no native side, and
// the package throws on import without it. Metro reports a throw during a lazy
// require as fatal before any catch here runs, so check first. Voice then reports
// itself unavailable. The web build registers its own module and needs no check.
function recognition(): Recognition | null {
  if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSpeechRecognition')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('expo-speech-recognition') as typeof import('expo-speech-recognition'))
      .ExpoSpeechRecognitionModule;
  } catch {
    return null;
  }
}

// ar-SA is the Arabic recognizer both platforms offer.
const locales: Record<Language, string> = { en: 'en-US', fr: 'fr-FR', ar: 'ar-SA' };

let subscriptions: Subscription[] = [];

const release = () => {
  subscriptions.forEach((subscription) => subscription.remove());
  subscriptions = [];
};

export const voiceDriver: VoiceDriver = {
  available: () => recognition()?.isRecognitionAvailable() ?? false,

  // Covers the microphone and, on iOS, speech recognition. Without a recognizer
  // the check-in never asks, so the permission reads as unavailable.
  getPermission: async (): Promise<VoicePermission> => {
    try {
      const module = recognition();
      if (!module?.isRecognitionAvailable()) return 'unavailable';
      const { granted, status } = await module.getPermissionsAsync();
      if (granted) return 'granted';
      return status === 'denied' ? 'denied' : 'undetermined';
    } catch {
      return 'unavailable';
    }
  },

  requestPermission: async () => {
    try {
      return (await recognition()?.requestPermissionsAsync())?.granted ?? false;
    } catch {
      return false;
    }
  },

  speak,
  stopSpeaking,

  listen(language, phrases, handlers) {
    release();
    const module = recognition();
    if (!module) {
      handlers.onError('service-not-allowed');
      handlers.onEnd();
      return;
    }
    subscriptions = [
      module.addListener('result', ({ results, isFinal }) => {
        handlers.onResult(results.map(({ transcript }) => transcript), isFinal);
      }),
      module.addListener('volumechange', ({ value }) => handlers.onLevel(value)),
      module.addListener('error', ({ error }) => handlers.onError(error)),
      module.addListener('end', () => {
        release();
        handlers.onEnd();
      }),
    ];
    module.start({
      lang: locales[language],
      interimResults: false,
      maxAlternatives: 3,
      contextualStrings: phrases,
      // Both settings tune the recognizer for a short answer rather than dictation.
      iosTaskHint: 'confirmation',
      androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'web_search' },
      volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
    });
  },

  stopListening() {
    release();
    recognition()?.abort();
  },
};
