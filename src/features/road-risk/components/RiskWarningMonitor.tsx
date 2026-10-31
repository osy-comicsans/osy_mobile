import { randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getLanguage } from '@/common/lib/i18n/i18n';
import { speak } from '@/common/lib/native/speech';
import { useAlertService } from '@/features/alerts/hooks/useAlerts';
import { usesSound } from '@/features/alerts/utils/alertRules';
import { useCurrentLocation, useDrivingState } from '@/features/location/hooks/useLocation';
import { useCheckInState } from '@/features/safety/hooks/useCheckIn';

import { useRoadRisk } from '../hooks/useRoadRisk';
import { assessDrive, createHarshDrivingMonitor, createRiskWarningEngine } from '../utils/riskWarnings';

// Renders nothing. It warns about the road ahead while the app is running.
export function RiskWarningMonitor() {
  const { t } = useTranslation();
  const alerts = useAlertService();
  const fix = useCurrentLocation();
  const driving = useDrivingState() === 'driving';
  const { status: checkIn } = useCheckInState();
  const { segments, risks, currentSegment, weather } = useRoadRisk();
  const [engine] = useState(createRiskWarningEngine);
  const [harsh] = useState(createHarshDrivingMonitor);

  useEffect(() => {
    if (!fix || !driving || fix.speedKmh === null) return;
    harsh.add(fix);
    // The driver is answering "Are you OK?", which must not be spoken over.
    if (checkIn !== 'idle') return;

    const assessment = assessDrive({
      segments, risks, current: currentSegment, driver: fix, speedKmh: fix.speedKmh,
      harshDriving: harsh.isRecent(fix.timestamp), weather,
    });
    const warning = engine.update(assessment, fix.speedKmh, fix.timestamp);
    if (!warning) return;

    const [first, second] = warning.reasons.map((id) => t(`roadRisk.factor.${id}`));
    const detail = second ? t('roadRisk.warningTwo', { first, second }) : t('roadRisk.warningOne', { first });
    alerts.raise(
      { id: randomUUID(), type: 'potential_accident', detail },
      { title: t('alerts.potential_accident.title'), body: detail },
    );
    if (usesSound('potential_accident', alerts.store.getState().preferences)) speak(detail, getLanguage());
    // Runs once for each fix, and everything else is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix]);

  return null;
}
