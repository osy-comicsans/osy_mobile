import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Input } from '@/common/components/ui/input';
import { useTheme } from '@/common/hooks/use-theme';
import { MaxContentWidth, Space } from '@/common/lib/theme';
import { pickPhoto, scanPage, type CaptureResult, type PickedFile } from '@/features/auth/native/documentCapture';
import { useCurrentLocation, useDrivingState } from '@/features/location/hooks/useLocation';
import { isMapAvailable } from '@/features/map/utils/mapAvailability';

import { ChoicePills } from '../components/ChoicePills';
import type { ReportLocationMap as ReportLocationMapType } from '../components/ReportLocationMap';
import { useDismissModal } from '../hooks/useDismissModal';
import { useReportAccident, type ReportOutcome } from '../hooks/useReportAccident';
import {
  ACCIDENT_SEVERITIES, ACCIDENT_TYPES, canSubmitReport, INJURY_ANSWERS, isFreshFix, MAX_REPORT_NOTE_LENGTH,
  MAX_REPORT_PHOTO_BYTES, type AccidentSeverity, type AccidentType, type InjuryAnswer, type ReportLocation,
} from '../utils/accidentReport';

export function ReportAccidentScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const dismiss = useDismissModal();
  const fix = useCurrentLocation();
  const driving = useDrivingState() === 'driving';
  const { submit, saving, failed, photosSupported } = useReportAccident();

  const [openedAt] = useState(Date.now);
  const [passenger, setPassenger] = useState(false);
  // Kept from the first usable fix, so the report stays where the accident was.
  const [location, setLocation] = useState<ReportLocation | null>(null);
  const [pinned, setPinned] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [draftLocation, setDraftLocation] = useState<ReportLocation | null>(null);
  const [type, setType] = useState<AccidentType | null>(null);
  const [severity, setSeverity] = useState<AccidentSeverity | null>(null);
  const [injuries, setInjuries] = useState<InjuryAnswer | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ReportOutcome | null>(null);

  if (!location && fix && isFreshFix(fix, openedAt)) setLocation(fix);

  const form = { location, type, severity, injuries, note };
  const mapAvailable = isMapAvailable();

  const applyPhoto = (result: CaptureResult) => {
    setPhotoError(null);
    if (result.status === 'cameraDenied') setPhotoError(t('report.cameraDenied'));
    else if (result.status === 'picked' && result.file.sizeBytes > MAX_REPORT_PHOTO_BYTES) setPhotoError(t('report.photoTooLarge'));
    else if (result.status === 'picked') setPhoto(result.file);
  };

  const send = async () => {
    const result = await submit(form, photo);
    if (result) setOutcome(result);
  };

  if (outcome) {
    return (
      <Centered>
        <ThemedText type="heading">{t(`report.${outcome}Title`)}</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">{t(`report.${outcome}Body`)}</ThemedText>
        <Button label={t('report.done')} size="large" onPress={dismiss} />
      </Centered>
    );
  }

  if (driving && !passenger) {
    return (
      <Centered>
        <ThemedText type="heading">{t('report.passengerTitle')}</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">{t('report.passengerBody')}</ThemedText>
        <Button label={t('report.passenger')} size="large" onPress={() => setPassenger(true)} />
        <Button label={t('report.notNow')} variant="text" size="large" onPress={dismiss} />
      </Centered>
    );
  }

  if (adjusting) {
    // Loaded here, because Expo Go has no MapLibre and must still open this screen.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ReportLocationMap } = require('../components/ReportLocationMap') as { ReportLocationMap: typeof ReportLocationMapType };
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <ReportLocationMap initial={location} onChange={setDraftLocation} />
        <SafeAreaView pointerEvents="box-none" style={styles.mapOverlay}>
          <Card>
            <ThemedText type="label" themeColor="textSecondary">{t('report.mapHint')}</ThemedText>
          </Card>
          <Button
            label={t('report.useLocation')}
            size="large"
            disabled={!draftLocation}
            onPress={() => {
              setLocation(draftLocation);
              setPinned(true);
              setAdjusting(false);
            }}
          />
        </SafeAreaView>
      </View>
    );
  }

  const locationText = () => {
    if (pinned) return t('report.locationPinned');
    if (location) return t('report.locationAuto');
    return t(mapAvailable ? 'report.locationMissing' : 'report.mapUnavailable');
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <View style={styles.header}>
            <ThemedText type="heading">{t('safety.reportTitle')}</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">{t('report.description')}</ThemedText>
          </View>

          <Card style={styles.section}>
            <ThemedText type="bodyMedium">{t('report.locationLabel')}</ThemedText>
            <ThemedText type="label" themeColor={location ? 'textSecondary' : 'errorText'}>{locationText()}</ThemedText>
            {mapAvailable && (
              <Button
                label={t(location ? 'report.adjust' : 'report.setOnMap')}
                variant="secondary"
                size="small"
                onPress={() => {
                  setDraftLocation(location);
                  setAdjusting(true);
                }}
              />
            )}
          </Card>

          <Field label={t('report.typeLabel')}>
            <ChoicePills
              label={t('report.typeLabel')}
              options={ACCIDENT_TYPES.map((value) => ({ value, label: t(`report.type.${value}`) }))}
              selected={type}
              onSelect={setType}
            />
          </Field>

          <Field label={t('report.severityLabel')}>
            <ChoicePills
              label={t('report.severityLabel')}
              options={ACCIDENT_SEVERITIES.map((value) => ({ value, label: t(`report.severity.${value}`) }))}
              selected={severity}
              onSelect={setSeverity}
            />
          </Field>

          <Field label={t('report.injuriesLabel')}>
            <ChoicePills
              label={t('report.injuriesLabel')}
              options={INJURY_ANSWERS.map((value) => ({ value, label: t(`report.injuries.${value}`) }))}
              selected={injuries}
              onSelect={setInjuries}
            />
          </Field>

          <Input
            label={t('report.noteLabel')}
            value={note}
            onChangeText={setNote}
            maxLength={MAX_REPORT_NOTE_LENGTH}
            multiline
          />

          {photosSupported && (
            <Field label={t('report.photoLabel')}>
              {photo ? (
                <View style={styles.photoRow}>
                  <ThemedText type="label" themeColor="textSecondary">{t('report.photoAdded')}</ThemedText>
                  <Button label={t('report.removePhoto')} variant="text" size="small" onPress={() => setPhoto(null)} />
                </View>
              ) : (
                <View style={styles.photoRow}>
                  <Button label={t('report.takePhoto')} variant="subtle" size="small" onPress={() => void scanPage().then(applyPhoto)} />
                  <Button label={t('report.choosePhoto')} variant="subtle" size="small" onPress={() => void pickPhoto().then(applyPhoto)} />
                </View>
              )}
              {photoError && <ThemedText type="label" themeColor="errorText" accessibilityRole="alert">{photoError}</ThemedText>}
            </Field>
          )}

          {failed && <ThemedText type="label" themeColor="errorText" accessibilityRole="alert">{t('report.failed')}</ThemedText>}
          <Button
            label={t('report.send')}
            size="large"
            loading={saving}
            disabled={!canSubmitReport(form)}
            onPress={() => void send()}
          />
          <Button label={t('common.dismiss')} variant="text" size="large" onPress={dismiss} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="bodyMedium">{label}</ThemedText>
      {children}
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.root, styles.centered, { backgroundColor: theme.background }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: Space[3], padding: Space[6] },
  content: { gap: Space[5], padding: Space[4], paddingTop: Space[6], width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { gap: Space[1] },
  section: { gap: Space[2] },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[2] },
  mapOverlay: { flex: 1, justifyContent: 'space-between', padding: Space[4] },
});
