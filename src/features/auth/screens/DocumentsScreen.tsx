import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Checkbox } from '@/common/components/ui/checkbox';
import { Icon } from '@/common/components/ui/icon';
import { Colors, Space } from '@/common/lib/theme';

import { accountService } from '../authServices';
import { AuthScreen, sheetCard } from '../components/AuthScreen';
import { DocumentTracker } from '../components/DocumentTracker';
import { FormNotice } from '../components/FormNotice';
import { useAccount } from '../hooks/useAccount';
import { nextDocument } from '../utils/authForm';
import { recordConsent, startDraft } from '../utils/documentDraft';

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

  const current = nextDocument(documents);

  return (
    <AuthScreen title={t('documents.title')} description={t('documents.description')} overline={t('auth.stepTwo')}>
      <View style={sheetCard}>
        {loadFailed ? (
          <>
            <FormNotice message={t('documents.loadFailed')} />
            <Button label={t('common.tryAgain')} variant="secondary" loading={retrying} onPress={() => void retry()} />
          </>
        ) : (
          <DocumentTracker documents={documents} current={current} />
        )}
      </View>

      <Card tone="accentSoft" style={styles.consent}>
        <View style={styles.consentTitle}>
          <Icon name="shield" size={20} color={Colors.accent} />
          <ThemedText type="headingS">{t('documents.consentTitle')}</ThemedText>
        </View>
        <ThemedText type="body" themeColor="textSecondary">{t('documents.consentBody')}</ThemedText>
        <Checkbox checked={consented} onPress={() => setConsented(!consented)} label={t('documents.consentAccept')} />
      </Card>

      <Button
        label={t('documents.continue')}
        size="large"
        disabled={!consented || loadFailed || !current}
        rightIcon={<Icon name="forward" size={16} color={Colors.onAccent} />}
        onPress={start}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  consent: { gap: Space[3], padding: Space[5], borderColor: Colors.accentSoft },
  consentTitle: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
});
