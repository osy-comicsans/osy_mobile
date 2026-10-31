import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Input } from '@/common/components/ui/input';
import { useOfflineStatus } from '@/common/hooks/use-offline';
import { useTheme } from '@/common/hooks/use-theme';
import { profilePhotos } from '@/common/lib/native/profilePhoto';
import { Radius, Space } from '@/common/lib/theme';
import { SettingsGroup } from '@/features/settings/components/SettingsControls';
import type { ProfileBundle } from '../types/profile.schemas';
import { useProfileEditor } from '../hooks/useProfileEditor';
import { rejectedFieldLabels, rejectedFields, type ProfileRejection, type RejectedField } from '../utils/profileService';

export function ProfileEditor({ bundle, rejection }: { bundle: ProfileBundle; rejection: ProfileRejection | null }) {
  const { t } = useTranslation(); const { supported } = useOfflineStatus();
  const { draft, setDraft, photo, saving, failed, saved, save, choosePhoto } = useProfileEditor(bundle);
  const rejected = rejectedFields(rejection);
  const fieldError = (field: RejectedField) => (rejected.includes(field)
    ? t(rejection?.kind === 'conflict' ? 'account.fieldTaken' : 'account.fieldRejected', { field: t(rejectedFieldLabels[field]) }) : undefined);
  const current = (bundle.pendingPhoto && profilePhotos.uriOf(bundle.pendingPhoto)) || bundle.profile.photoUrl;
  const staged = photo ? profilePhotos.uriOf(photo) : null;
  return <>
    <SettingsGroup title={t('account.details')}>
      <Input label={t('auth.firstName')} value={draft.firstName} onChangeText={(firstName) => setDraft({ ...draft, firstName })} autoComplete="given-name" error={fieldError('firstName')} />
      <Input label={t('auth.lastName')} value={draft.lastName} onChangeText={(lastName) => setDraft({ ...draft, lastName })} autoComplete="family-name" error={fieldError('lastName')} />
      <Input label={t('auth.mobileNumber')} hint={t('auth.mobileHint')} value={draft.mobileNumber} onChangeText={(mobileNumber) => setDraft({ ...draft, mobileNumber })} keyboardType="phone-pad"
        error={fieldError('mobileNumber')} />
      <Input label={t('account.vehicle')} value={draft.vehicle} onChangeText={(vehicle) => setDraft({ ...draft, vehicle })} maxLength={150} error={fieldError('vehicle')} />
      {supported ? <>
        {current || staged ? <View style={styles.photos}>
          {current ? <PhotoPreview uri={current} label={t('account.currentPhoto')} /> : null}
          {staged ? <PhotoPreview uri={staged} label={t('account.photoSelected')} /> : null}
        </View> : null}
        <Button label={t('account.changePhoto')} variant="secondary" disabled={saving} onPress={() => { void choosePhoto(); }} />
      </> : null}
    </SettingsGroup>
    <SettingsGroup title={t('account.medical')} description={t('account.medicalHint')}>
      <Input label={t('account.bloodType')} value={draft.medical.bloodType} maxLength={10} onChangeText={(bloodType) => setDraft({ ...draft, medical: { ...draft.medical, bloodType } })} />
      <Input label={t('account.allergies')} value={draft.medical.allergies} maxLength={500} onChangeText={(allergies) => setDraft({ ...draft, medical: { ...draft.medical, allergies } })} />
      <Input label={t('account.conditions')} value={draft.medical.conditions} maxLength={1000} onChangeText={(conditions) => setDraft({ ...draft, medical: { ...draft.medical, conditions } })} />
      {failed ? <ThemedText themeColor="errorText" accessibilityRole="alert">{t('account.invalid')}</ThemedText> : null}
      {saved ? <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">{t('account.savedLocally')}</ThemedText> : null}
      <Button label={t('account.save')} size="large" loading={saving} onPress={() => { void save(); }} />
    </SettingsGroup>
  </>;
}

function PhotoPreview({ uri, label }: { uri: string; label: string }) {
  const theme = useTheme();
  return <View style={styles.preview} accessible accessibilityRole="image" accessibilityLabel={label}>
    <Image source={{ uri }} style={[styles.thumbnail, { backgroundColor: theme.backgroundElement }]} contentFit="cover" />
    <ThemedText type="label" themeColor="textSecondary" style={styles.caption}>{label}</ThemedText>
  </View>;
}

const styles = StyleSheet.create({
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[5] },
  preview: { alignItems: 'center', gap: Space[2], maxWidth: 140 },
  thumbnail: { width: 72, height: 72, borderRadius: Radius.full },
  caption: { textAlign: 'center' },
});
