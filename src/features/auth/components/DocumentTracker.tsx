import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Icon } from '@/common/components/ui/icon';
import { StatusPill, type StatusPillStatus } from '@/common/components/ui/status-pill';
import { Colors, Palette, Radius, Space } from '@/common/lib/theme';

import { DOCUMENT_ORDER, type DocumentRecord, type DocumentType } from '../types/auth.schemas';

const statusPills: Record<DocumentRecord['status'], StatusPillStatus> = {
  missing: 'waiting',
  pending: 'pending',
  verified: 'approved',
  rejected: 'rejected',
};

type StepState = 'done' | 'active' | 'rejected' | 'upcoming';

function Node({ state }: { state: StepState }) {
  if (state === 'done') {
    return <View style={[styles.node, styles.nodeDone]}><Icon name="check" size={14} color={Colors.onAccent} /></View>;
  }
  if (state === 'rejected') {
    return <View style={[styles.node, styles.nodeRejected]}><Icon name="close" size={14} color={Colors.onAccent} /></View>;
  }
  if (state === 'active') return <View style={[styles.node, styles.nodeActive]} />;
  return <View style={styles.upcomingDot} />;
}

// DESIGN.md §15: the workflow tracker, with one step per document.
export function DocumentTracker({ documents, current }: { documents: DocumentRecord[]; current: DocumentType | null }) {
  const { t } = useTranslation();

  return (
    <View>
      {DOCUMENT_ORDER.map((type, index) => {
        const record = documents.find((document) => document.type === type);
        const status = record?.status ?? 'missing';
        const done = status === 'pending' || status === 'verified';
        const state: StepState = done ? 'done' : status === 'rejected' ? 'rejected' : type === current ? 'active' : 'upcoming';
        const last = index === DOCUMENT_ORDER.length - 1;

        return (
          <View key={type} style={styles.step}>
            <View style={styles.rail}>
              <Node state={state} />
              {!last && <View style={[styles.connector, done && styles.connectorDone]} />}
            </View>
            <View style={[styles.content, !last && styles.contentSpaced]}>
              <View style={styles.titleRow}>
                <ThemedText
                  type="headingS"
                  themeColor={state === 'upcoming' ? 'textTertiary' : 'textPrimary'}
                  style={styles.title}>
                  {t(`documents.types.${type}`)}
                </ThemedText>
                <StatusPill status={statusPills[status]} label={t(`documents.status.${status}`)} showGlyph={false} />
              </View>
              <ThemedText type="label" themeColor="textSecondary">{t('documents.bothSides')}</ThemedText>
              {record?.rejectionReason && (
                <ThemedText type="label" themeColor="errorText">{record.rejectionReason}</ThemedText>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const NODE_SIZE = 24;
const RAIL_WIDTH = 32;

const styles = StyleSheet.create({
  step: { flexDirection: 'row' },
  rail: { width: RAIL_WIDTH, alignItems: 'center' },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDone: { backgroundColor: Colors.accent },
  nodeRejected: { backgroundColor: Colors.error },
  nodeActive: { borderWidth: 2, borderColor: Colors.accent, backgroundColor: Colors.surface },
  upcomingDot: {
    width: 10,
    height: 10,
    marginVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Palette.neutral[300],
  },
  connector: { flex: 1, width: 2, backgroundColor: Palette.neutral[200] },
  connectorDone: { backgroundColor: Colors.accent },
  content: { flex: 1, gap: Space[1], paddingStart: Space[2] },
  contentSpaced: { paddingBottom: Space[6] },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[2] },
  title: { flex: 1, minWidth: 120 },
});
