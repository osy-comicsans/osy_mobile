import { Link, router, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Icon, type IconName } from '@/common/components/ui/icon';
import { ContentSkeleton } from '@/common/components/ui/loading';
import { ScreenHero } from '@/common/components/ui/screen-hero';
import { ThemedText } from '@/common/components/themed-text';
import { useTheme } from '@/common/hooks/use-theme';
import { useOfflineRuntime, useOfflineStatus } from '@/common/hooks/use-offline';
import { authSession } from '@/common/lib/api/axios';
import { config } from '@/common/lib/config';
import { profilePhotos } from '@/common/lib/native/profilePhoto';
import { formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { MaxContentWidth, Palette, Radius, Space } from '@/common/lib/theme';
import { authApi } from '@/features/auth/authServices';
import { endHomePreview } from '@/features/auth/utils/previewAccess';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { distanceValue } from '@/features/settings/utils/units';
import { SettingsGroup } from '@/features/settings/components/SettingsControls';
import { ReportHistory } from '../components/ReportHistory';
import { VehicleCard } from '../components/VehicleCard';
import { useWaitingTrips } from '../hooks/useProfileCache';
import { useVehicle } from '../hooks/useVehicle';
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
  const insets = useSafeAreaInsets();
  const bundle = cache?.bundle;
  const user = bundle?.profile;
  const vehicle = useVehicle(user);
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
    <ScrollView contentInsetAdjustmentBehavior="never" style={{ backgroundColor: theme.background }} contentContainerStyle={{ paddingBottom: insets.bottom + Space[8] }}>
      <ScreenHero>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            {photo ? <Image source={{ uri: photo }} cachePolicy="memory-disk" style={styles.photo} contentFit="cover" accessibilityLabel={t('account.photo')} />
              : <ThemedText type="heading" themeColor="accent">{user ? `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}` : '—'}</ThemedText>}
          </View>
          <View style={styles.names}>
            <ThemedText type="heading" accessibilityRole="header" style={styles.name}>{user ? `${user.firstName} ${user.lastName}` : t('account.guest')}</ThemedText>
            {user ? <ThemedText type="label" style={styles.email}>{user.email}</ThemedText> : null}
          </View>
        </View>
      </ScreenHero>
      <View style={styles.scroll}>
        <View style={styles.content}>
          {loading ? <ContentSkeleton label={t('account.loading')} /> : null}
          {error ? <ThemedText themeColor="errorText" accessibilityRole="alert">{t('account.syncError')}</ThemedText> : null}
          {authError ? <ThemedText themeColor="errorText">{t('account.authError')}</ThemedText> : null}
          {online !== true && cache ? <ThemedText type="small" themeColor="textSecondary">{t('account.offline')}</ThemedText> : null}
          {!supported ? <ThemedText type="small" themeColor="textSecondary">{t('account.webPreview')}</ThemedText> : null}

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
            <VehicleCard vehicle={vehicle} />

            <Card tone="accentSoft" style={styles.stats}>
              {([
                ['trips', stats ? numbers(stats.trips) : '—'],
                ['distance', stats ? t('preferences.radiusValue', { value: numbers(distanceValue(stats.distanceMeters, settings.units)), unit: t(settings.units === 'mph' ? 'preferences.miles' : 'preferences.kilometers') }) : '—'],
                ['warnings', stats ? numbers(stats.warnings) : '—'],
              ] as const).map(([label, value]) => <View key={label} accessible style={styles.stat}>
                <ThemedText type="headingS">{value}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{t(`account.${label}`)}</ThemedText>
              </View>)}
            </Card>
            {!stats ? <ThemedText type="small" themeColor="textSecondary">{t('account.statsUnavailable')}</ThemedText> : null}

            <ThemedText type="overline" themeColor="textTertiary" style={styles.section}>{t('account.manage')}</ThemedText>
            <Card padded={false}>
              <MenuRow href="/profile/edit" icon="edit" label={t('account.editDetails')} />
              <MenuRow href="/profile/emergency-contacts" icon="people" label={t('profile.emergencyContacts')} />
              <MenuRow href="/profile/settings" icon="settings" label={t('profile.settings')} />
            </Card>

            <ReportHistory bundle={bundle} />

            <View style={styles.footer}>
              <Button variant="text" size="small" label={t('account.sync')} loading={syncing} onPress={() => { void service.retry(); }} />
              <ThemedText type="small" themeColor={rejection ? 'errorText' : 'textTertiary'} accessibilityLiveRegion="polite">
                {t(rejection ? 'account.attentionTitle' : cache?.dirty ? 'account.pending' : config.useMockApi ? 'account.demo' : 'account.synced')}
              </ThemedText>
            </View>
          </> : null}
          {authenticated && !confirmingSignOut ? <Button label={t('profile.logout')} variant="logout" onPress={() => setConfirmingSignOut(true)} /> : null}
          {authenticated && confirmingSignOut ? <SettingsGroup title={t('account.signOutTitle')} description={t(cache?.dirty ? 'account.signOutUnsynced' : 'account.signOutHint')}>
            <Button label={t('profile.logout')} variant="logout" loading={signingOut} onPress={() => { void logOut(); }} />
            <Button label={t('preferences.cancel')} variant="text" disabled={signingOut} onPress={() => setConfirmingSignOut(false)} />
          </SettingsGroup> : null}
        </View>
      </View>
    </ScrollView>
  );
}

function MenuRow({ href, icon, label }: { href: Href; icon: IconName; label: string }) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={StyleSheet.flatten([styles.row, { borderBottomColor: theme.border }])}>
        <Icon name={icon} size={20} color={theme.accent} />
        <ThemedText type="bodyMedium" style={styles.rowLabel}>{label}</ThemedText>
        <Icon name="forward" size={14} color={theme.textTertiary} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Space[4], alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, gap: Space[4] },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Space[3], paddingTop: Space[2] },
  avatar: { width: 56, height: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: Palette.purple[100] },
  name: { color: Palette.white },
  email: { color: Palette.purple[100] },
  photo: { width: '100%', height: '100%' },
  names: { flex: 1, gap: Space[1] },
  stats: { flexDirection: 'row', padding: Space[4] },
  stat: { flex: 1, gap: Space[1] },
  section: { marginTop: Space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space[3], minHeight: 56, paddingHorizontal: Space[4], borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { flex: 1 },
  footer: { alignItems: 'center', gap: Space[1] },
});
