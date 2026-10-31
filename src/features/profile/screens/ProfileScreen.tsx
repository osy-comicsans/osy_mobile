import { Link, router } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { AccountPage } from '@/common/components/ui/account-page';
import { ContentSkeleton } from '@/common/components/ui/loading';
import { ThemedText } from '@/common/components/themed-text';
import { useTheme } from '@/common/hooks/use-theme';
import { useOfflineRuntime, useOfflineStatus } from '@/common/hooks/use-offline';
import { authSession } from '@/common/lib/api/axios';
import { config } from '@/common/lib/config';
import { profilePhotos } from '@/common/lib/native/profilePhoto';
import { formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Radius, Space } from '@/common/lib/theme';
import { authApi } from '@/features/auth/authServices';
import { endHomePreview } from '@/features/auth/utils/previewAccess';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { distanceValue } from '@/features/settings/utils/units';
import { SettingsGroup } from '@/features/settings/components/SettingsControls';
import { ProfileEditor } from '../components/ProfileEditor';
import { ReportHistory } from '../components/ReportHistory';
import { useWaitingTrips } from '../hooks/useProfileCache';
import { useProfile, useProfileService } from '../providers/ProfileDataProvider';
import { rejectedFieldLabels, rejectedFields } from '../utils/profileService';

export function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme(); const { settings } = useSettings(); const { supported, online } = useOfflineStatus();
  const { cache, loading, syncing, error, authenticated, rejection } = useProfile(); const service = useProfileService();
  const runtime = useOfflineRuntime();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [discardFailed, setDiscardFailed] = useState(false);
  const bundle = cache?.bundle;
  const user = bundle?.profile;
  const photo = (bundle?.pendingPhoto && profilePhotos.uriOf(bundle.pendingPhoto)) || user?.photoUrl;
  const numbers = (value: number) => formatNumber(getLanguage(), value, { maximumFractionDigits: 1 });
  const rejected = rejectedFields(rejection);
  const { data: waiting } = useWaitingTrips(user?.id ?? null);
  // Uploaded trips are in the server totals and leave the queue, so none is counted twice.
  const stats = bundle?.stats && {
    trips: bundle.stats.trips + (waiting?.trips ?? 0),
    distanceMeters: bundle.stats.distanceMeters + (waiting?.distanceMeters ?? 0),
    warnings: bundle.stats.warnings + (waiting?.warnings ?? 0),
  };

  // Ending the session moves the account to signed out, and the route guards go to Login.
  // The session ends in memory even if the keychain fails, so the account's data goes regardless:
  // medical details, contacts and trips must not stay on the phone.
  const logOut = async () => {
    const userId = authSession.status.getState().userId;
    setSigningOut(true);
    endHomePreview();
    await authApi.signOut().catch(() => setAuthError(true));
    if (userId) await Promise.all([service.forget(userId), supported ? runtime.trips.discard(userId) : undefined]).catch(() => setAuthError(true));
    setSigningOut(false);
  };

  const discard = () => {
    setDiscardFailed(false);
    void service.discard().catch(() => setDiscardFailed(true));
  };

  return (
    <AccountPage title={t('profile.title')} description={t('account.description')}>
      <Card glass tone="accentSoft" style={styles.hero}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
          {photo ? <Image source={{ uri: photo }} cachePolicy="memory-disk" style={styles.photo} contentFit="cover" accessibilityLabel={t('account.photo')} />
            : <ThemedText type="display" themeColor="accent">{user ? `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}` : '—'}</ThemedText>}
        </View>
        <View style={styles.identity}>
          <ThemedText type="heading">{user ? `${user.firstName} ${user.lastName}` : t('account.guest')}</ThemedText>
          {user ? <ThemedText type="label" themeColor="textSecondary">{user.email}</ThemedText> : null}
          {user?.vehicle ? <ThemedText type="small" themeColor="textSecondary">{user.vehicle}</ThemedText> : null}
          {config.useMockApi ? <ThemedText type="small" themeColor="textSecondary">{t('account.demo')}</ThemedText> : null}
          {cache ? <ThemedText type="small" themeColor={rejection ? 'errorText' : 'textSecondary'} accessibilityLiveRegion="polite">
            {t(rejection ? 'account.attentionTitle' : cache.dirty ? 'account.pending' : 'account.synced')}
          </ThemedText> : null}
        </View>
      </Card>
      <Link href="/profile/settings" asChild><Button label={t('profile.settings')} variant="secondary" size="large" /></Link>
      {loading ? <ContentSkeleton label={t('account.loading')} /> : null}
      {error ? <ThemedText themeColor="errorText" accessibilityRole="alert">{t('account.syncError')}</ThemedText> : null}
      {online !== true && cache ? <ThemedText type="small" themeColor="textSecondary">{t('account.offline')}</ThemedText> : null}
      {!supported ? <ThemedText type="small" themeColor="textSecondary">{t('account.webPreview')}</ThemedText> : null}
      {authError ? <ThemedText themeColor="errorText">{t('account.authError')}</ThemedText> : null}
      {rejection ? <SettingsGroup title={t('account.attentionTitle')} description={t('account.attentionHint')}>
        <View accessibilityRole="alert">
          {rejected.length > 0 ? rejected.map((field) => <ThemedText key={field} themeColor="errorText">
            {t(rejection.kind === 'conflict' ? 'account.fieldTaken' : 'account.fieldRejected', { field: t(rejectedFieldLabels[field]) })}
          </ThemedText>) : <ThemedText themeColor="errorText">{t(`errors.api.${rejection.kind}`)}</ThemedText>}
        </View>
        {discardFailed ? <ThemedText themeColor="errorText">{t('account.authError')}</ThemedText> : null}
        <Button label={t('common.tryAgain')} variant="secondary" loading={syncing} disabled={online !== true} onPress={() => { void service.retry(); }} />
        <Button label={t('account.discard')} variant="text" disabled={online !== true || syncing} onPress={discard} />
      </SettingsGroup> : null}
      {!user && !loading && authenticated ? <SettingsGroup title={t('account.unavailable')} description={t('account.connectToLoad')}>
        <Button label={t('account.sync')} variant="secondary" loading={syncing} onPress={() => { void service.refresh(); }} />
      </SettingsGroup> : null}
      {!user && !loading && !authenticated ? <SettingsGroup title={t('account.signInTitle')} description={t('account.signInHint')}>
        {config.useMockApi && __DEV__ ? <Button label={t('account.openDemo')} loading={signingOut}
          onPress={() => { setSigningOut(true); void authApi.login({ email: 'demo@osy.test', password: 'preview' }).catch(() => setAuthError(true)).finally(() => setSigningOut(false)); }} /> : null}
        <Button label={t('auth.signIn')} variant="secondary" onPress={() => { endHomePreview(); router.replace('/login'); }} />
      </SettingsGroup> : null}
      {bundle ? <>
        <Button variant="text" label={t('account.sync')} loading={syncing} onPress={() => { void service.retry(); }} />
        <Link href="/profile/emergency-contacts" asChild><Button label={t('profile.emergencyContacts')} variant="secondary" size="large" /></Link>
        <SettingsGroup title={t('account.stats')} description={t('account.statsHint')}>
          <View style={styles.stats}>
            {([
              ['trips', stats ? numbers(stats.trips) : '—'],
              ['distance', stats ? t('preferences.radiusValue', { value: numbers(distanceValue(stats.distanceMeters, settings.units)), unit: t(settings.units === 'mph' ? 'preferences.miles' : 'preferences.kilometers') }) : '—'],
              ['warnings', stats ? numbers(stats.warnings) : '—'],
            ] as const).map(([label, value]) => <View key={label} style={styles.stat}>
              <ThemedText type="heading" themeColor="accent">{value}</ThemedText>
              <ThemedText type="label" themeColor="textSecondary">{t(`account.${label}`)}</ThemedText>
            </View>)}
          </View>
          {!stats ? <ThemedText themeColor="textSecondary">{t('account.statsUnavailable')}</ThemedText> : null}
        </SettingsGroup>
        <ProfileEditor key={bundle.profile.id} bundle={bundle} rejection={rejection} />
        <ReportHistory bundle={bundle} />
      </> : null}
      {authenticated && !confirmingSignOut ? <Button label={t('profile.logout')} variant="logout" onPress={() => setConfirmingSignOut(true)} /> : null}
      {authenticated && confirmingSignOut ? <SettingsGroup title={t('account.signOutTitle')} description={t(cache?.dirty ? 'account.signOutUnsynced' : 'account.signOutHint')}>
        <Button label={t('profile.logout')} variant="logout" loading={signingOut} onPress={() => { void logOut(); }} />
        <Button label={t('preferences.cancel')} variant="text" disabled={signingOut} onPress={() => setConfirmingSignOut(false)} />
      </SettingsGroup> : null}
    </AccountPage>
  );
}

const styles = StyleSheet.create({ hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[4] },
  avatar: { width: 80, height: 80, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' }, identity: { flex: 1, minWidth: 150, gap: Space[1] },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[4] }, stat: { flex: 1, minWidth: 90, gap: Space[1] } });
