import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { useTheme } from '@/common/hooks/use-theme';
import { formatDateTime } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Space } from '@/common/lib/theme';
import { SettingsGroup } from '@/features/settings/components/SettingsControls';
import { useWaitingReports } from '../hooks/useProfileCache';
import type { ProfileBundle } from '../types/profile.schemas';

export function ReportHistory({ bundle }: { bundle: ProfileBundle }) {
  const { t } = useTranslation(); const theme = useTheme();
  const { data: waiting = [] } = useWaitingReports();
  // A report stays queued for a moment after the server has it.
  const sent = new Set(bundle.reports.map(({ id }) => id));
  const reports = [
    ...waiting.filter(({ id }) => !sent.has(id)).map(({ id, occurredAt, type, severity }) => ({ id, occurredAt, type, severity, status: 'queued' as const })),
    ...bundle.reports,
  ].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  return <SettingsGroup title={t('account.reports')}>
    {!bundle.historyAvailable ? <ThemedText themeColor="textSecondary">{t('account.reportsUnavailable')}</ThemedText>
      : reports.length === 0 ? <ThemedText themeColor="textSecondary">{t('account.noReports')}</ThemedText> : null}
    {reports.map((report) => <View key={report.id} style={[styles.report, { borderColor: theme.border }]}>
      <View style={styles.heading}>
        <ThemedText type="bodyMedium">{t(`report.type.${report.type}`, { defaultValue: t('report.type.other') })}</ThemedText>
        <ThemedText type="label" themeColor={report.severity === 'critical' ? 'errorText' : report.severity === 'serious' ? 'warning' : 'textSecondary'}>
          {t(`report.severity.${report.severity}`, { defaultValue: report.severity })}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">{formatDateTime(getLanguage(), new Date(report.occurredAt))}</ThemedText>
      <ThemedText type="label" themeColor={report.status === 'queued' ? 'warning' : 'accent'}>{t(`account.reportStatus.${report.status}`)}</ThemedText>
    </View>)}
  </SettingsGroup>;
}

const styles = StyleSheet.create({
  report: { gap: Space[1], paddingVertical: Space[3], borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: Space[2] },
});
