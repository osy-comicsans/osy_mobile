import { useEffect, useState } from 'react';

import { subscribeToForeground } from '@/common/lib/native/appLifecycle';

// Freshness changes even when GPS stops delivering fixes. No background timer.
export function useLiveClock(intervalMs = 5_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const unsubscribe = subscribeToForeground((active) => {
      clearInterval(timer);
      if (active) {
        setNow(Date.now());
        timer = setInterval(() => setNow(Date.now()), intervalMs);
      }
    });
    return () => { clearInterval(timer); unsubscribe(); };
  }, [intervalMs]);
  return now;
}
