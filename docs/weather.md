# Weather integration

OSY uses Open-Meteo through a standalone Node service in `server/weather/`. The phone never contacts Open-Meteo or receives its API key. This follows `INTEGRATION_EXPO_SDK57.md`: presentation in components, React Query in hooks, HTTP transport through the shared Axios infrastructure, SQL in repositories, and location through the existing location service. The application remains on its existing SDK 58.

## Start the service

Use Node 24 or newer. Node's built-in TypeScript stripping loads the shared weather contract and pure policy; no new runtime framework or mobile dependency is required.

```powershell
Copy-Item server/weather/.env.example server/weather/.env.local
pnpm weather:server
```

The equivalent direct command is `node --env-file-if-exists=server/weather/.env.local server/weather/start.mjs`.

The example binds port 8787 on the local network for physical-device development. To restrict it to this machine, set `WEATHER_HOST=127.0.0.1`. `GET /health` reports process availability; it does not call the provider. `GET /weather?latitude=36.75&longitude=3.06` requests an area snapshot. Coordinates in this example are illustrative, not the device's location.

In the mobile `.env.local`, add:

```dotenv
EXPO_PUBLIC_WEATHER_API_URL=http://YOUR_COMPUTER_LAN_IP:8787
```

The phone and computer must be able to reach each other. Allow the service port through the local firewall when required. `localhost` on a phone refers to the phone. For web previews, put the exact Expo web origin in the server's `WEATHER_ALLOWED_ORIGINS` comma-separated list. Restart Expo after changing public environment variables.

Start the app with `pnpm start --clear`. Sign-in can continue to use the existing mock when the main backend URL is blank: weather requests explicitly use the network transport, not mock weather. If the weather URL is blank, weather uses `EXPO_PUBLIC_API_URL/weather`. That fallback requires the main backend to mount the weather handler. An unconfigured service shows an unavailable state and never produces fake readings.

## Provider configuration

| Setting | Location | Purpose |
| --- | --- | --- |
| `WEATHER_API_KEY` | `server/weather/.env.local` or server secret manager | Commercial Open-Meteo credential; never put it in the mobile env or SecureStore |
| `WEATHER_HOST`, `WEATHER_PORT` | Server environment | Listen interface and port |
| `WEATHER_DAILY_REQUEST_BUDGET` | Server environment | Hard daily upstream request budget; default 1,000 |
| `WEATHER_ALLOWED_ORIGINS` | Server environment | Exact permitted browser origins |
| `EXPO_PUBLIC_WEATHER_API_URL` | Mobile `.env.local` | Public URL of the standalone service |

A blank server key selects the non-commercial development endpoint. A key selects `customer-api.open-meteo.com`. `NODE_ENV=production` requires a commercial key. Open-Meteo's free endpoint is for eligible non-commercial use; obtain the appropriate subscription for commercial development/deployment. Provider call accounting can exceed one call per HTTP request depending on the requested variables. Set the service budget with that weighting in mind. See [pricing](https://open-meteo.com/en/pricing) and [licensing](https://open-meteo.com/en/licence).

Production hosting needs HTTPS. The standalone read-only weather endpoint does not authenticate app accounts. It includes per-IP limits, a global upstream budget, bounded cache/concurrency and failure backoff; place deployment-level access/rate controls at the gateway. It does not trust arbitrary forwarded-IP headers. Multiple replicas should share a cache and budget in the main backend before scaling. No remote deployment, background task, or native build is performed by this feature.

## Data flow and caching

`WeatherWidget -> useWeather -> weatherApi -> shared Axios -> weather service -> Open-Meteo`

The weather hook reads through `runtime.weather`, a repository using the same serialized `LocalDatabase` executor as other repositories. Migration 002 creates only `weather_cache`; it does not change existing task data. Reads do not depend on internet connectivity. Disk hydration publishes into React Query before a stale snapshot triggers a network refresh, so the widget does not wait for the provider to display saved data. There is no second Zustand weather entity store.

Area keys use versioned 0.05-degree cells (about 5.6 km north/south, narrower east/west away from the equator). Both server and client use cell centres and the same helper. This is regional weather, not street-level pavement monitoring; mountainous/coastal launch areas need coverage validation. GPS jitter within a cell does not create new cache keys or requests. Current location must be recent and permission must allow access. Without a usable fix, an available last-area snapshot is explicitly labelled and excluded from current-location risk inputs.

The server shares one in-flight request per area and caches by area plus a 15-minute time bucket. It never rewrites timestamps when serving a last-known value after failure. It retains at most 1,000 area entries, serves failures from cache for at most 48 hours, limits upstream concurrency to five, limits requests to 60/minute, and applies a one-minute failure backoff. The cache is in memory and resets on restart.

The device retains at most 40 areas for 48 hours. Snapshots are read-only downloaded reference data and never enter the outgoing sync queue. A slower old response cannot overwrite a newer persisted snapshot. Reopening in airplane mode can show the matching saved area. There are no requests in the background; while mounted/foreground, the hook refreshes every 15 minutes and rechecks stale data on foreground/reconnection. Changing areas also hydrates/fetches that area's data. Web uses memory caching only, matching the project's existing SQLite web boundary.

The UI shows provider-valid time separately from retrieval time, flags stale and previous-area data, and retains saved values after refresh errors. Shared skeletons are confined to the weather card. Emergency check-in and startup never await weather. Labels and condition descriptions are localized in English, French and Arabic; attribution links to Open-Meteo and identifies OSY's adaptation.

## Normalized contract and risk inputs

`src/features/weather/types/weather.types.ts` defines and validates the response with Zod. Values use Celsius, metres, metres/second, millimetres and UTC ISO timestamps. The server requests Unix timestamps and uses the returned IANA timezone for local-day astronomy, including forecasts crossing midnight. Null readings remain null, and unsupported conditions become `unknown`. Polar sunrise/sunset may be null.

Current conditions are model-derived. `current.validAt` is the model's valid time; `fetchedAt` is retrieval time. `freshUntil` is bounded by the cache bucket and model age. Refetching old model data cannot make it fresh. Each reading includes `precipitationIntervalSeconds`: current accumulation uses the provider's interval, while hourly accumulation covers the preceding 3,600 seconds. They must not be compared as identical amounts. See the [provider definitions](https://open-meteo.com/en/docs).

`useWeather().riskInputs` exposes the pure `toWeatherRiskInputs` conversion: temperature, window-average precipitation rate, visibility, wind, gusts, day/night and an icing indicator. It deliberately does not invent an overall accident probability. No aggregate risk model exists in this checkout; these inputs are the integration boundary for that future feature.

The provisional `weather-heuristic-v1` flags possible icing for freezing precipitation, or temperatures at/below 3°C with precipitation, snow, or humidity at/above 90%. Other cases are `unknown`, never a guarantee of an ice-free road. This is a weather heuristic, not measured road-surface temperature, and requires validation before automated safety alerts. Inputs become unavailable for a different area, expired freshness deadline, excessively old model time, or a future model clock. Stale values remain displayable, but are not silently substituted for fresh risk inputs.

## Verification

```powershell
pnpm test:weather
pnpm test:offline
pnpm test:i18n
pnpm lint
pnpm typecheck
```

Tests cover area sharing, precipitation windows, missing fields, midnight and polar times, credential isolation, provider errors, request coalescing, quota/backoff, SQLite migration/persistence/pruning, stale risk exclusion, and actual HTTP validation/CORS/rate limiting. The desktop SQLite cache-read check budgets two seconds; it is not a substitute for physical-device render timing.

On a physical device: grant location, load real weather, close/reopen offline, then move to another area and reconnect. Confirm matching cache data is painted within two seconds of a usable location/cached area becoming available, while provider refresh runs independently. Check denied location, stale labels, Arabic layout and screen-reader labels. With no usable location or no cached data, a GPS fix or provider request has no guaranteed two-second completion time.
