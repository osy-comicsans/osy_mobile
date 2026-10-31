import { useStore } from 'zustand';
import { settingsService } from '../settingsService';
export const useSettings = () => useStore(settingsService.store);
