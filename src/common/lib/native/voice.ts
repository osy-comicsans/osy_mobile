function speechApi(): typeof import('expo-speech') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Older development binaries may not include the optional speech module.
    return require('expo-speech') as typeof import('expo-speech');
  } catch { return null; }
}
export const isVoiceAvailable = () => speechApi() !== null;
let generation = 0;
export async function speakGuidance(text: string, language: string) {
  const id = ++generation;
  try {
    const Speech = speechApi(); if (!Speech) return;
    await Speech.stop();
    if (id === generation) Speech.speak(text, { language, rate: 0.9 });
  } catch { /* Speech is optional; visual and emergency actions remain usable. */ }
}
export function stopGuidance() { generation++; void speechApi()?.stop().catch(() => undefined); }
