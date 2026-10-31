import { createStore } from 'zustand/vanilla';

import type { Language } from '@/common/lib/i18n/languages';

import { contextualPhrases, matchIntent, type VoiceIntent } from './voiceIntent';

export type VoiceStatus = 'off' | 'speaking' | 'listening' | 'denied' | 'unavailable';

export interface VoiceState {
  status: VoiceStatus;
  // Microphone input from 0 (silent) to 1.
  level: number;
}

export interface ListenHandlers {
  onResult(transcripts: string[], isFinal: boolean): void;
  // The recognizer's volume, from -2 to 10, where 0 and below is inaudible.
  onLevel(volume: number): void;
  onError(code: string): void;
  // Always the last event of a listening session, after a result or an error.
  onEnd(): void;
}

export interface VoiceDriver {
  available(): boolean;
  requestPermission(): Promise<boolean>;
  speak(text: string, language: Language, onDone: () => void): void;
  stopSpeaking(): void;
  listen(language: Language, phrases: string[], handlers: ListenHandlers): void;
  stopListening(): void;
}

interface VoiceOptions {
  driver: VoiceDriver;
  onIntent(intent: VoiceIntent): void;
  restartDelayMs?: number;
}

const UNAVAILABLE = new Set(['language-not-supported', 'service-not-allowed']);

// Asks out loud, then listens until it hears an answer or is stopped. The
// buttons keep working throughout, so voice is never the only way to answer.
export function createVoiceCheckIn({ driver, onIntent, restartDelayMs = 800 }: VoiceOptions) {
  const store = createStore<VoiceState>(() => ({ status: 'off', level: 0 }));
  let session = 0;
  let permitted: boolean | null = null;
  let restart: ReturnType<typeof setTimeout> | undefined;

  const end = (status: VoiceStatus) => {
    session += 1;
    clearTimeout(restart);
    driver.stopSpeaking();
    driver.stopListening();
    store.setState({ status, level: 0 });
  };

  const listen = (id: number, language: Language) => {
    if (id !== session) return;
    store.setState({ status: 'listening', level: 0 });
    driver.listen(language, contextualPhrases(language), {
      onResult: (transcripts, isFinal) => {
        // A partial result changes as the recognizer hears more, so only a final one decides.
        if (id !== session || !isFinal) return;
        const intent = matchIntent(transcripts);
        if (!intent) return;
        end('off');
        onIntent(intent);
      },
      onLevel: (volume) => {
        if (id === session) store.setState({ level: Math.min(1, Math.max(0, volume / 10)) });
      },
      onError: (code) => {
        if (id !== session) return;
        if (code === 'not-allowed') end('denied');
        else if (UNAVAILABLE.has(code)) end('unavailable');
      },
      // Silence, noise, or words that were not an answer: listen again.
      onEnd: () => {
        if (id === session) restart = setTimeout(() => listen(id, language), restartDelayMs);
      },
    });
  };

  // With no text it listens straight away.
  const prompt = async (language: Language, text: string | null) => {
    end('off');
    const id = session;
    if (!driver.available()) {
      store.setState({ status: 'unavailable' });
      return;
    }
    permitted ??= await driver.requestPermission();
    if (id !== session) return;
    if (!permitted) {
      store.setState({ status: 'denied' });
      return;
    }
    if (text === null) {
      listen(id, language);
      return;
    }
    store.setState({ status: 'speaking' });
    driver.speak(text, language, () => listen(id, language));
  };

  return { store, prompt, stop: () => end('off') };
}

export type VoiceCheckIn = ReturnType<typeof createVoiceCheckIn>;
