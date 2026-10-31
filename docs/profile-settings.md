# Profile and Settings

Profile lives in the existing Profile tab. Settings, emergency contacts, and licenses remain pushed screens within that tab. The pages use the existing OSY typography, pill controls, spacing, light/dark tokens, and guarded glass material. English, French, and Arabic strings are included, with RTL-safe layout.

## Profile data

Names, phone, optional vehicle, avatar, medical notes, and emergency contacts use the typed Profile API. Medical sharing is off by default. Profile/contacts/photo edits first commit an account-scoped snapshot and local revision to the `profile_cache` SQLite repository (migration 4). A confirmed save works without internet. Selected photos are resized to 512 pixels and staged in an account-specific private folder until upload succeeds. The avatar URL comes from the backend; the mock retains a private device image.

React Query reads the signed-in user's SQLite cache through `features/profile/hooks/useProfileCache.ts`. SQLite remains the durable source of truth; Zustand holds only workflow flags and an invalidation revision. `common/lib/database/sync/profileSyncManager.ts` retries while online in the foreground, on reconnection, at startup, on saved edits, and through Sync & refresh. Profile PUT and contact replacement must both acknowledge an edit before its revision is marked clean. New edits made during upload stay pending. Stale GET responses cannot overwrite dirty rows. An uploaded photo is kept as soon as `PUT /me/photo` succeeds, and a staged photo whose file is gone is dropped, so neither can block the rest of the edit. A `409`, `422` or other final `4xx` stops retrying that revision: Profile shows what the server refused (a `409` names the field from `error.fields`), keeps the edit, and offers Try again or Discard my changes, which replaces the cache with the server copy. Editing and saving again also retries. An escalation sends any pending edit at once, because responders read the backend copy. An account change immediately hides the old cache and cancels owner-mismatched HTTP dispatch/retries. User ID is restored alongside tokens from SecureStore; old sessions without one need a successful `/me` request once.

Driving statistics are backend totals of the trips each phone records (see [Trips](#trips)), plus finished trips on this phone still waiting to upload, so a trip is never counted twice. The local mock sums the trips and tracks the reports actually submitted to it. The newest 100 reports and latest stats are cached with the profile; unsupported endpoints show unavailable states. My reports also lists accident reports still in the offline queue as Waiting to send, and Profile refreshes when the queue delivers one. Medical info and contacts become available to the backend after synchronization, and the backend uses them for escalation. Unsynced changes are labelled as pending.

The web preview uses a session-only profile cache and does not persist medical/contact/report details through the mock's browser storage. Connected updates can still reach a configured backend. Native iOS/Android builds provide durable offline profile storage. No cloud service is provisioned by this change: the new endpoints in [API_CONTRACT.md](../API_CONTRACT.md) must be implemented on the real backend.

## Trips

`features/driving/utils/tripRecorder.ts` runs while monitoring is on, bound to the driving-mode store like crash detection, and reads the location store. A trip starts when the location service's driving state becomes driving and ends when it leaves driving or monitoring is paused. After more than 5 minutes without a fix, the trip ends at the last fix before the gap. Background fixes reach the same store through the background location task, so a trip continues with the screen locked when "Always" access is granted.

- Distance sums great-circle distance between fixes. Fixes less accurate than 50 m are skipped, as are jumps implying more than 250 km/h, and a stopped car's wandering fixes add nothing.
- Warnings count risk, potential-accident and nearby-accident alerts the alert service actually showed during the trip, after its duplicate and settings filters. Crash alerts start a check-in instead.
- Trips under 500 m are dropped.
- The running totals are saved every 30 seconds and on each warning. No coordinates are stored. If the app closes mid-trip, the next launch ends that trip at its last saved fix and queues it, so a drive that continues becomes a second trip.
- A finished trip waits in the sync queue as `POST /me/trips`, bound to its owner. Log out discards the account's open and waiting trips, and data erasure clears them.

## Settings consumers

`features/settings/utils/settingsService.ts` validates and serializes durable preference writes. Failed writes do not show false success. Account-scoped analytics and medical-sharing consent survive a restart for the same account and reset on sign-out/account change.

| Setting | Consumer |
| --- | --- |
| Per-alert notification flags | Local alert delivery, haptics, sound and spoken alerts; explicit notification taps and the emergency screen remain accessible |
| Nearby radius | Nearby alert distance gate plus backend preference sync; no GPS trace is stored in preferences |
| Crash detection | Starts/stops crash sensor monitoring independently of GPS/roads; Home Pause/Resume still applies |
| Sensitivity | Actual rule impact/confidence thresholds and model crash probability threshold; the standard values preserve the existing thresholds |
| Countdown | 60/120/180 seconds total, split into three stages; an active countdown freezes its original duration |
| Voice and voice language | `common/lib/native/voice.ts` / Expo Speech; disabling voice cancels speech, and missing native support leaves visual controls usable |
| App language | Existing persisted language preference, API language headers, and RTL restart behavior |
| Units | Home dial, current speed, road speed limits, Map, weather wind, radius labels and profile distance; stored/risk inputs remain SI |
| Appearance | Shared text, cards, inputs, buttons, glass, navigation, Home/Map and account surfaces; device/light/dark |
| Optional analytics | Saved consent sent to the backend; this change adds no analytics uploader |
| Medical-sharing consent | Account-checked `shareMedicalInfo` on escalation; revocation applies before a queued escalation is sent |

The dial range is 240 km/h or 160 mph, independent of the legal road limit. Sensitivity is a user-adjustable heuristic/model parameter, not a claim of validated crash-detection accuracy. Physical-device tuning remains necessary.

`common/lib/database/sync/preferencesSync.ts` serializes and retries backend preference writes without racing old writes over new choices. Settings distinguishes saved device values from account notification changes awaiting sync. The backend must filter push notifications while the app is closed; local JavaScript cannot retroactively prevent their display.

## Privacy and permissions

Settings shows foreground/background location, motion and notification status, and a system-settings shortcut. Existing permission onboarding remains in place. The app does not grant permissions by toggling a preference.

Data/account erasure requires typing `DELETE`, a connection, and no active check-in/escalation. Server failures do not report deletion as successful. Sync is paused during erasure. A durable local intent finishes device-cache/outbox cleanup before sync after a restart; the current user's staged avatar folder and device report-photo cache are cleared. Account deletion signs out and ends the temporary Home login bypass. Log out asks for confirmation, warns when edits have not synced, and removes that account's profile cache and staged photos from the phone; signing in again downloads them. Local offline preferences reset; data deletion alone retains account identity. An interrupted HTTP request still requires a backend acknowledgement to establish whether server deletion completed.

The About section shows app/SDK versions. Licenses are bundled for offline reading from installed package notices, fonts and model notices. Run `pnpm licenses:generate` after dependency changes. The Gabarito OFL is copied from the Google Fonts source; road attribution remains OpenStreetMap/ODbL.

## Validation

Run `pnpm test:profile-settings`, `pnpm lint`, `pnpm typecheck`, and the full existing suites. Tests exercise durable reopen, revision races, account isolation and auth retries, failed/ignored server updates, consent ownership, countdown freezing, sensitivity gates, voice/notification filtering, and erasure.

Device checks: use the local demo profile when the temporary Home bypass is active, edit fields and a photo in airplane mode, restart and reconnect, verify pending/synced labels, and confirm contacts/medical fields arrive on the mock or real backend. Change speed units, appearance, language/RTL, alert flags/radius, voice and detection state. Test active emergency protection before deleting synthetic test-account data. Verify speech on a fresh development build containing `expo-speech`; older binaries show the unavailable state. Drive a real route with monitoring on, once with the app open and once locked with "Always" access, and compare the recorded distance with the odometer. Native rendering, real sensor behavior, remote push filtering and real backend deletion still need device/server validation.
