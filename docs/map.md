# Map

The Map tab uses [MapLibre React Native](https://github.com/maplibre/maplibre-react-native) with [OpenFreeMap](https://openfreemap.org) tiles. Neither needs an API key, and both use OpenStreetMap data, the same as OSRM.

MapLibre was chosen over `expo-maps` because it has real map layers for risk highlighting, and `expo-maps` uses Google Maps on Android, which needs a key.

- **Follow mode:** the map follows the driver's course. Dragging the map stops it, and the recenter button brings it back.
- **Road card:** shows the road numbers, road name, and speed. The name greys out when the road is stale.
- **Overlays:** `risk-roads` and `incidents` are ready and empty. #16 and #14 add their features through `MapOverlays`.
- **Dark style:** `mapStyleUrl()` has one ready, but the app is light-only, so it is not seen yet.
- **Attribution:** the map shows MapLibre's attribution button, which credits the map data.

The map needs a development build. Expo Go and web show a message instead.

OpenFreeMap's public servers have no uptime guarantee. Move to a paid or self-hosted tile source if the map becomes critical.
