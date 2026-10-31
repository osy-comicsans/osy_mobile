import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { nativeGlassView, subscribeReducedTransparency } from '@/common/lib/native/glass';

const GlassContext = createContext<{
  reduced: boolean;
  NativeGlass: ReturnType<typeof nativeGlassView>;
}>({ reduced: true, NativeGlass: null });

export function GlassAppearanceProvider({ children }: PropsWithChildren) {
  const [NativeGlass] = useState(nativeGlassView);
  const [reduced, setReduced] = useState(true);
  useEffect(() => subscribeReducedTransparency(setReduced), []);
  return <GlassContext value={{ reduced, NativeGlass }}>{children}</GlassContext>;
}

export const useGlassAppearance = () => useContext(GlassContext);
