import { createContext, useContext, useState, type PropsWithChildren } from 'react';

import { PlaygroundRegistry } from '../utils/PlaygroundRegistry';

const PlaygroundContext = createContext<PlaygroundRegistry | null>(null);

export function PlaygroundProvider({ children }: PropsWithChildren) {
  const [registry] = useState(() => new PlaygroundRegistry());
  return <PlaygroundContext value={registry}>{children}</PlaygroundContext>;
}

export function usePlaygroundRegistry() {
  const registry = useContext(PlaygroundContext);
  if (!registry) throw new Error('Playground tests must be inside PlaygroundProvider.');
  return registry;
}
