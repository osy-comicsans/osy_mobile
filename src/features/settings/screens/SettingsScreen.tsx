import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/common/components/themed-text';
import { AccountPage } from '@/common/components/ui/account-page';
import { Button } from '@/common/components/ui/button';
import { Input } from '@/common/components/ui/input';
import { appInfo } from '@/common/lib/native/appInfo';
import { subscribeToForeground } from '@/common/lib/native/appLifecycle';
import { canOpenSystemSettings, openSystemSettings } from '@/common/lib/native/systemSettings';
import { isVoiceAvailable, speakGuidance } from '@/common/lib/native/voice';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { formatNumber } from '@/common/lib/i18n/format';
import { useOfflineStatus } from '@/common/hooks/use-offline';
import { useAlertService, useAlertState } from '@/features/alerts/hooks/useAlerts';
import { useLocationService, useLocationState } from '@/features/location/hooks/useLocation';
import { useCheckInState } from '@/features/safety/hooks/useCheckIn';
import { useEscalation } from '@/features/safety/hooks/useEscalation';
import { voiceDriver } from '@/features/safety/native/voiceDriver';
import type { VoicePermission } from '@/features/safety/utils/voiceCheckIn';
import { AlertDevMenu } from '@/features/alerts/components/AlertDevMenu';
import { useProfile } from '@/features/profile/providers/ProfileDataProvider';
import { LanguageSetting } from '../components/LanguageSetting';
import { ChoiceRow, PermissionRow, SettingsGroup, ToggleRow } from '../components/SettingsControls';
import { useSettings } from '../hooks/useSettings';
import { usePrivacyActions } from '../hooks/usePrivacyActions';
import { settingsService } from '../settingsService';
import type { SettingsPatch } from '../types/settings.types';
import { distanceValue } from '../utils/units';

export function SettingsScreen() {
  const { t } = useTranslation(); const { settings, ready, saving, error, accountSync, consentOwner } = useSettings();
  const location = useLocationState(); const alerts = useAlertState(); const checkIn = useCheckInState();
  const locationService = useLocationService(); const alertService = useAlertService();
  const { online } = useOfflineStatus(); const profile = useProfile(); const privacy = usePrivacyActions();
  const { state: escalation } = useEscalation();
  const [deleting, setDeleting] = useState<'data' | 'account' | null>(null); const [confirmation, setConfirmation] = useState('');
  const [systemError, setSystemError] = useState(false);
  const [voiceAvailable] = useState(isVoiceAvailable);
  const [microphone, setMicrophone] = useState<VoicePermission | null>(null);
  const [requestingMicrophone, setRequestingMicrophone] = useState(false);
  useEffect(() => subscribeToForeground((active) => { if (active) void voiceDriver.getPermission().then(setMicrophone); }), []);
  const disabled = !ready || saving;
  const consentDisabled = disabled || !profile.cache || consentOwner !== profile.cache.bundle.profile.id;
  const update = (patch: SettingsPatch) => { void settingsService.update(patch).catch(() => undefined); };
  const activeEmergency = checkIn.status === 'waiting' || checkIn.status === 'escalated'
    || ['sending', 'sent', 'waitingForSignal'].includes(escalation.status);
  const choices = <T extends string | number,>(values: readonly T[], labels: (value: T) => string) => values.map((value) => ({ value, label: labels(value) }));
  const permission = (value: string) => t('preferences.permissionValue', { value: t(`preferences.permission.${value}`, { defaultValue: t('preferences.permission.unavailable') }) });
  const voiceLanguage = settings.voiceLanguage === 'app' ? getLanguage() : settings.voiceLanguage;
  const requestMicrophone = async () => {
    setRequestingMicrophone(true);
    await voiceDriver.requestPermission();
    setMicrophone(await voiceDriver.getPermission()); setRequestingMicrophone(false);
  };
  const hasLocation = location.location === 'granted' || location.location === 'limited';
  // Motion is asked for with location, and background location only after it.
  const permissions = [
    { key: 'foreground', status: location.location, requesting: location.requesting, request: locationService.requestPermission },
    { key: 'motion', status: location.motion, requesting: location.requesting, request: hasLocation ? locationService.requestPermission : undefined },
    { key: 'background', status: location.background, requesting: location.requesting, request: hasLocation ? locationService.requestBackgroundPermission : undefined },
    { key: 'notifications', status: alerts.permission, requesting: alerts.requesting, request: alertService.requestPermission },
    { key: 'microphone', status: microphone, requesting: requestingMicrophone, request: requestMicrophone },
  ] as const;
  return <AccountPage title={t('settings.title')} description={t('preferences.description')}>
    <ThemedText type="label" themeColor={error ? 'errorText' : 'textSecondary'} accessibilityLiveRegion="polite">
      {t(!ready ? 'loading.content' : error ? 'preferences.saveError' : saving ? 'preferences.saving' : 'preferences.saved')}
    </ThemedText>
    <SettingsGroup title={t('preferences.alerts')} description={t('preferences.alertsHint')}>
      {profile.cache && accountSync !== 'synced' ? <ThemedText type="small" themeColor="textSecondary">{t('preferences.accountPending')}</ThemedText> : null}
      {(['crash_detected', 'potential_accident', 'accident_nearby'] as const).map((type) => <ToggleRow key={type}
        label={t(`alerts.${type}.title`)} value={settings.notifications[type]} disabled={disabled}
        onChange={(value) => update({ notifications: { [type]: value } })} />)}
      <ChoiceRow label={t('preferences.radius')} value={settings.nearbyRadiusKm} disabled={disabled}
        options={choices([1, 5, 10, 25, 50], (value) => t('preferences.radiusValue', {
          value: formatNumber(getLanguage(), distanceValue(value * 1000, settings.units), { maximumFractionDigits: 1 }), unit: t(settings.units === 'mph' ? 'preferences.miles' : 'preferences.kilometers'),
        }))} onChange={(nearbyRadiusKm) => update({ nearbyRadiusKm })} />
    </SettingsGroup>
    <SettingsGroup title={t('preferences.detection')} description={t('preferences.detectionHint')}>
      <ToggleRow label={t('preferences.crashDetection')} value={settings.crashDetection} disabled={disabled} onChange={(crashDetection) => update({ crashDetection })} />
      <ChoiceRow label={t('preferences.sensitivity')} value={settings.sensitivity} disabled={disabled}
        options={choices(['low', 'standard', 'high'] as const, (value) => t(`preferences.${value}`))} onChange={(sensitivity) => update({ sensitivity })} />
      <ChoiceRow label={t('preferences.countdown')} value={settings.countdownSeconds} disabled={disabled}
        options={choices([60, 120, 180] as const, (value) => t('preferences.seconds', { value }))} onChange={(countdownSeconds) => update({ countdownSeconds })} />
      <ThemedText type="small" themeColor="textSecondary">{t('preferences.countdownHint')}</ThemedText>
    </SettingsGroup>
    <SettingsGroup title={t('preferences.voice')}>
      <ToggleRow label={t('preferences.voiceEnabled')} value={settings.voice} disabled={disabled || (!voiceAvailable && !settings.voice)} onChange={(voice) => update({ voice })} />
      {!voiceAvailable ? <ThemedText themeColor="textSecondary">{t('preferences.voiceUnavailable')}</ThemedText> : null}
      <ChoiceRow label={t('preferences.voiceLanguage')} value={settings.voiceLanguage} disabled={disabled}
        options={choices(['app', 'en', 'fr', 'ar'] as const, (value) => t(`preferences.language.${value}`))} onChange={(voiceLanguage) => update({ voiceLanguage })} />
      <Button label={t('preferences.testVoice')} variant="secondary" disabled={!settings.voice || !voiceAvailable}
        onPress={() => { void speakGuidance(t('preferences.voiceSample', { lng: voiceLanguage }), voiceLanguage); }} />
    </SettingsGroup>
    <LanguageSetting />
    <SettingsGroup title={t('preferences.display')}>
      <ChoiceRow label={t('preferences.units')} value={settings.units} disabled={disabled}
        options={choices(['kmh', 'mph'] as const, (value) => t(value === 'kmh' ? 'units.kmh' : 'preferences.mph'))} onChange={(units) => update({ units })} />
      <ChoiceRow label={t('preferences.theme')} value={settings.theme} disabled={disabled}
        options={choices(['system', 'light', 'dark'] as const, (value) => t(`preferences.${value}`))} onChange={(theme) => update({ theme })} />
    </SettingsGroup>
    <SettingsGroup title={t('preferences.permissions')}>
      {permissions.map(({ key, status, requesting, request }) => <PermissionRow key={key} label={t(`preferences.${key}`)}
        status={status === null ? '—' : permission(status)} requesting={requesting}
        onRequest={status === 'undetermined' && request ? () => { void request(); } : undefined} />)}
      {canOpenSystemSettings ? <Button label={t('common.openSettings')} variant="secondary"
        onPress={() => { void openSystemSettings().catch(() => setSystemError(true)); }} />
        : <ThemedText themeColor="textSecondary">{t('preferences.browserPermissions')}</ThemedText>}
      {systemError ? <ThemedText themeColor="errorText">{t('preferences.systemError')}</ThemedText> : null}
    </SettingsGroup>
    <SettingsGroup title={t('preferences.privacy')}>
      <ToggleRow label={t('preferences.dataSharing')} detail={t('preferences.dataSharingHint')} value={settings.dataSharing} disabled={consentDisabled} onChange={(dataSharing) => update({ dataSharing })} />
      <ToggleRow label={t('preferences.medicalSharing')} detail={t('preferences.medicalSharingHint')} value={settings.shareMedicalInfo} disabled={consentDisabled} onChange={(shareMedicalInfo) => update({ shareMedicalInfo })} />
      <ThemedText type="small" themeColor="textSecondary">{t('preferences.deleteHint')}</ThemedText>
      {activeEmergency ? <ThemedText themeColor="errorText">{t('preferences.emergencyActive')}</ThemedText> : null}
      {!deleting ? <>
        <Button variant="secondary" label={t('preferences.deleteData')} disabled={activeEmergency || !profile.cache} onPress={() => setDeleting('data')} />
        <Button variant="logout" label={t('preferences.deleteAccount')} disabled={activeEmergency || !profile.cache} onPress={() => setDeleting('account')} />
      </> : <>
        <Input label={t('preferences.confirmation')} value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} />
        <Button variant="destructive" label={t('preferences.confirmDelete')} loading={privacy.busy}
          disabled={confirmation !== 'DELETE' || online !== true || activeEmergency || profile.syncing}
          onPress={() => { void privacy.erase(deleting === 'account').then((done) => { if (done) { setDeleting(null); setConfirmation(''); } }); }} />
        <Button variant="text" label={t('preferences.cancel')} disabled={privacy.busy} onPress={() => { setDeleting(null); setConfirmation(''); }} />
      </>}
      {online !== true ? <ThemedText type="small" themeColor="textSecondary">{t('preferences.deleteOnline')}</ThemedText> : null}
      {privacy.failed ? <ThemedText themeColor="errorText" accessibilityRole="alert">{t('preferences.deleteError')}</ThemedText> : null}
    </SettingsGroup>
    <SettingsGroup title={t('preferences.about')}>
      <ThemedText>{appInfo.name}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('preferences.version', { value: appInfo.version })}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t('preferences.sdk', { value: appInfo.sdk })}</ThemedText>
      <Link href="/profile/licenses" asChild><Button variant="text" label={t('preferences.licenses')} /></Link>
    </SettingsGroup>
    {__DEV__ ? <AlertDevMenu /> : null}
  </AccountPage>;
}
