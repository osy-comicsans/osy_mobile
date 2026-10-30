import { useStore } from 'zustand';

import { accountService } from '../authServices';

export function useAccount() {
  return useStore(accountService.store);
}
