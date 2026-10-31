import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStore } from 'zustand';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Icon } from '@/common/components/ui/icon';
import { Input } from '@/common/components/ui/input';
import { useTheme } from '@/common/hooks/use-theme';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Radius, Space, Typography } from '@/common/lib/theme';

import { accountService, documentsApi, profileApi } from '../authServices';
import { AuthScreen } from '../components/AuthScreen';
import { FormNotice } from '../components/FormNotice';
import { useKeyText } from '../hooks/useKeyText';
import { deleteCapturedFiles } from '../native/documentCapture';
import { saveConfirmedFields, saveVehicle } from '../native/documentVault';
import {
  CONSENT_VERSION,
  DOCUMENT_FIELDS,
  type DocumentFieldKey,
  type DocumentType,
  type User,
} from '../types/auth.schemas';
import { formErrorKey, missingFields, nameMismatch } from '../utils/authForm';
import { documentDraft, getConsentedAt, pageUris, resetDraftPages } from '../utils/documentDraft';

// Short licence details share a row. Every other field gets a row of its own.
const PAIRED_FIELDS: Partial<Record<DocumentType, DocumentFieldKey[][]>> = {
  driver_license: [['lastName', 'firstName'], ['dateOfBirth', 'category']],
};

function fieldRows(type: DocumentType): DocumentFieldKey[][] {
  const pairs = PAIRED_FIELDS[type] ?? [];
  const paired = new Set(pairs.flat());
  return [...pairs, ...DOCUMENT_FIELDS[type].filter((field) => !paired.has(field)).map((field) => [field])];
}

export function DocumentReviewScreen() {
  const { t } = useTranslation();
  const text = useKeyText();
  const theme = useTheme();
  const { type, source, pages, fields, lowConfidence, ocrFailed, ocrFailureReason } = useStore(documentDraft);
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
      if (type === 'vehicle_registration') {
        await Promise.resolve(account ?? profileApi.getProfile())
          .then(({ id }) => saveVehicle(id, fields)).catch(() => undefined);
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
    <AuthScreen
      title={t(`documents.types.${type}`)}
      description={t('documents.reviewDescription')}
      progress={{ step: 2, fill: 0.5 }}
      showBack
      onBack={() => retake()}
      footer={(
        <>
          {uploadError && <FormNotice message={text(uploadError)} />}
          <Button
            label={t(uploadError ? 'common.tryAgain' : 'documents.confirm')}
            size="large"
            loading={uploading}
            onPress={() => void confirm()}
          />
        </>
      )}>
      <View style={styles.section}>
        <View style={styles.heading}>
          <ThemedText type="headingS" accessibilityRole="header">{t('documents.photos')}</ThemedText>
          <Pressable
            accessibilityRole="button"
            disabled={uploading}
            onPress={() => retake()}
            style={({ pressed }) => [styles.retake, (pressed || uploading) && styles.retakeFaded]}>
            <Icon name="retake" size={16} color={theme.accent} />
            <ThemedText style={[Typography.bodyStrong, { color: theme.accent }]}>{t('documents.retake')}</ThemedText>
          </Pressable>
        </View>
        <View style={styles.pages}>
          {pages.map((page) => {
            const label = t(page.side === 'front' ? 'documents.front' : 'documents.back');
            return (
              <View key={page.side} style={styles.pageColumn}>
                {page.mimeType === 'application/pdf' ? (
                  <View style={[styles.page, styles.pdf, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                    <Icon name="file" size={24} color={theme.accent} />
                    <ThemedText type="label" themeColor="textSecondary" numberOfLines={2}>{page.fileName}</ThemedText>
                  </View>
                ) : (
                  <Image
                    source={{ uri: page.uri }}
                    contentFit="cover"
                    accessibilityLabel={label}
                    style={[styles.page, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
                  />
                )}
                <ThemedText type="label" themeColor="textSecondary">{label}</ThemedText>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.details}>
        <ThemedText type="headingS" accessibilityRole="header">{t('documents.detailsTitle')}</ThemedText>
        {ocrFailed && (
          <FormNotice
            tone="warning"
            message={__DEV__ && ocrFailureReason ? `${t('documents.ocrFailed')} (${ocrFailureReason})` : t('documents.ocrFailed')}
          />
        )}
        {account && type === 'driver_license' && nameMismatch(fields, account) && (
          <FormNotice tone="warning" message={t('documents.nameMismatch')} />
        )}
        {fieldRows(type).map((row) => (
          <View key={row.join()} style={styles.fieldRow}>
            {row.map((field) => (
              <Input
                key={field}
                label={t(`documents.fields.${field}`)}
                value={fields[field] ?? ''}
                onChangeText={(value) => change(field, value)}
                error={showMissing && missing.includes(field) ? t('documents.errors.fieldRequired') : undefined}
                warning={lowConfidence.includes(field) ? t('documents.checkField') : undefined}
                editable={!uploading}
                containerStyle={styles.field}
              />
            ))}
          </View>
        ))}
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Space[2] },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  retake: { flexDirection: 'row', alignItems: 'center', gap: Space[2], minHeight: 44 },
  retakeFaded: { opacity: 0.5 },
  pages: { flexDirection: 'row', gap: Space[3] },
  pageColumn: { flex: 1, gap: Space[2] },
  page: { height: 104, borderRadius: Radius.md, borderWidth: 1 },
  pdf: { alignItems: 'center', justifyContent: 'center', gap: Space[1], padding: Space[2] },
  details: { gap: Space[4], marginTop: Space[1] },
  fieldRow: { flexDirection: 'row', gap: Space[3] },
  field: { flex: 1 },
});
