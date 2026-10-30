import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useStore } from 'zustand';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Colors, Space } from '@/common/lib/theme';

import { AuthScreen, sheetCard } from '../components/AuthScreen';
import { FormNotice } from '../components/FormNotice';
import { SideProgress } from '../components/SideProgress';
import { SourceOption } from '../components/SourceOption';
import { useKeyText } from '../hooks/useKeyText';
import { pickFile, pickPhoto, scanPage, type CaptureResult } from '../native/documentCapture';
import { extractDocumentFields } from '../ocr/documentOcr';
import { documentFileSchema, type CapturedPage, type DocumentSource } from '../types/auth.schemas';
import { fieldErrors } from '../utils/authForm';
import { documentDraft } from '../utils/documentDraft';

export function DocumentSourceScreen() {
  const { t } = useTranslation();
  const text = useKeyText();
  const { type, pages, rejectionReason } = useStore(documentDraft);
  const [fileError, setFileError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState<{ canAskAgain: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!type) return <Redirect href="/documents" />;
  const side = pages.length === 0 ? 'front' : 'back';

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
    const { fields, lowConfidence } = await extractDocumentFields(type, next)
      .catch(() => ({ fields: {}, lowConfidence: [] }));
    documentDraft.setState({ fields, lowConfidence });
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
      overline={t('auth.stepTwo')}
      showBack>
      <View style={sheetCard}>
        <SideProgress side={side} />
        {rejectionReason && <FormNotice message={rejectionReason} />}
        {fileError && <FormNotice message={text(fileError)} />}
        {cameraDenied && (
          <>
            <FormNotice tone="warning" message={t('documents.cameraDenied')} />
            {!cameraDenied.canAskAgain && (
              <Button label={t('common.openSettings')} variant="secondary" onPress={() => void Linking.openSettings()} />
            )}
          </>
        )}
        {busy ? (
          <View style={styles.reading}>
            <ActivityIndicator color={Colors.accent} />
            <ThemedText type="body" themeColor="textSecondary">{t('documents.reading')}</ThemedText>
          </View>
        ) : (
          <View style={styles.options}>
            <SourceOption icon="camera" title={t('documents.scan')} description={t('documents.scanHint')} onPress={() => void run(scanPage, 'scan')} />
            <SourceOption icon="photo" title={t('documents.choosePhoto')} description={t('documents.photoHint')} onPress={() => void run(pickPhoto, 'upload')} />
            <SourceOption icon="file" title={t('documents.chooseFile')} description={t('documents.fileHint')} onPress={() => void run(pickFile, 'upload')} />
          </View>
        )}
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  options: { gap: Space[3] },
  reading: { alignItems: 'center', gap: Space[3], paddingVertical: Space[8] },
});
