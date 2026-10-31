import { createContext } from 'react';

import type { RoadRisk } from '../types/roadRisk.types';

export const RoadRiskContext = createContext<RoadRisk | null>(null);
