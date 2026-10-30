import { createContext } from 'react';

import type { AlertService } from '../utils/alertService';

export const AlertContext = createContext<AlertService | null>(null);
