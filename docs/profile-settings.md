# Profile and Settings

Profile lives in the existing Profile tab. Settings, emergency contacts, and licenses remain pushed screens within that tab. The pages use the existing OSY typography, pill controls, spacing, light/dark tokens, and guarded glass material. English, French, and Arabic strings are included, with RTL-safe layout.

## Profile data

Names, phone, optional vehicle, avatar, medical notes, and emergency contacts use the typed Profile API. Medical sharing is off by default. Profile/contacts/photo edits first commit an account-scoped snapshot and local revision to the `profile_cache` SQLite repository (migration 4). A confirmed save works without internet. Selected photos are resized to 512 pixels and staged in an account-specific private folder until upload succeeds. The avatar URL comes from the backend; the mock retains a private device image.

React Query reads the signed-in user's SQLite cache through `features/profile/hooks/useProfileCache.ts`. SQLite remains the durable source of truth; Zustand holds only workflow flags and an invalidation revision. `common/lib/database/sync/profileSyncManager.ts` retries while online in the foreground, on reconnection, at startup, on saved edits, and through Sync & refresh. Profile PUT and contact replacement must both acknowledge an edit before its revision is marked clean. New edits made during upload stay pending. Stale GET responses cannot overwrite dirty rows. An account change immediately hides the old cache and cancels owner-mismatched HTTP dispatch/retries. User ID is restored alongside tokens from SecureStore; old sessions without one need a successful `/me` request once.

Driving statistics are read-only backend aggregates. No fake trips, distance, or warnings are derived from a UI preview. The local mock returns zero totals and tracks reports actually submitted to it. The newest 100 reports and latest stats are cached with the profile; unsupported endpoints show unavailable states. Medical info and contacts become available to the backend after synchronization, and the backend uses them for escalation. Unsynced changes are labelled as pending.

The web preview uses a session-only profile cache and does not persist medical/contact/report details through the mock's browser storage. Connected updates can still reach a configured backend. Native iOS/Android builds provide durable offline profile storage. No cloud service is provisioned by this change: the new endpoints in [API_CONTRACT.md](../API_CONTRACT.md) must be implemented on the real backend.

## Settings consumers

`features/settings/utils/settingsService.ts` validates and serializes durable preference writes. Failed writes do not show false success. Saved values are restored over the defaults, so a setting added or renamed in a later version starts at its default without resetting the others; a file that cannot be read or validated leaves crash detection paused and shows the save error. Account-scoped analytics and medical-sharing consent survive a restart for the same account and reset on sign-out/account change.

| Setting | Consumer |
| --- | --- |
| Per-alert notification flags | Local alert delivery, haptics, sound and spoken alerts; explicit notification taps and the emergency screen remain accessible |
| Nearby radius | Nearby alert distance gate plus backend preference sync; no GPS trace is stored in preferences |
| Crash detection | Starts/stops crash sensor monitoring independently of GPS/roads; Home Pause/Resume still applies |
| Sensitivity | Actual rule impact/confidence thresholds and model crash probability threshold; the standard values preserve the existing thresholds |
| Countdown | 60/120/180 seconds total, split into three stages; an active countdown freezes its original duration |
| Voice and voice language | Spoken alerts, including road-risk reasons, and the check-in question, through `common/lib/native/voice.ts` / Expo Speech; the check-in listens for an answer either way. Disabling voice cancels speech, and missing native support leaves visual controls usable |
| App language | Existing persisted language preference, API language headers, and RTL restart behavior |
| Units | Every speed and distance shown: the Home dial and speed limit, current speed, the Map road card speed and limit, weather wind and visibility, hazards ahead, the distance to a nearby accident, the route to it, radius labels and profile distance. Kilometres switch to metres, and miles to feet, below 1 km or 0.1 mi. Stored values, API data and risk inputs remain SI, and temperature and rainfall stay metric |
| Appearance | Shared text, cards, inputs, buttons, glass, navigation, Home/Map and account surfaces; device/light/dark |
| Optional analytics | Saved consent sent to the backend; this change adds no analytics uploader |
| Medical-sharing consent | Account-checked `shareMedicalInfo` on escalation; revocation applies before a queued escalation is sent |

The dial range is 240 km/h or 160 mph, independent of the legal road limit. Sensitivity is a user-adjustable heuristic/model parameter, not a claim of validated crash-detection accuracy. Physical-device tuning remains necessary.

`common/lib/database/sync/preferencesSync.ts` serializes and retries backend preference writes without racing old writes over new choices. Settings distinguishes saved device values from account notification changes awaiting sync. The backend must filter push notifications while the app is closed; local JavaScript cannot retroactively prevent their display.

## Privacy and permissions

Settings shows foreground/background location, motion, notification and microphone/speech-recognition status, refreshed when the app returns to the foreground, and a system-settings shortcut. A permission that has not been asked for yet gets an Allow access button, which reuses the existing request flows; motion and background location are offered once location is allowed. Existing permission onboarding remains in place. The app does not grant permissions by toggling a preference.

Data/account erasure requires typing `DELETE`, a connection, and no active check-in/escalation. Server failures do not report deletion as successful. Sync is paused during erasure. A durable local intent finishes device-cache/outbox cleanup before sync after a restart; the current user's staged avatar folder and device report-photo cache are cleared. Account deletion signs out and ends the temporary Home login bypass. Local offline preferences reset; data deletion alone retains account identity. An interrupted HTTP request still requires a backend acknowledgement to establish whether server deletion completed.

The About section shows app/SDK versions. Licenses are bundled for offline reading from installed package notices, fonts and model notices. Run `pnpm licenses:generate` after dependency changes. The Gabarito OFL is copied from the Google Fonts source; road attribution remains OpenStreetMap/ODbL.

## Validation

Run `pnpm test:profile-settings`, `pnpm lint`, `pnpm typecheck`, and the full existing suites. Tests exercise durable reopen, revision races, account isolation and auth retries, failed/ignored server updates, consent ownership, countdown freezing, sensitivity gates, voice/notification filtering, and erasure.

Device checks: use the local demo profile when the temporary Home bypass is active, edit fields and a photo in airplane mode, restart and reconnect, verify pending/synced labels, and confirm contacts/medical fields arrive on the mock or real backend. Change speed units, appearance, language/RTL, alert flags/radius, voice and detection state. Test active emergency protection before deleting synthetic test-account data. Verify speech on a fresh development build containing `expo-speech`; older binaries show the unavailable state. Native rendering, real sensor behavior, remote push filtering and real backend deletion still need device/server validation.
