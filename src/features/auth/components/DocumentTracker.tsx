import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Icon, type IconName } from '@/common/components/ui/icon';
import { useTheme } from '@/common/hooks/use-theme';
import { Colors, Palette, Radius, Space, Typography } from '@/common/lib/theme';

import { DOCUMENT_ORDER, type DocumentRecord, type DocumentType } from '../types/auth.schemas';

const icons: Record<DocumentType, IconName> = { driver_license: 'idCard', vehicle_registration: 'car' };

// Each status has its own word, so it is never shown by colour alone.
const pills = {
  next: { label: 'documents.status.next', background: Colors.accent, color: Colors.onAccent, dot: null },
  missing: { label: 'documents.status.missing', background: Colors.backgroundElement, color: Palette.neutral[600], dot: null },
  pending: { label: 'documents.status.pending', background: Colors.warningSoft, color: Palette.neutral[600], dot: Colors.warning },
  verified: { label: 'documents.status.verified', background: Colors.successSoft, color: Colors.textPrimary, dot: Colors.success },
  rejected: { label: 'documents.status.rejected', background: Colors.errorSoft, color: Colors.textPrimary, dot: Colors.error },
} as const;

function StatusPill({ status }: { status: keyof typeof pills }) {
  const { t } = useTranslation();
  const { label, background, color, dot } = pills[status];
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
      <Text style={[styles.pillText, { color }]}>{t(label)}</Text>
    </View>
  );
}

export function DocumentTracker({ documents, current }: { documents: DocumentRecord[]; current: DocumentType | null }) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={[styles.list, { borderColor: theme.border }]}>
      {DOCUMENT_ORDER.map((type, index) => {
        const record = documents.find((document) => document.type === type);
        const status = record?.status ?? 'missing';
        return (
          <View key={type}>
            {index > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
            <View style={styles.row}>
              <View style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
                <Icon name={icons[type]} size={22} color={theme.accent} />
              </View>
              <View style={styles.text}>
                <ThemedText type="headingS">{t(`documents.types.${type}`)}</ThemedText>
                <ThemedText type="body" themeColor="textSecondary">{t('documents.bothSides')}</ThemedText>
                {record?.rejectionReason && (
                  <ThemedText type="label" themeColor="errorText">{record.rejectionReason}</ThemedText>
                )}
              </View>
              <StatusPill status={status === 'missing' && type === current ? 'next' : status} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  divider: { height: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    paddingHorizontal: Space[4],
    paddingVertical: Space[3],
  },
  tile: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    paddingHorizontal: Space[3],
    paddingVertical: Space[1],
    borderRadius: Radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: Typography.labelStrong,
});
