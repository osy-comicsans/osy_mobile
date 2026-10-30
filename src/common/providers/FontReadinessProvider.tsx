import { createContext, useContext, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

const FontReadinessContext = createContext(true);
const fallback = { fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' }) };

export function FontReadinessProvider({ ready, children }: PropsWithChildren<{ ready: boolean }>) {
  return <FontReadinessContext value={ready}>{children}</FontReadinessContext>;
}

export function useFontFallback() {
  return useContext(FontReadinessContext) ? undefined : fallback;
}
