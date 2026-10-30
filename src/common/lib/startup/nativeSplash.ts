import * as SplashScreen from 'expo-splash-screen';

// Global scope is essential: a component effect can run after auto-hide.
try { void SplashScreen.preventAutoHideAsync().catch(() => undefined); } catch { /* Web or an already-released native splash. */ }

export function hideNativeSplash(): void {
  try {
    // One shared JS fade is used on both platforms, avoiding an iOS-only
    // native fade followed by a second overlay animation.
    SplashScreen.setOptions({ duration: 0, fade: false });
    SplashScreen.hide();
  } catch {
    // A native handoff failure must not keep the JS overlay or emergency UI.
    try { void SplashScreen.hideAsync().catch(() => undefined); } catch { /* Native view may already be gone. */ }
  }
}
