import { useEffect, useState } from 'react';

import { subscribeToConnectivity } from '@/common/lib/network/connectivity';

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => subscribeToConnectivity(setOnline), []);
  return online;
}
