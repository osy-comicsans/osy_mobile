import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getLanguage } from '@/common/lib/i18n/i18n';
import { subscribeToForeground } from '@/common/lib/native/appLifecycle';
import { useSettings } from '@/features/settings/hooks/useSettings';

import { voiceDriver } from '../native/voiceDriver';
import { createVoiceCheckIn } from '../utils/voiceCheckIn';
import { useCheckInService, useCheckInState } from './useCheckIn';

// With "Read alerts aloud" on, it asks out loud at the start of every round.
// It always listens for an answer, and after escalating it only listens, so
// "I'm OK" can still call help off. Recognition cannot run in the background,
// so it pauses there and starts again on return.
export function useVoiceCheckIn() {
  const { t } = useTranslation();
  const service = useCheckInService();
  const { status, round } = useCheckInState();
  const { settings } = useSettings();
  const language = settings.voiceLanguage === 'app' ? getLanguage() : settings.voiceLanguage;
  const [foreground, setForeground] = useState(true);
  const [voice] = useState(() => createVoiceCheckIn({
    driver: voiceDriver,
    onIntent: (intent) => (intent === 'ok' ? service.confirmOk() : service.needHelp()),
  }));

  useEffect(() => subscribeToForeground(setForeground), []);

  useEffect(() => {
    if (!foreground || (status !== 'waiting' && status !== 'escalated')) {
      voice.stop();
      return;
    }
    const question = status === 'waiting' && settings.voice ? t('checkIn.voice.prompt', { lng: language }) : null;
    void voice.prompt(language, question);
  }, [foreground, status, round, settings.voice, language, t, voice]);

  useEffect(() => voice.stop, [voice]);

  return voice;
}
