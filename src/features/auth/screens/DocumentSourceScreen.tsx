import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet } from 'react-native';
import { useStore } from 'zustand';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Space } from '@/common/lib/theme';

import { AuthScreen } from '../components/AuthScreen';
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

    const { uri, fileName, mimeType, sizeBytes } = result.file;
    const errors = fieldErrors(documentFileSchema, { mimeType, sizeBytes });
    const problem = errors.mimeType ?? errors.sizeBytes;
    if (problem) {
      setFileError(problem);
      return;
    }

    setFileError(null);
    setCameraDenied(null);
    const next = [...pages, { side, uri, fileName, mimeType } as CapturedPage];
    documentDraft.setState({ pages: next, source });
    if (next.length < 2) return;

    // OCR failure must never block manual entry on the review step.
    setBusy(true);
    const fields = await extractDocumentFields(type, next).catch(() => ({}));
    documentDraft.setState({ fields });
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
      description={t(side === 'front' ? 'documents.sideFront' : 'documents.sideBack')}>
      {rejectionReason && (
        <ThemedText type="label" themeColor="errorText" accessibilityRole="alert">{rejectionReason}</ThemedText>
      )}
      {cameraDenied && (
        <Card tone="muted" style={styles.card}>
          <ThemedText accessibilityRole="alert">{t('documents.cameraDenied')}</ThemedText>
          {!cameraDenied.canAskAgain && (
            <Button
              label={t('common.openSettings')}
              variant="secondary"
              onPress={() => void Linking.openSettings()}
            />
          )}
        </Card>
      )}
      {fileError && (
        <ThemedText type="label" themeColor="errorText" accessibilityRole="alert">{text(fileError)}</ThemedText>
      )}
      <Button label={t('documents.scan')} size="large" loading={busy} onPress={() => void run(scanPage, 'scan')} style={styles.action} />
      <Button label={t('documents.choosePhoto')} variant="secondary" size="large" disabled={busy} onPress={() => void run(pickPhoto, 'upload')} style={styles.action} />
      <Button label={t('documents.chooseFile')} variant="secondary" size="large" disabled={busy} onPress={() => void run(pickFile, 'upload')} style={styles.action} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Space[3], padding: Space[4] },
  action: { alignSelf: 'stretch' },
});
