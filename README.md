# OSYMobile

Expo SDK 57 application using Expo Router, React Native, and strict TypeScript.

## Development

```powershell
npm ci
Copy-Item .env.example .env.local
npm start
```

Set `EXPO_PUBLIC_API_URL` in `.env.local` before making backend requests. Use an address reachable from your device. The app can launch without a backend URL; the shared client rejects requests until one is configured. `EXPO_PUBLIC_*` values are bundled into the app and must never contain secrets. Authentication values belong in SecureStore.

```powershell
npm run lint
npm run typecheck
npm run test:offline
npx expo-doctor
npx expo export --platform all
```

Use `npx expo install <package>` to add dependencies with SDK-compatible versions. Native configuration lives in `app.json` and config plugins. The `ios/` and `android/` folders are generated; do not create or edit them manually.

## Startup architecture

```text
src/
  app/                          Expo Router routes and navigator layout only
  common/
    components/                 Shared UI and platform-specific tab navigators
    screens/                    Shared screens
    hooks/                      Shared React hooks
    lib/
      api/                      Shared HTTP clients, auth session, and API errors
      config.ts                 Public environment configuration
      database/
        sqlite.ts               Lazy native database connection and migrations
        sqlite.web.ts           Explicit unsupported-web boundary
        migrations/             Versioned transactional schema changes
        repositories/           Task, queue, and synchronization SQL
        sync/                   Queue orchestration and transport adapters
        offlineRuntime.ts       Offline startup and foreground sync lifecycle
      native/                   Expo and platform helpers
      network/                  Connectivity subscription
      storage/secureStorage.ts  Sensitive key-value storage
      theme.ts                  Shared theme and spacing
    types/
    utils/
  features/
    auth/                       Sign up, sign in, and document API contract
    crash-detection/            Detects a crash while driving and emits crashDetected
    home/
    location/                   Shared live position, speed, and permissions
    map/
    profile/
    settings/
    safety/                     Check-in, accident report, and alert modals
    todos/                      Offline task example, no longer routed
    device-playground/          Sensor examples, no longer routed
      components/
      screens/
      hooks/
      api/
      types/
      utils/
```

The `@/` alias resolves to `src/`. For example, use `@/features/home/screens/HomeScreen`, without an extra `src` segment.

Routes select screens and configure navigation. Screens compose UI; components receive data and callbacks. Hooks own orchestration and call transport functions or repositories. Feature API files use the shared Axios client and contain no React Query logic. SQL stays in `common/lib/database/repositories/`. Native concerns stay in `common/lib/native/`. Empty directories are intentional placeholders tracked with `.gitkeep`.

SQLite opens on first use, shares one initialization across callers, enables WAL and foreign keys, and runs versioned migrations transactionally. Failed initialization can be retried without resetting data. The database helper targets Android and iOS; web persistence requires a separate SQLite WASM and cross-origin isolation setup. The todos web preview explains this limitation and does not pretend to save data.

Secure storage exposes asynchronous `getItem`, `setItem`, and `removeItem` operations and an `isAvailable` check. Unsupported platforms reject operations; no browser storage fallback is used for authentication values.

Installed foundations: TanStack Query, Axios, Expo SQLite, Zustand, Expo SecureStore, Expo Network, NetInfo, Zod, and Expo Crypto. Query providers, connectivity listeners, local repositories, and the offline synchronization infrastructure are wired. The API contract is documented in `API_CONTRACT.md`, and typed client modules follow it. Screens that use them, and sync endpoints, are not built yet.

## Navigation

```text
src/app/
  _layout.tsx             Root stack, anchored to (tabs)
  (tabs)/
    _layout.tsx           Home, Map, and Profile tabs
    index.tsx             Home
    map.tsx               Map
    profile/
      _layout.tsx         Profile stack
      index.tsx           Profile
      settings.tsx        Settings, reached from Profile
  check-in.tsx            Full-screen modal
  report-accident.tsx     Modal
  alert/[id].tsx          Modal
```

After a crash, `check-in` waits 30, then 60, then 90 seconds. With no answer it calls `escalateCheckIn()`, which stays empty until #8.

Modals can be opened from anywhere with `router.push('/check-in')`, or from a link such as `osymobile://check-in`. The root anchor keeps the tabs beneath a modal opened from a link. `check-in` disables the swipe-down gesture, so it needs an explicit way to leave.

The `todos` and `device-playground` features no longer have routes. Their code stays until location and crash detection replace it.

## Offline use

The task screen has no route at the moment, so this flow needs a temporary route to try on a device. Create, rename, complete, and delete tasks with or without internet. Changes are committed locally before the list refreshes; no account, API URL, username, or password is required. Closing and reopening the app preserves tasks and queued changes. Removing the app or clearing its storage can remove this local database; it is not a cloud backup.

Each local mutation writes its task and a stable UUID operation to `sync_queue` in one transaction. Deleted tasks remain as hidden tombstones. Reads and writes use one serialized database executor so concurrent async operations cannot join another mutation's transaction. React Query manages lifecycle and invalidation; local queries and mutations use `networkMode: 'always'`. Zustand holds only transient connection/sync status, not another mutable copy of tasks.

Sync is disabled by default. Pending operations stay pending until a registered transport receives a real server acknowledgement. Startup recovers interrupted operations; failures retain their IDs and payloads and use bounded exponential backoff. Earlier unfinished changes block later changes to the same entity, while independent entities can proceed. Foreground startup, reconnection, returning to the app, local mutations, a 30-second foreground timer, and the manual Sync button can trigger a pass. The timer exists only when sync is configured, a transport is registered, and the app is online and active. No operating-system background task is registered, and no sync is promised while the app is suspended or terminated.

The conflict policy for tasks is **manual review**. Server conflict responses stay blocked, and incoming changes never overwrite dirty local tasks. Remote snapshots are retained in `sync_conflicts`; incoming batches and their cursors commit atomically. There is no automatic last-write-wins policy. A conflict review/resolution screen remains part of the future backend integration; conflict operations are deliberately excluded from the Retry button.

## Configuration and credentials

The local `.env.local` file is ignored by Git. A blank, offline-ready file is created for this setup; `.env.example` is the shareable template.

```dotenv
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_SYNC_ENABLED=false
```

| Setting | Where to fill it | Needed now? |
| --- | --- | --- |
| Backend base URL | `EXPO_PUBLIC_API_URL` in `.env.local` | No; leave blank |
| Cloud sync switch | `EXPO_PUBLIC_SYNC_ENABLED` in `.env.local` | Leave `false` until integration is complete |
| HTTP route paths and response mapping | Implement `TodosTransport` in `src/features/todos/api/todosApi.ts` using the shared Axios client | Later, when endpoints exist |
| Transport registration | Register `createTodoSyncAdapter(runtime.todos, transport)` with `runtime.registerSyncAdapter('todo', adapter)` in `src/common/providers/AppProviders.tsx` | Later |
| App username and password | The future sign-in screen; there is no login form or credential configuration yet | No |
| Access and refresh tokens | Saved at runtime by `authSession` in `src/common/lib/api/axios.ts` through `secureStorage` | Managed by the app; never configure by hand |
| Local SQLite username/password | None; `osy.db` is created automatically in the app's private storage | No |
| Backend database/service passwords and private API keys | Your backend's secret environment settings, outside this mobile project | Never put these in `EXPO_PUBLIC_*` |

Central public configuration lives in `src/common/lib/config.ts`; retry/timer defaults live in `src/common/lib/database/sync/syncPolicy.ts`. Do not put login passwords or tokens in `.env.local`: `EXPO_PUBLIC_*` values are visible in the app bundle. Keep `EXPO_PUBLIC_SYNC_ENABLED=false` for local-only use. A URL or flag alone cannot start sync because there are no registered transports.

Sync also requires a signed-in user. Once endpoints exist, implement transport, register the adapter, and define how existing device-local data belongs to a signed-in account before enabling sync. The backend must preserve local entity IDs, deduplicate stable `clientOperationId` values, provide real acknowledgements, and map conflict responses to `SyncConflictError`. The optional pull transport returns normalized task changes and a cursor; `createTodoSyncAdapter` applies them through the repository. No endpoint paths or credentials are guessed in this implementation.

## Offline verification

`pnpm test:api` covers the auth session, token refresh, error mapping, and contract modules against a fake server.

`npm run test:offline` uses Node's built-in SQLite engine (Node 22.13+ or newer) to exercise the production repositories, migrations, and sync manager without an emulator or backend. Tests cover atomic rollback, persistence across reopen, queue ordering, interrupted delivery, idempotency contracts, concurrent edits, conflict retention, cursor rollback, and React Query reads/writes while offline. This does not replace testing Expo's native SQLite bridge on a phone.

Device check: open the task screen, enable airplane mode, add/edit/complete/delete tasks, close and reopen the app, and confirm local state survives. Cloud sync should remain unavailable with the default configuration, and changes should remain queued.

## Alerts

Crash, potential accident, and nearby accident alerts all go through `src/features/alerts/`. Add new alert behaviour to the rules in `utils/alertRules.ts`. In a development build, Settings has a test menu for each alert. Use its delayed button, then leave the app, to test a notification.

Push needs a development build, not Expo Go. It uses the Expo push service, which also needs an EAS project, an iOS bundle identifier, an Android package name, `google-services.json`, and FCM and APNs credentials uploaded to EAS. None of these are set up yet. The server writes closed-app push text in the language the app registers, using the strings in `src/common/lib/i18n/locales/`.

## Accounts and the mock backend

Users must sign in and add both documents before they can reach the tabs. With no `EXPO_PUBLIC_API_URL`, development builds use the mock backend in `src/common/lib/api/mock/`. It sits behind the real API client, so setting the URL is all that is needed to use a real backend. Release builds never fall back to it unless `EXPO_PUBLIC_MOCK_API` is `true`.

| Mock test | How |
| --- | --- |
| Skip onboarding | Sign in as `demo@osy.test` with any password |
| Already registered | Register with `taken@osy.test` or `+213555000000` |
| Wrong password | Sign in with the password `Wrong123` |
| Lost connection | Use `offline@osy.test` |
| Rejected document | Put `REJECT` in any document field |

OCR is a stand-in until #28, and fills in sample values only under the mock. PDFs skip OCR, so their details are typed by hand.

## Languages

The app runs in English, French, and Arabic, and follows the device language until the user picks one in Settings. Strings live in `src/common/lib/i18n/locales/`, and `pnpm test:i18n` checks that all three files stay in step. App name and permission text live in `assets/locales/`.

Arabic is right-to-left, so switching to or from it reloads the app. Expo Go ignores forced direction changes, so test this in a development build. Use `start`/`end` styles rather than `left`/`right` unless the direction is physical, such as a compass.

French and Arabic strings are drafts until a fluent speaker has reviewed them. Do not release emergency text without that review.
