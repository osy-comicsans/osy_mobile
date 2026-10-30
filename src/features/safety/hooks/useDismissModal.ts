import { router } from 'expo-router';

// A modal opened from a cold deep link on web has nothing to go back to.
export function useDismissModal() {
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
}
