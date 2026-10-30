import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import type { SensorDriver, SensorId } from '../types/sensor.types';
import { SensorSession } from '../utils/SensorSession';
import { usePlaygroundRegistry } from './PlaygroundProvider';

export function useSensorSession<T>(id: SensorId, driver: SensorDriver<T>) {
  const [session] = useState(() => new SensorSession(driver));
  const registry = usePlaygroundRegistry();
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);

  useEffect(() => {
    const unregister = registry.register(id, session.stop);
    const update = () => registry.update(id, session.getSnapshot().phase);
    update();
    const unsubscribe = session.subscribe(update);
    return () => { unsubscribe(); session.setActive(false); unregister(); };
  }, [id, registry, session]);

  useFocusEffect(useCallback(() => {
    session.setActive(AppState.currentState !== 'background');
    const subscription = AppState.addEventListener('change', (state) => {
      // iOS permission sheets can briefly mark the app inactive. Do not cancel
      // the permission request itself; a real background transition stops it.
      if (state === 'background') session.setActive(false);
      else if (state === 'active') session.setActive(true);
    });
    return () => { session.setActive(false); subscription.remove(); };
  }, [session]));

  return { ...snapshot, start: session.start, stop: session.stop, refresh: session.refresh, session };
}
