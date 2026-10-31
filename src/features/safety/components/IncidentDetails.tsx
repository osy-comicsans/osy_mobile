import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Icon, type IconName } from '@/common/components/ui/icon';
import { useTheme } from '@/common/hooks/use-theme';
import { Radius, Space } from '@/common/lib/theme';

import type { NearbyIncident } from '../utils/nearbyIncidents';

export function IncidentDetails({ incident }: { incident: NearbyIncident }) {
  const { t } = useTranslation();
  const { firstName, vehicle } = incident.involved ?? { firstName: null, vehicle: null };
  return (
    <View style={styles.root}>
      <ThemedText type="bodyMedium">{t(`nearby.severity.${incident.severity}`)}</ThemedText>
      {firstName ? <Detail icon="person" label={t('nearby.driver')} value={firstName} /> : null}
      {vehicle ? <Detail icon="car" label={t('nearby.vehicle')} value={vehicle} /> : null}
    </View>
  );
}

function Detail({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View accessible style={styles.row}>
      <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}><Icon name={icon} size={16} color={theme.accent} /></View>
      <View style={styles.text}>
        <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
        <ThemedText type="bodyMedium">{value}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space[3] },
  icon: { width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
});
