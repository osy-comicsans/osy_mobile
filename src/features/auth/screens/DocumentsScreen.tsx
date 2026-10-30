import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Checkbox } from '@/common/components/ui/checkbox';
import { StatusPill, type StatusPillStatus } from '@/common/components/ui/status-pill';
import { Space } from '@/common/lib/theme';

import { accountService } from '../authServices';
import { AuthScreen } from '../components/AuthScreen';
import { useAccount } from '../hooks/useAccount';
import { DOCUMENT_ORDER, type DocumentRecord } from '../types/auth.schemas';
import { nextDocument } from '../utils/authForm';
import { recordConsent, startDraft } from '../utils/documentDraft';

const statusPills: Record<DocumentRecord['status'], StatusPillStatus> = {
  missing: 'waiting',
  pending: 'pending',
  verified: 'approved',
  rejected: 'rejected',
};

export function DocumentsScreen() {
  const { t } = useTranslation();
  const { documents, loadFailed } = useAccount();
  const [consented, setConsented] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    await accountService.refresh();
    setRetrying(false);
  };

  const start = () => {
    const type = nextDocument(documents);
    if (!type) return;
    recordConsent();
    startDraft(type, documents.find((document) => document.type === type)?.rejectionReason ?? null);
    router.push('/document-source');
  };

  return (
    <AuthScreen title={t('documents.title')} description={t('documents.description')}>
      {loadFailed ? (
        <Card tone="muted" style={styles.card}>
          <ThemedText accessibilityRole="alert">{t('documents.loadFailed')}</ThemedText>
          <Button label={t('common.tryAgain')} variant="secondary" loading={retrying} onPress={() => void retry()} />
        </Card>
      ) : (
        DOCUMENT_ORDER.map((type) => {
          const record = documents.find((document) => document.type === type);
          const status = record?.status ?? 'missing';
          return (
            <Card key={type} style={styles.card}>
              <View style={styles.row}>
                <ThemedText type="headingS" style={styles.name}>{t(`documents.types.${type}`)}</ThemedText>
                <StatusPill status={statusPills[status]} label={t(`documents.status.${status}`)} />
              </View>
              {record?.rejectionReason && (
                <ThemedText type="label" themeColor="errorText">{record.rejectionReason}</ThemedText>
              )}
            </Card>
          );
        })
      )}

      <Card tone="muted" style={styles.card}>
        <ThemedText type="bodyMedium">{t('documents.consentTitle')}</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">{t('documents.consentBody')}</ThemedText>
        <Checkbox checked={consented} onPress={() => setConsented(!consented)} label={t('documents.consentAccept')} />
      </Card>

      <Button
        label={t('documents.continue')}
        size="large"
        disabled={!consented || loadFailed || !nextDocument(documents)}
        onPress={start}
        style={styles.action}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Space[3], padding: Space[4] },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Space[2] },
  name: { flex: 1, minWidth: 140 },
  action: { alignSelf: 'stretch' },
});
