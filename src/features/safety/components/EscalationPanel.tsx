import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { config } from '@/common/lib/config';
import { Space } from '@/common/lib/theme';

import { useEscalation } from '../hooks/useEscalation';

// Protection Civile. Calling needs the user's tap, because apps cannot place calls alone.
const EMERGENCY_NUMBER = '14';

export function EscalationPanel() {
  const { t } = useTranslation();
  const { state } = useEscalation();

  return (
    <View style={styles.panel}>
      {config.useMockApi && (
        <Card tone="muted" style={styles.notice}>
          <ThemedText type="bodyMedium" themeColor="errorText">{t('escalation.testMode')}</ThemedText>
        </Card>
      )}
      <ThemedText type="body" themeColor="textSecondary" style={styles.centered} accessibilityLiveRegion="polite">
        {t(`escalation.status.${state.status}`)}
      </ThemedText>
      <Button
        label={t('escalation.call', { number: EMERGENCY_NUMBER })}
        size="large"
        variant="destructive"
        onPress={() => void Linking.openURL(`tel:${EMERGENCY_NUMBER}`)}
        style={styles.call}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: Space[3] },
  notice: { padding: Space[3] },
  centered: { textAlign: 'center' },
  call: { height: 'auto', minHeight: 64, alignSelf: 'stretch' },
});
