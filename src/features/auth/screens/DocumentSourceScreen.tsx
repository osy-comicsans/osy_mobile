import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useStore } from 'zustand';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Icon } from '@/common/components/ui/icon';
import { useTheme } from '@/common/hooks/use-theme';
import { Colors, Radius, Space } from '@/common/lib/theme';

import { AuthScreen } from '../components/AuthScreen';
import { FormNotice } from '../components/FormNotice';
import { LabelDivider } from '../components/LabelDivider';
import { SideProgress } from '../components/SideProgress';
import { SourceOption } from '../components/SourceOption';
import { useKeyText } from '../hooks/useKeyText';
import { pickFile, pickPhoto, scanPage, type CaptureResult } from '../native/documentCapture';
import { extractDocumentFields } from '../ocr/documentOcr';
import { DOCUMENT_ORDER, documentFileSchema, type CapturedPage, type DocumentSource } from '../types/auth.schemas';
import { fieldErrors } from '../utils/authForm';
import { documentDraft } from '../utils/documentDraft';

export function DocumentSourceScreen() {
  const { t } = useTranslation();
  const text = useKeyText();
  const theme = useTheme();
  const { type, pages, rejectionReason } = useStore(documentDraft);
  const [fileError, setFileError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState<{ canAskAgain: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!type) return <Redirect href="/documents" />;
  const side = pages.length === 0 ? 'front' : 'back';
  // Each document is half of the Documents step, and the side being added counts as started.
  const fill = (DOCUMENT_ORDER.indexOf(type) * 2 + pages.length + 1) / (DOCUMENT_ORDER.length * 2);

  const accept = async (result: CaptureResult, source: DocumentSource) => {
    if (result.status === 'canceled') return;
    if (result.status === 'cameraDenied') {
      setCameraDenied({ canAskAgain: result.canAskAgain });
      return;
    }

    const { uri, fileName, mimeType, sizeBytes, width } = result.file;
    const errors = fieldErrors(documentFileSchema, { mimeType, sizeBytes });
    const problem = errors.mimeType ?? errors.sizeBytes;
    if (problem) {
      setFileError(problem);
      return;
    }

    setFileError(null);
    setCameraDenied(null);
    const next = [...pages, { side, uri, fileName, mimeType, width } as CapturedPage];
    documentDraft.setState({ pages: next, source });
    if (next.length < 2) return;

    // OCR failure must never block manual entry on the review step.
    setBusy(true);
    const { fields, lowConfidence, failed, failureReason } = await extractDocumentFields(type, next);
    documentDraft.setState({ fields, lowConfidence, ocrFailed: failed, ocrFailureReason: failureReason });
    setBusy(false);
    router.replace('/document-review');
  };

  const run = async (capture: () => Promise<CaptureResult>, source: DocumentSource) => {
    try {
      await accept(await capture(), source);
    } catch {
      setFileError('documents.errors.captureFailed');
    }
  };

  return (
    <AuthScreen
      title={t(`documents.types.${type}`)}
      description={t(side === 'front' ? 'documents.sideFront' : 'documents.sideBack')}
      progress={{ step: 1, fill }}
      showBack
      footer={(
        <View style={styles.privacy}>
          <Icon name="lock" size={16} color={theme.textSecondary} />
          <ThemedText type="label" themeColor="textSecondary" style={styles.privacyText}>{t('documents.privacy')}</ThemedText>
        </View>
      )}>
      <SideProgress side={side} />
      {rejectionReason && <FormNotice message={rejectionReason} />}
      {fileError && <FormNotice message={text(fileError)} />}
      {cameraDenied && (
        <>
          <FormNotice tone="warning" message={t('documents.cameraDenied')} />
          {!cameraDenied.canAskAgain && (
            <Button label={t('common.openSettings')} variant="tonal" size="large" onPress={() => void Linking.openSettings()} />
          )}
        </>
      )}
      {busy ? (
        <View style={styles.reading}>
          <ActivityIndicator color={Colors.accent} />
          <ThemedText type="body" themeColor="textSecondary">{t('documents.reading')}</ThemedText>
        </View>
      ) : (
        <>
          <SourceOption
            variant="featured"
            icon="camera"
            title={t('documents.scan')}
            description={t('documents.scanHint')}
            tips={[t('documents.tips.flat'), t('documents.tips.light')]}
            onPress={() => void run(scanPage, 'scan')}
          />
          <LabelDivider label={t('documents.otherSources')} />
          <View style={[styles.list, { borderColor: theme.border }]}>
            <SourceOption variant="row" icon="photo" title={t('documents.choosePhoto')} description={t('documents.photoHint')}
              onPress={() => void run(pickPhoto, 'upload')} />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SourceOption variant="row" icon="file" title={t('documents.chooseFile')} description={t('documents.fileHint')}
              onPress={() => void run(pickFile, 'upload')} />
          </View>
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  divider: { height: 1 },
  reading: { alignItems: 'center', gap: Space[3], paddingVertical: Space[8] },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: Space[2] },
  privacyText: { flex: 1 },
});
