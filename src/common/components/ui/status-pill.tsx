import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Typography } from '@/common/lib/theme';

export type StatusPillStatus =
  | 'inProgress'
  | 'approved'
  | 'rejected'
  | 'escalated'
  | 'pending'
  | 'waiting'
  | 'synced'
  | 'stopped';

const statusStyles = {
  inProgress: { bg: Colors.accentSoft, fg: Colors.accent, glyph: '◌', label: 'In progress' },
  approved: { bg: Colors.successSoft, fg: Colors.successText, glyph: '✓', label: 'Approved' },
  synced: { bg: Colors.successSoft, fg: Colors.successText, glyph: '✓', label: 'Synced' },
  rejected: { bg: Colors.errorSoft, fg: Colors.errorText, glyph: '✕', label: 'Rejected' },
  escalated: { bg: Colors.warningSoft, fg: Colors.warning, glyph: '↑', label: 'Escalated' },
  pending: { bg: Colors.warningSoft, fg: Colors.warning, glyph: '↑', label: 'Pending' },
  waiting: { bg: Colors.backgroundElement, fg: Colors.textTertiary, glyph: '·', label: 'Waiting' },
  stopped: { bg: Colors.backgroundElement, fg: Colors.textSecondary, glyph: '·', label: 'Stopped' },
} as const;

export function StatusPill({
  status,
  label,
  showGlyph = true,
}: {
  status: StatusPillStatus;
  label?: string;
  showGlyph?: boolean;
}) {
  const config = statusStyles[status];
  return (
    <View style={[styles.pill, { backgroundColor: config.bg }]}>
      {showGlyph ? <Text style={[styles.glyph, { color: config.fg }]}>{config.glyph}</Text> : null}
      <Text style={[styles.label, { color: config.fg }]}>{label ?? config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  glyph: { ...Typography.labelMedium },
  label: { ...Typography.labelMedium },
});
