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
      api/axios.ts              Shared HTTP transport client
      config.ts                 Public environment configuration
      database/
        sqlite.ts               Lazy native database connection
        sqlite.web.ts           Explicit unsupported-web boundary
        migrations/             Reserved for schema changes
        repositories/           Reserved for SQL access
        sync/                   Reserved for offline synchronization
      native/                   Expo and platform helpers
      network/                  Reserved for connectivity integration
      storage/secureStorage.ts  Sensitive key-value storage
      theme.ts                  Shared theme and spacing
    types/
    utils/
  features/
    home/
    explore/
      components/
      screens/
      hooks/
      api/
      types/
      utils/
```

The `@/` alias resolves to `src/`. For example, use `@/features/home/screens/HomeScreen`, without an extra `src` segment.

Routes select screens and configure navigation. Screens compose UI; components receive data and callbacks. Hooks own orchestration and call transport functions or repositories. Feature API files use the shared Axios client and contain no React Query logic. SQL stays in `common/lib/database/repositories/`. Native concerns stay in `common/lib/native/`. Empty directories are intentional placeholders tracked with `.gitkeep`.

SQLite opens on first use, shares one initialization across callers, enables WAL and foreign keys, and permits retries after initialization failures. No feature tables or migrations run yet. The database helper targets Android and iOS; web persistence requires a separate SQLite WASM and cross-origin isolation setup. The web helper rejects with a clear error until configured.

Secure storage exposes asynchronous `getItem`, `setItem`, and `removeItem` operations and an `isAvailable` check. Unsupported platforms reject operations; no browser storage fallback is used for authentication values.

Installed foundations: TanStack Query, Axios, Expo SQLite, Zustand, Expo SecureStore, Expo Network, NetInfo, and Zod. Query providers, connectivity listeners, authentication flows, feature repositories, and offline synchronization are deferred to the integration and offline stages.

The existing Home and Explore starter screens remain available, with their implementations moved outside `src/app/`. Git was already initialized with the starter commit.
