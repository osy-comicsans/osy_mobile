import { preferenceStorage } from '@/common/lib/storage/preferenceStorage';
import { createSettingsService } from './utils/settingsService';

export const settingsService = createSettingsService(preferenceStorage);
