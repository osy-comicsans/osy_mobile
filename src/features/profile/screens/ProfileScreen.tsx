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
import { useOfflineStatus } from '@/common/hooks/use-offline';
import { config } from '@/common/lib/config';
import { profilePhotos } from '@/common/lib/native/profilePhoto';
import { formatDateTime, formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Radius, Space } from '@/common/lib/theme';
import { authApi } from '@/features/auth/authServices';
import { endHomePreview } from '@/features/auth/utils/previewAccess';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { distanceValue } from '@/features/settings/utils/units';
import { SettingsGroup } from '@/features/settings/components/SettingsControls';
import { ProfileEditor } from '../components/ProfileEditor';
import { useProfile, useProfileService } from '../providers/ProfileDataProvider';

export function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme(); const { settings } = useSettings(); const { supported, online } = useOfflineStatus();
  const { cache, loading, syncing, error, authenticated } = useProfile(); const service = useProfileService();
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState(false);
  const bundle = cache?.bundle;
  const user = bundle?.profile;
  const photo = bundle?.pendingPhoto ? profilePhotos.uriOf(bundle.pendingPhoto) : user?.photoUrl;
  const numbers = (value: number) => formatNumber(getLanguage(), value, { maximumFractionDigits: 1 });

  // Ending the session moves the account to signed out, and the route guards go to Login.
  const logOut = () => {
    setSigningOut(true);
    endHomePreview();
    void authApi.signOut().catch(() => { setAuthError(true); setSigningOut(false); });
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
          <ThemedText type="small" themeColor="textSecondary">{t(config.useMockApi ? 'account.demo' : cache?.dirty ? 'account.pending' : 'account.synced')}</ThemedText>
        </View>
      </Card>
      <Link href="/profile/settings" asChild><Button label={t('profile.settings')} variant="secondary" size="large" /></Link>
      {loading ? <ContentSkeleton label={t('account.loading')} /> : null}
      {error ? <ThemedText themeColor="errorText" accessibilityRole="alert">{t('account.syncError')}</ThemedText> : null}
      {cache?.dirty ? <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">{t('account.pending')}</ThemedText> : null}
      {online !== true && cache ? <ThemedText type="small" themeColor="textSecondary">{t('account.offline')}</ThemedText> : null}
      {!supported ? <ThemedText type="small" themeColor="textSecondary">{t('account.webPreview')}</ThemedText> : null}
      {authError ? <ThemedText themeColor="errorText">{t('account.authError')}</ThemedText> : null}
      {!user && !loading && authenticated ? <SettingsGroup title={t('account.unavailable')} description={t('account.connectToLoad')}>
        <Button label={t('account.sync')} variant="secondary" loading={syncing} onPress={() => { void service.refresh(); }} />
      </SettingsGroup> : null}
      {!user && !loading && !authenticated ? <SettingsGroup title={t('account.signInTitle')} description={t('account.signInHint')}>
        {config.useMockApi && __DEV__ ? <Button label={t('account.openDemo')} loading={signingOut}
          onPress={() => { setSigningOut(true); void authApi.login({ email: 'demo@osy.test', password: 'preview' }).catch(() => setAuthError(true)).finally(() => setSigningOut(false)); }} /> : null}
        <Button label={t('auth.signIn')} variant="secondary" onPress={() => { endHomePreview(); router.replace('/login'); }} />
      </SettingsGroup> : null}
      {bundle ? <>
        <Button variant="text" label={t('account.sync')} loading={syncing} onPress={() => { void service.refresh(); }} />
        <Link href="/profile/emergency-contacts" asChild><Button label={t('profile.emergencyContacts')} variant="secondary" size="large" /></Link>
        <SettingsGroup title={t('account.stats')} description={t('account.statsHint')}>
          <View style={styles.stats}>
            {([
              ['trips', bundle.stats ? numbers(bundle.stats.trips) : '—'],
              ['distance', bundle.stats ? t('preferences.radiusValue', { value: numbers(distanceValue(bundle.stats.distanceMeters, settings.units)), unit: t(settings.units === 'mph' ? 'preferences.miles' : 'preferences.kilometers') }) : '—'],
              ['warnings', bundle.stats ? numbers(bundle.stats.warnings) : '—'],
            ] as const).map(([label, value]) => <View key={label} style={styles.stat}>
              <ThemedText type="heading" themeColor="accent">{value}</ThemedText>
              <ThemedText type="label" themeColor="textSecondary">{t(`account.${label}`)}</ThemedText>
            </View>)}
          </View>
          {!bundle.stats ? <ThemedText themeColor="textSecondary">{t('account.statsUnavailable')}</ThemedText> : null}
        </SettingsGroup>
        <ProfileEditor key={bundle.profile.id} bundle={bundle} />
        <SettingsGroup title={t('account.reports')}>
          {!bundle.historyAvailable ? <ThemedText themeColor="textSecondary">{t('account.reportsUnavailable')}</ThemedText>
            : bundle.reports.length === 0 ? <ThemedText themeColor="textSecondary">{t('account.noReports')}</ThemedText> : null}
          {bundle.reports.map((report) => <View key={report.id} style={[styles.report, { borderColor: theme.border }]}>
            <ThemedText type="bodyMedium">{t(`report.type.${report.type}`, { defaultValue: t('report.type.other') })}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{formatDateTime(getLanguage(), new Date(report.occurredAt))}</ThemedText>
            <ThemedText type="label" themeColor="accent">{t(`account.reportStatus.${report.status}`)}</ThemedText>
          </View>)}
        </SettingsGroup>
      </> : null}
      {authenticated ? <Button label={t('profile.logout')} variant="logout" loading={signingOut} onPress={logOut} /> : null}
    </AccountPage>
  );
}

const styles = StyleSheet.create({ hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[4] },
  avatar: { width: 80, height: 80, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' }, identity: { flex: 1, minWidth: 150, gap: Space[1] },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[4] }, stat: { flex: 1, minWidth: 90, gap: Space[1] },
  report: { gap: Space[1], paddingVertical: Space[3], borderBottomWidth: StyleSheet.hairlineWidth } });
