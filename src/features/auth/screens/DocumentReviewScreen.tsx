import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useStore } from 'zustand';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Icon } from '@/common/components/ui/icon';
import { Input } from '@/common/components/ui/input';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Colors, Radius, Space } from '@/common/lib/theme';

import { accountService, documentsApi, profileApi } from '../authServices';
import { AuthScreen, sheetCard } from '../components/AuthScreen';
import { FormNotice } from '../components/FormNotice';
import { useKeyText } from '../hooks/useKeyText';
import { deleteCapturedFiles } from '../native/documentCapture';
import { saveConfirmedFields } from '../native/documentVault';
import { CONSENT_VERSION, DOCUMENT_FIELDS, type DocumentFieldKey, type User } from '../types/auth.schemas';
import { formErrorKey, missingFields, nameMismatch } from '../utils/authForm';
import { documentDraft, getConsentedAt, pageUris, resetDraftPages } from '../utils/documentDraft';

export function DocumentReviewScreen() {
  const { t } = useTranslation();
  const text = useKeyText();
  const { type, source, pages, fields, lowConfidence } = useStore(documentDraft);
  const [account, setAccount] = useState<User | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    profileApi.getProfile().then((user) => { if (active) setAccount(user); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!type || !source || pages.length < 2) return <Redirect href="/documents" />;
  const missing = missingFields(type, fields);

  const change = (field: DocumentFieldKey, value: string) => {
    documentDraft.setState({
      fields: { ...fields, [field]: value },
      lowConfidence: lowConfidence.filter((key) => key !== field),
    });
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
    const captureLanguage = getLanguage() === 'ar' ? 'ar' : 'fr';
    try {
      const response = await documentsApi.upload({
        type,
        source,
        pages,
        captureLanguage,
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
      await saveConfirmedFields(type, fields, captureLanguage).catch(() => undefined);
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
    <AuthScreen
      title={t(`documents.types.${type}`)}
      description={t('documents.reviewDescription')}
      overline={t('auth.stepThree')}
      showBack
      onBack={() => retake()}>
      <View style={sheetCard}>
        <View style={styles.pages}>
          {pages.map((page) => (
            <View key={page.side} style={styles.pageColumn}>
              <ThemedText type="overline" themeColor="textTertiary">
                {t(page.side === 'front' ? 'documents.front' : 'documents.back')}
              </ThemedText>
              {page.mimeType === 'application/pdf' ? (
                <View style={[styles.page, styles.pdf]}>
                  <Icon name="file" size={24} color={Colors.accent} />
                  <ThemedText type="label" themeColor="textSecondary" numberOfLines={2}>{page.fileName}</ThemedText>
                </View>
              ) : (
                <Image
                  source={{ uri: page.uri }}
                  contentFit="cover"
                  accessibilityLabel={t(page.side === 'front' ? 'documents.front' : 'documents.back')}
                  style={styles.page}
                />
              )}
            </View>
          ))}
        </View>
      </View>

      <View style={sheetCard}>
        <ThemedText type="heading" accessibilityRole="header">{t('documents.detailsTitle')}</ThemedText>
        {account && type === 'driver_license' && nameMismatch(fields, account) && (
          <FormNotice tone="warning" message={t('documents.nameMismatch')} />
        )}
        {DOCUMENT_FIELDS[type].map((field) => (
          <Input
            key={field}
            label={t(`documents.fields.${field}`)}
            value={fields[field] ?? ''}
            onChangeText={(value) => change(field, value)}
            error={showMissing && missing.includes(field) ? t('documents.errors.fieldRequired') : undefined}
            hint={lowConfidence.includes(field) ? t('documents.checkField') : undefined}
            editable={!uploading}
          />
        ))}
        {uploadError && <FormNotice message={text(uploadError)} />}
        <Button
          label={t(uploadError ? 'common.tryAgain' : 'documents.confirm')}
          size="large"
          loading={uploading}
          onPress={() => void confirm()}
        />
        <Button label={t('documents.retake')} variant="text" disabled={uploading} onPress={() => retake()} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  pages: { flexDirection: 'row', gap: Space[3] },
  pageColumn: { flex: 1, gap: Space[2] },
  page: { height: 112, borderRadius: Radius.md, backgroundColor: Colors.backgroundElement },
  pdf: { alignItems: 'center', justifyContent: 'center', gap: Space[1], padding: Space[2] },
});
