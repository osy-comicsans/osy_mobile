import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Checkbox } from '@/common/components/ui/checkbox';
import { Icon } from '@/common/components/ui/icon';
import { useTheme } from '@/common/hooks/use-theme';
import { Colors, Palette, Radius, Space } from '@/common/lib/theme';

import { accountService } from '../authServices';
import { AuthScreen } from '../components/AuthScreen';
import { DocumentTracker } from '../components/DocumentTracker';
import { FormNotice } from '../components/FormNotice';
import { useAccount } from '../hooks/useAccount';
import { DOCUMENT_ORDER } from '../types/auth.schemas';
import { nextDocument } from '../utils/authForm';
import { recordConsent, startDraft } from '../utils/documentDraft';

export function DocumentsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
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

  const current = nextDocument(documents);
  const sent = documents.filter((document) => document.status === 'pending' || document.status === 'verified').length;

  return (
    <AuthScreen
      title={t('documents.title')}
      description={t('documents.description')}
      progress={{ step: 1, fill: sent / DOCUMENT_ORDER.length }}
      footer={(
        <Button
          label={t(current ? `documents.add.${current}` : 'documents.continue')}
          size="large"
          disabled={!consented || loadFailed || !current}
          rightIcon={<Icon name="forward" size={18} color={Colors.onAccent} />}
          onPress={start}
        />
      )}>
      {loadFailed ? (
        <>
          <FormNotice message={t('documents.loadFailed')} />
          <Button label={t('common.tryAgain')} variant="tonal" size="large" loading={retrying} onPress={() => void retry()} />
        </>
      ) : (
        <DocumentTracker documents={documents} current={current} />
      )}

      <View style={[styles.consent, { backgroundColor: theme.background }]}>
        <View style={styles.consentTitle}>
          <Icon name="shield" size={20} color={theme.accent} />
          <ThemedText type="headingS" style={styles.consentHeading}>{t('documents.consentTitle')}</ThemedText>
        </View>
        <ThemedText type="body" style={styles.consentBody}>{t('documents.consentBody')}</ThemedText>
        <Checkbox checked={consented} onPress={() => setConsented(!consented)} label={t('documents.consentAccept')} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  consent: { gap: Space[3], padding: Space[4], borderRadius: Radius.lg },
  consentTitle: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  consentHeading: { flex: 1 },
  consentBody: { color: Palette.neutral[600] },
});
