import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Space } from '@/common/lib/theme';

import { useCrashDetectionService } from '../hooks/useCrashDetection';
import type { ModelCheckResult } from '../types/crash.types';

const percent = (value: number) => `${Math.round(value * 100)}%`;

// Development only: proves real sensors reach the real model on this phone.
export function CrashModelCheck() {
  const { t } = useTranslation();
  const service = useCrashDetectionService();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ModelCheckResult | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setResult(await service.checkModel());
    setRunning(false);
  };

  return (
    <View style={styles.section}>
      <ThemedText type="bodyMedium">{t('crashModel.title')}</ThemedText>
      <ThemedText type="label" themeColor="textSecondary">{t('crashModel.hint')}</ThemedText>
      <Button
        label={t(running ? 'crashModel.running' : 'crashModel.run')}
        variant="secondary"
        size="small"
        disabled={running}
        onPress={() => void run()}
      />
      {result?.status === 'done' && (
        <ThemedText type="label" accessibilityLiveRegion="polite">
          {t('crashModel.result', {
            crash: percent(result.probabilities.crash),
            nearMiss: percent(result.probabilities.nearMiss),
            normal: percent(result.probabilities.normal),
          })}
        </ThemedText>
      )}
      {result && result.status !== 'done' && (
        <ThemedText type="label" themeColor="errorText" accessibilityRole="alert">
          {t(`crashModel.${result.status}`)}{result.reason ? ` (${result.reason})` : ''}
        </ThemedText>
      )}
      {result && (
        <ThemedText type="label" themeColor="textSecondary">
          {t('crashModel.stats', {
            accelerometer: Math.round(result.accelerationHz),
            gyroscope: Math.round(result.rotationHz),
            peak: result.peakG.toFixed(1),
          })}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Space[2] },
});
