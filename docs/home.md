# Home dashboard

Home composes the existing shared location, road, weather, crash-detection, and alert services. It follows `INTEGRATION_EXPO_SDK57.md`; this checkout currently runs Expo SDK 58. Presentation belongs in `features/home/`, orchestration in hooks/services, Expo calls in `common/lib/native/`, preferences in `common/lib/storage/`, and SQL in repositories. No additional dependency is needed.

## Appearance

Cards use the shared OSY purple, lavender, charcoal, spacing, Gabarito/Arabic typography, and pill buttons. `Card glass` adds the reusable glass surface through `GlassAppearanceProvider`. Supported iOS devices use guarded `expo-glass-effect`; Android and older iOS use translucent frosted colors, and web adds CSS backdrop blur. Reduce Transparency or increased web contrast selects solid surfaces. Emergency routes retain their existing presentation.

## Live information

- Speed and heading come from the single foreground location store. A real zero remains zero; missing, denied, or older-than-30-second speed is unknown. Permission and service failures leave the rest of Home accessible.
- Road name and refs reuse OSRM matching while driving. Paused or stopped matching marks the retained road stale. This change does not add a durable road cache or road-rules dataset.
- Area names use native reverse geocoding, coalesced into approximately 1 km cells, at most once a minute. SQLite caches up to 60 coarse area labels for seven days, refreshing labels after one day. No raw GPS trace is stored or added to cloud sync. The device's platform geocoder may require a network connection; cached labels and coordinates remain usable without one. Web shows coordinates and the unavailable-area text.
- Weather reuses the existing cached query and offline repository. The compact card expands for astronomy, icing guidance, and the next hours. See [weather configuration](weather.md).
- Speed limits stay **unknown** until a real road-rules source exists. OSRM travel speeds are never presented as legal limits.
- Risk is a clearly labelled **static example**, including its sample factors. It neither consumes live readings nor triggers alerts. `useRiskAssessment()` is the replacement point for the future model.

## Automatic monitoring and manual override

Monitoring remains automatic while driving. Pause stops crash sensors and road matching immediately; Resume enables the automatic services after saving the preference. The `osy.driving.paused` preference survives restarts. An unreadable or unwritable preference leaves monitoring paused and displays an error. GPS, speed, and weather remain available. No background tracking is added.

Providers stay mounted when pausing, so an active check-in, its countdown, notification listeners, and emergency deep links continue independently. The Report accident action opens the existing modal route; it does not add report submission to the placeholder screen.

## Verification

Run `pnpm test:home`, `pnpm lint`, and `pnpm typecheck`. Home tests cover preference persistence and failures, subscription cleanup, an active emergency during Pause, stale/unknown speed, the static risk boundary, geocoding throttling and offline cache, SQLite migration, and native-glass guards.

On an existing iOS/Android development build:

1. Sign in, open Home, grant location/motion access, and check stationary/walking states and real speed. Refuse access or disable location services and verify clear states and accessible actions.
2. Have a passenger inspect Home during a drive: speed and current road should update; weather should refresh according to its existing policy. Legal speed limits must remain unknown and risk must remain labelled as an example.
3. Pause, relaunch, and confirm it remains paused while GPS/weather still work. Resume and check monitoring returns automatically when driving.
4. Open a check-in from a deep link, pause monitoring, and verify the existing countdown continues. Report accident and Map navigation should remain reachable.
5. Revisit a cached area offline. Verify the retained locality/weather and stale labels. Visit an uncached area and check coordinate/unknown fallbacks.
6. Check narrow phones, landscape/tablet, English/French/Arabic and RTL, large text, VoiceOver/TalkBack, and Reduce Transparency. Verify native glass on supported iOS and frosted fallbacks on Android/older iOS.

Physical-device and real-drive validation must be performed separately; automated service tests cannot establish native glass rendering or GPS accuracy.
