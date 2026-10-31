import type { Language } from '@/common/lib/i18n/languages';

export type VoiceIntent = 'ok' | 'help';

// A misheard "OK" would call off help, so a long stretch of speech, more likely
// a radio or a passenger than an answer, never counts.
const MAX_REPLY_WORDS = 6;

// "Help" and "not OK" are checked first, so "I'm not OK" asks for help. Algerian
// Darija is listed in Arabic script, the way an Arabic recognizer writes it.
const phrases: Record<Language, Record<VoiceIntent, string[]>> = {
  en: {
    help: ['Help', 'I need help', 'Emergency', 'Not OK', 'Not okay', 'Not fine'],
    ok: ["I'm OK", 'I am OK', "I'm okay", 'I am okay', "I'm fine", 'I am fine', "I'm alright", 'Im OK', 'Im fine', 'Cancel'],
  },
  fr: {
    help: ['Au secours', 'Aidez-moi', 'Aide-moi', 'Aide', "À l'aide", "J'ai besoin d'aide", 'Urgence', 'Pas bien', 'Ça va pas'],
    ok: ['Je vais bien', 'Ça va', 'Tout va bien', 'Je suis OK', 'Annuler'],
  },
  ar: {
    help: ['النجدة', 'نجدة', 'ساعدني', 'ساعدوني', 'عاونوني', 'مساعدة', 'لست بخير', 'مش بخير', 'ماني بخير'],
    ok: ['أنا بخير', 'بخير', 'لا بأس', 'راني لاباس', 'لاباس', 'إلغاء'],
  },
};

// Drops case, accents, Arabic short vowels and hamza marks, and punctuation, and
// pads with spaces so phrases match whole words only.
function normalize(text: string): string {
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟـ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return words ? ` ${words} ` : '';
}

const languages = Object.keys(phrases) as Language[];
const normalized: Record<VoiceIntent, string[]> = {
  help: languages.flatMap((language) => phrases[language].help.map(normalize)),
  ok: languages.flatMap((language) => phrases[language].ok.map(normalize)),
};

// Drivers mix languages, so every language's phrases count whichever one the
// recognizer listens in.
export function matchIntent(transcripts: string[]): VoiceIntent | null {
  const replies = transcripts
    .map(normalize)
    .filter((reply) => reply && reply.trim().split(' ').length <= MAX_REPLY_WORDS);
  for (const intent of ['help', 'ok'] as const) {
    if (replies.some((reply) => normalized[intent].some((phrase) => reply.includes(phrase)))) return intent;
  }
  return null;
}

// Hints that make the recognizer favour these replies.
export const contextualPhrases = (language: Language): string[] => [
  ...phrases[language].ok,
  ...phrases[language].help,
];
