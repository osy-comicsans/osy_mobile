import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useStore } from 'zustand';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Input } from '@/common/components/ui/input';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Radius, Space } from '@/common/lib/theme';

import { accountService, documentsApi } from '../authServices';
import { AuthScreen } from '../components/AuthScreen';
import { useKeyText } from '../hooks/useKeyText';
import { deleteCapturedFiles } from '../native/documentCapture';
import { CONSENT_VERSION, DOCUMENT_FIELDS, type DocumentFieldKey } from '../types/auth.schemas';
import { formErrorKey, missingFields } from '../utils/authForm';
import { documentDraft, getConsentedAt, pageUris, resetDraftPages } from '../utils/documentDraft';

export function DocumentReviewScreen() {
  const { t } = useTranslation();
  const text = useKeyText();
  const { type, source, pages, fields } = useStore(documentDraft);
  const [showMissing, setShowMissing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!type || !source || pages.length < 2) return <Redirect href="/documents" />;
  const missing = missingFields(type, fields);

  const change = (field: DocumentFieldKey, value: string) => {
    documentDraft.setState({ fields: { ...fields, [field]: value } });
  };

  const retake = (rejectionReason: string | null = null) => {
    deleteCapturedFiles(pageUris());
    resetDraftPages(rejectionReason);
    router.replace('/document-source');
  };

  const confirm = async () => {
    if (uploading) return;
    setShowMissing(true);
    if (missing.length > 0) return;

    setUploading(true);
    setUploadError(null);
    try {
      const response = await documentsApi.upload({
        type,
        source,
        pages,
        captureLanguage: getLanguage() === 'ar' ? 'ar' : 'fr',
        fields,
        consentVersion: CONSENT_VERSION,
        consentedAt: getConsentedAt(),
      });
      const record = response.documents.find((document) => document.type === type);
      if (record?.status === 'rejected') {
        accountService.apply(response);
        retake(record.rejectionReason);
        return;
      }
      deleteCapturedFiles(pageUris());
      resetDraftPages();
      accountService.apply(response);
      if (response.onboardingStatus !== 'complete') router.dismissTo('/documents');
    } catch (error) {
      // The document stays in memory so the user can retry without capturing it again.
      setUploadError(formErrorKey(error));
      setUploading(false);
    }
  };

  return (
    <AuthScreen title={t(`documents.types.${type}`)} description={t('documents.reviewDescription')}>
      <View style={styles.pages}>
        {pages.map((page) => (
          page.mimeType === 'application/pdf' ? (
            <Card key={page.side} tone="muted" style={styles.page}>
              <ThemedText type="label" themeColor="textSecondary">{page.fileName}</ThemedText>
            </Card>
          ) : (
            <Image
              key={page.side}
              source={{ uri: page.uri }}
              contentFit="contain"
              accessibilityLabel={t(page.side === 'front' ? 'documents.sideFront' : 'documents.sideBack')}
              style={styles.page}
            />
          )
        ))}
      </View>

      {DOCUMENT_FIELDS[type].map((field) => (
        <Input
          key={field}
          label={t(`documents.fields.${field}`)}
          value={fields[field] ?? ''}
          onChangeText={(value) => change(field, value)}
          error={showMissing && missing.includes(field) ? t('documents.errors.fieldRequired') : undefined}
          editable={!uploading}
        />
      ))}

      {uploadError && (
        <ThemedText type="label" themeColor="errorText" accessibilityRole="alert">{text(uploadError)}</ThemedText>
      )}
      <Button
        label={t(uploadError ? 'common.tryAgain' : 'documents.confirm')}
        size="large"
        loading={uploading}
        onPress={() => void confirm()}
        style={styles.action}
      />
      <Button
        label={t('documents.retake')}
        variant="secondary"
        size="large"
        disabled={uploading}
        onPress={() => retake()}
        style={styles.action}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  pages: { flexDirection: 'row', gap: Space[2] },
  page: { flex: 1, height: 120, borderRadius: Radius.md, justifyContent: 'center', padding: Space[2] },
  action: { alignSelf: 'stretch' },
});
