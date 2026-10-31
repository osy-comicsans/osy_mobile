import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getLanguage } from '@/common/lib/i18n/i18n';
import { subscribeToForeground } from '@/common/lib/native/appLifecycle';

import { voiceDriver } from '../native/voiceDriver';
import { createVoiceCheckIn } from '../utils/voiceCheckIn';
import { useCheckInService, useCheckInState } from './useCheckIn';

// Asks out loud at the start of every round. After escalating it only listens,
// so "I'm OK" can still call help off. Recognition cannot run in the background,
// so it pauses there and starts again on return.
export function useVoiceCheckIn() {
  const { t } = useTranslation();
  const service = useCheckInService();
  const { status, round } = useCheckInState();
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
    void voice.prompt(getLanguage(), status === 'waiting' ? t('checkIn.voice.prompt') : null);
  }, [foreground, status, round, t, voice]);

  useEffect(() => voice.stop, [voice]);

  return voice;
}
