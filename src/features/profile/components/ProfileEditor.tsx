import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Input } from '@/common/components/ui/input';
import { useOfflineStatus } from '@/common/hooks/use-offline';
import { SettingsGroup } from '@/features/settings/components/SettingsControls';
import type { ProfileBundle } from '../types/profile.schemas';
import { useProfileEditor } from '../hooks/useProfileEditor';

export function ProfileEditor({ bundle }: { bundle: ProfileBundle }) {
  const { t } = useTranslation(); const { supported } = useOfflineStatus();
  const { draft, setDraft, photo, saving, failed, saved, save, choosePhoto } = useProfileEditor(bundle);
  return <>
    <SettingsGroup title={t('account.details')}>
      <Input label={t('auth.firstName')} value={draft.firstName} onChangeText={(firstName) => setDraft({ ...draft, firstName })} autoComplete="given-name" />
      <Input label={t('auth.lastName')} value={draft.lastName} onChangeText={(lastName) => setDraft({ ...draft, lastName })} autoComplete="family-name" />
      <Input label={t('auth.mobileNumber')} hint={t('auth.mobileHint')} value={draft.mobileNumber} onChangeText={(mobileNumber) => setDraft({ ...draft, mobileNumber })} keyboardType="phone-pad" />
      <Input label={t('account.vehicle')} value={draft.vehicle} onChangeText={(vehicle) => setDraft({ ...draft, vehicle })} maxLength={150} />
      {supported ? <Button label={t(photo ? 'account.photoSelected' : 'account.changePhoto')} variant="secondary" disabled={saving}
        onPress={() => { void choosePhoto(); }} /> : null}
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
