# Road risk

Version 1 (`road-risk-heuristic-v1`) scores road segments on the phone, from 0 to 1, and gives each score its top reasons. It runs on the phone until the backend has accident history, and #16, #17 and #18 read it through `useRoadRisk()`.

**This is a rule-based estimate, not an accident probability.** Every weight is a judgement, and none is fitted to accident data. Validate it against real accidents before relying on its numbers.

## Using it

`useRoadRisk()` returns:

- `segments` and `risks`: the roads around the driver, in an area about 2 km across, and their scores.
- `current` and `currentSegment`: the road being driven, including the speed factor.
- `sources`: whether road, weather, and incident data were available. A missing source lowers a score, so never read a low score as "safe".

Reasons are factor ids, with text under `roadRisk.factor.<id>`. Levels are `low` below 0.3, `medium` from 0.3, and `high` from 0.6. The Map tab shows these scores, as described in [Map](map.md). `useVisibleRoadRisk()` gives it the same scores for the areas on screen, without the speed factor.

## Factors

| Factor | Source | Up to |
| --- | --- | --- |
| Road class | OpenStreetMap | 0.25 |
| Curves (turning per km) | OpenStreetMap | 0.25 |
| Junctions per km | OpenStreetMap | 0.15 |
| Rain | Weather | 0.15 |
| Possible ice | Weather | 0.25 |
| Visibility under 1 km | Weather | 0.2 |
| Gusts from 12 m/s | Weather | 0.1 |
| Darkness, unless the road is tagged as lit | Weather or the phone's clock | 0.15 |
| Speed above a tagged limit, current road only | GPS and OpenStreetMap | 0.3 |
| Reports and detected crashes in the last 90 days, within 100 m | `GET /incidents/nearby` | 0.3 |

Contributions add up, and the score stops at 1.

## Road data

Roads come from the public [Overpass API](https://overpass-api.de), which also fills in what OSRM lacks, such as road class and speed limits. They are cut into pieces of up to 500 m and kept in memory for 24 hours. Set `EXPO_PUBLIC_OVERPASS_URL` to use another server.

With the app identifying itself, the public server was busy or timed out on 2 of 3 test requests, and a successful 2 km area took 36 seconds. A failure is normal and leaves the score unavailable. It also learns the area around each user, and its limits suit light use only. Run your own server before real users rely on it. The data is under the ODbL, so the app must credit OpenStreetMap where scores are shown.

## Speed limits and hazards

The same request supplies marked speed limits, speed bumps, speed cameras, schools, and hazards. `useRoadRules()` gives Home and the Map tab the limit for the current road and up to 3 hazards within 300 m ahead. Without a reliable heading, it lists everything within 300 m. A hazard on a nearby road can also appear.

This only shows what is mapped in OpenStreetMap. No listed hazard does not mean that the road has none, and a missing limit stays unknown. Hazards do not change risk scores yet.

## Warnings

`RiskWarningMonitor` checks the current road and the same road ahead, up to 12 seconds of travel (150 to 500 m), on every GPS fix while driving. It adds to the road's score:

- **Too fast:** up to 0.35, against an advisory speed for the road class, lowered for curves, rain, ice, and poor visibility. It is capped by any marked limit, and it is never shown as a legal limit.
- **Harsh driving:** 0.15 for 2 minutes after hard braking or cornering, measured from GPS.

A warning needs a score of 0.7 or more, on two fixes in a row, with one of those two adding to it, at 30 km/h or more. A careful driver on a risky road is not warned.

To limit alerts, there are at least 2 minutes between warnings and at most 6 an hour. A road piece warns once in 30 minutes, and the score must fall below 0.55 before the next warning. Warnings stop during a check-in.

The banner and notification give the top two reasons, and the app reads them aloud unless sound is off in alert preferences. These warnings run only while the app is running, and iOS stays silent with the ringer off. All of these values are starting points to tune on real drives.

## Limits

- **No accident history:** this needs the backend. The mock returns no nearby incidents, and a real server will add them through the same factor.
- **Untuned levels:** in central Algiers, with no weather data, 49 of 71 sample road pieces score `medium` at noon and 2 score `high`. At night, 8 score `high`. Warnings in #17 should use `high` or a stricter threshold, and tune it on real drives.
- **No traffic data:** there is no source yet.
- **Few speed limits:** only 9 of 204 roads in the Algiers test area had one. Missing limits are not guessed, so the speed factor often cannot apply.
- **Offline:** road data is not saved across restarts.
