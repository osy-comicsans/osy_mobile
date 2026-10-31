# Map

The Map tab uses [MapLibre React Native](https://github.com/maplibre/maplibre-react-native) with [OpenFreeMap](https://openfreemap.org) tiles. Neither needs an API key, and both use OpenStreetMap data, the same as OSRM.

MapLibre was chosen over `expo-maps` because it has real map layers for risk highlighting, and `expo-maps` uses Google Maps on Android, which needs a key.

- **Follow mode:** the map follows the driver's course. Dragging the map stops it, and the recenter button brings it back.
- **Road card:** shows the road numbers, road name, and speed. The name greys out when the road is stale.
- **Overlays:** `risk-roads` shows road risk, and `incidents` is ready and empty for #14. Both use `MapOverlays`.
- **Road risk:** roads are green, orange, or red by risk level, from the same scores as [road risk](road-risk.md). The legend has the on/off switch, and tapping a road shows its level and top reasons.
- **Road card:** also shows the marked speed limit, and up to 3 hazards within 300 m ahead.
- **Hazards:** speed bumps, speed cameras, schools, animal crossings, and other marked hazards appear as coloured dots, with the road risk switch.
- **Loading road risk:** the map loads the 2 km areas on screen once a pan has settled for 0.6 seconds, one request at a time, and keeps them for 24 hours. Above 6 areas it asks the user to zoom in and loads nothing.
- **Dark style:** `mapStyleUrl()` has one ready, but the app is light-only, so it is not seen yet.
- **Attribution:** the map shows MapLibre's attribution button, which credits the map data.

The map needs a development build. Expo Go and web show a message instead.

OpenFreeMap's public servers have no uptime guarantee. Move to a paid or self-hosted tile source if the map becomes critical.
