# Road matching

The app finds the road a driver is on with OSRM, and exposes it through `useCurrentRoad()` in `src/features/roads/`. This covers the road matching part of #4.

## How it works

1. While the driving state is `driving`, `RoadService` keeps the last 8 GPS fixes.
2. Every 3 seconds or 50 m, it sends them to OSRM `match`. With fewer than 3 fixes it uses `nearest`, which gives a name but no road number.
3. A low-confidence match is ignored. The threshold is `MIN_MATCH_CONFIDENCE`, and needs tuning on real drives.
4. A different road must match twice in a row, so a road running alongside does not cause flicker.
5. If matching fails or the phone is offline, the last road stays and `stale` becomes true.

`osrmApi.route()` provides routing for "go to accident" in #14.

Stopped or slow drivers still refresh every 15 seconds.

## Server

The app uses the public demo server, `router.project-osrm.org`, in every build. Set `EXPO_PUBLIC_OSRM_URL` to use another server.

The demo server is for reasonable non-commercial use, is limited to 1 request per second, has no uptime guarantee, and receives users' GPS traces. Move to a server you run before real users rely on it.

The OSRM client is separate from the API client, so the user's access token never reaches the OSRM server.

## Not built yet

- Road rules: speed limits, speed bumps, schools, and hazards need a separate data source, because OSRM does not return them. See #4.
- Road names in the app language: OSRM can return French and Arabic together.
- Keeping the last road across app restarts.
