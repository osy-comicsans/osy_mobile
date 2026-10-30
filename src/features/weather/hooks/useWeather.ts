import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { useOfflineRuntime, useOfflineStatus } from '@/common/hooks/use-offline';
import { useCurrentLocation, useLocationState } from '@/features/location/hooks/useLocation';

import { getWeather, weatherConfigured } from '../weatherServices';
import type { WeatherSnapshot } from '../types/weather.types';
import { nextWeatherHours, weatherArea, weatherFreshness, weatherPolicy } from '../utils/weatherPolicy';
import { toWeatherRiskInputs } from '../utils/weatherRiskInputs';

export function useWeather() {
  const runtime = useOfflineRuntime();
  const { supported, ready, online, foreground } = useOfflineStatus();
  const fix = useCurrentLocation();
  const { location: permission } = useLocationState();
  const client = useQueryClient();
  const [now, setNow] = useState(Date.now);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const usableFix = fix && (permission === 'granted' || permission === 'limited')
    && now - fix.timestamp <= weatherPolicy.locationMaxAgeMs && fix.timestamp <= now + 300_000;
  const area = usableFix ? weatherArea(fix.latitude, fix.longitude) : null;
  const key = area?.id ?? 'last-known';
  const queryKey = useMemo(() => ['weather', key] as const, [key]);

  useEffect(() => {
    if (!foreground) return;
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [foreground]);

  useEffect(() => {
    if (!supported || !ready) return;
    let active = true;
    // Disk hydration has its own lifecycle and never waits for connectivity.
    void runtime.weather.read(key === 'last-known' ? undefined : key).then((saved) => {
      if (!active || !saved) return;
      const current = client.getQueryData<WeatherSnapshot>(queryKey);
      if (!current || Date.parse(saved.fetchedAt) > Date.parse(current.fetchedAt)) {
        client.setQueryData(queryKey, saved, { updatedAt: Date.parse(saved.fetchedAt) });
      }
    }).catch(() => undefined).finally(() => { if (active) setHydratedKey(key); });
    return () => { active = false; };
  }, [client, key, queryKey, ready, runtime, supported]);

  const query = useQuery({
    queryKey,
    enabled: Boolean(area && weatherConfigured && online !== false && foreground
      && (!supported || hydratedKey === key)),
    queryFn: async ({ signal }) => {
      if (!area || !fix || Date.now() - fix.timestamp > weatherPolicy.locationMaxAgeMs) {
        throw new Error('Weather requires a recent location.');
      }
      const value = await getWeather(area, signal);
      if (supported) await runtime.weather.save(value);
      return value;
    },
    staleTime: (entry) => entry.state.data
      ? Math.max(0, Date.parse(entry.state.data.freshUntil) - entry.state.dataUpdatedAt) : 0,
    gcTime: weatherPolicy.retentionMs,
    refetchInterval: weatherPolicy.refreshMs,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const snapshot = query.data;
  const matchingArea = Boolean(area && snapshot?.area.id === area.id);
  return {
    snapshot,
    hourly: snapshot ? nextWeatherHours(snapshot, now) : [],
    riskInputs: snapshot ? toWeatherRiskInputs(snapshot, matchingArea, now) : null,
    freshness: snapshot ? weatherFreshness(snapshot, now) : null,
    previousArea: Boolean(snapshot && !matchingArea),
    offline: online === false,
    configured: weatherConfigured,
    awaitingLocation: !area,
    loading: !snapshot && (query.isFetching || (supported && ready && hydratedKey !== key)),
    refreshing: query.isFetching,
    error: query.isError,
    refresh: () => { if (area && weatherConfigured && online !== false && foreground) void query.refetch(); },
  };
}

export type WeatherController = ReturnType<typeof useWeather>;
