import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { ContentSkeleton } from '@/common/components/ui/loading';
import { formatDateTime, formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Colors, Radius, Space } from '@/common/lib/theme';

import { useWeather } from '../hooks/useWeather';

export function WeatherWidget({ compact = false, glass = false }: { compact?: boolean; glass?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const showDetails = !compact || expanded;
  const weather = useWeather();
  const { t } = useTranslation();
  const language = getLanguage();
  const value = weather.snapshot;
  const number = (measurement: number | null | undefined, digits = 0) => measurement == null
    ? t('weather.unknown') : formatNumber(language, measurement, { maximumFractionDigits: digits });
  const time = (date: string | null | undefined) => date
    ? formatDateTime(language, new Date(date), { hour: '2-digit', minute: '2-digit', timeZone: value?.sun.timezone })
    : t('weather.unknown');
  const status = !weather.configured ? 'unconfigured' : weather.offline ? 'offline'
    : weather.awaitingLocation ? 'locationRequired' : 'unavailable';

  return (
    <Card glass={glass} style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="headingS">{t('weather.title')}</ThemedText>
        <Button label={t('weather.refresh')} variant="text" size="small"
          onPress={weather.refresh} loading={weather.refreshing}
          disabled={weather.offline || weather.awaitingLocation || !weather.configured} />
      </View>
      {weather.loading ? <ContentSkeleton label={t('weather.loading')} /> : !value ? (
        <ThemedText type="body" themeColor="textSecondary">{t(`weather.${status}`)}</ThemedText>
      ) : (
        <>
          <View style={styles.current}>
            <ThemedText type="display">{t('weather.celsius', { value: number(value.current.temperatureC, 1) })}</ThemedText>
            <ThemedText type="bodyMedium">{t(`weather.conditions.${value.current.condition}`)}</ThemedText>
          </View>
          <ThemedText type="label" themeColor="textSecondary">
            {t(weather.offline ? 'weather.offlineUpdated' : 'weather.updated', {
              value: formatDateTime(language, new Date(value.current.validAt), { dateStyle: 'short', timeStyle: 'short' }),
            })}
          </ThemedText>
          {weather.previousArea ? <ThemedText type="label" themeColor="textSecondary">{t('weather.previousArea')}</ThemedText> : null}
          {weather.freshness !== 'fresh' ? <ThemedText type="label" themeColor="textSecondary">{t('weather.stale')}</ThemedText> : null}
          <View style={styles.grid}>
            <Metric label={t('weather.precipitation')} value={t('weather.precipitationValue', {
              value: number(value.current.precipitationMm, 1),
              minutes: number(value.current.precipitationIntervalSeconds / 60),
            })} />
            <Metric label={t('weather.visibility')} value={t('weather.metres', { value: number(value.current.visibilityM) })} />
            <Metric label={t('weather.wind')} value={t('weather.windValue', { value: number(value.current.windSpeedMs, 1) })} />
            {showDetails ? <>
              <Metric label={t('weather.gusts')} value={t('weather.windValue', { value: number(value.current.windGustMs, 1) })} />
              <Metric label={t('weather.sunrise')} value={time(value.sun.sunriseAt)} />
              <Metric label={t('weather.sunset')} value={time(value.sun.sunsetAt)} />
            </> : null}
          </View>
          {showDetails ? <View style={styles.icing}>
            <ThemedText type="label">{t(weather.riskInputs?.icingRisk === 'possible' ? 'weather.icingPossible' : 'weather.icingUnknown')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{t('weather.icingEstimate')}</ThemedText>
          </View> : null}
          {showDetails && weather.hourly.length ? (
            <>
              <ThemedText type="label">{t('weather.nextHours')}</ThemedText>
              <View style={styles.forecast}>
                {weather.hourly.map((hour) => (
                  <View key={hour.validAt} style={styles.hour} accessible
                    accessibilityLabel={t('weather.hourSummary', {
                      time: time(hour.validAt), condition: t(`weather.conditions.${hour.condition}`),
                      temperature: number(hour.temperatureC, 1), rain: number(hour.precipitationMm, 1),
                    })}>
                    <ThemedText type="small">{time(hour.validAt)}</ThemedText>
                    <ThemedText type="bodyMedium">{t('weather.celsius', { value: number(hour.temperatureC, 1) })}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{t('weather.millimetres', { value: number(hour.precipitationMm, 1) })}</ThemedText>
                  </View>
                ))}
              </View>
            </>
          ) : null}
          {compact ? <Button variant="text" label={t(expanded ? 'dashboard.weather.less' : 'dashboard.weather.more')}
            accessibilityState={{ expanded }} onPress={() => setExpanded((current) => !current)} /> : null}
          {weather.error ? <ThemedText type="label" themeColor="textSecondary">{t('weather.refreshFailed')}</ThemedText> : null}
        </>
      )}
      <Link href="https://open-meteo.com/" asChild>
        <Button variant="text" size="small" label={t('weather.attribution')} />
      </Link>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}>
    <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
    <ThemedText type="bodyMedium">{value}</ThemedText>
  </View>;
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', gap: Space[4] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: Space[2] },
  current: { gap: Space[1] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[4] },
  metric: { flexBasis: '43%', flexGrow: 1, gap: Space[1] },
  icing: { backgroundColor: Colors.accentSoft, padding: Space[3], borderRadius: Radius.md, gap: Space[1] },
  forecast: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  hour: { flexGrow: 1, minWidth: 70, gap: Space[1], padding: Space[2], borderRadius: Radius.sm, backgroundColor: Colors.backgroundElement },
});
