# OSY API contract

Draft v1, for review with the backend team. The zod schemas named below are the source of truth for the client.

All paths are relative to `EXPO_PUBLIC_API_URL`, and requests use HTTPS. JSON is used unless stated otherwise. Timestamps are ISO 8601 with an offset, coordinates are decimal degrees, and mobile numbers use E.164.

## Language

Every request sends `Accept-Language` with the app language: `en`, `fr`, or `ar`. The backend uses it for any text it generates.

In-app alerts use stable keys plus values such as road names and distances. The app holds their text, so a safety alert still reads correctly offline.

## Push notifications

The backend sends through the Expo push service. `POST /me/push-tokens` receives an Expo push token, the platform, and the app language, and is sent again when the language changes.

Expo push has no field for translation keys, and the phone shows a closed-app push as sent. The backend must write `title` and `body` in the token's language, using the reviewed text under `alerts` in `src/common/lib/i18n/locales/`.

| Alert | `alertType` | `channelId` and `categoryId` | Text key |
| --- | --- | --- | --- |
| Crash detected | `crash_detected` | `crash_detected` | `alerts.crash_detected` |
| Potential accident | `potential_accident` | `potential_accident` | `alerts.potential_accident` |
| Accident nearby | `accident_nearby` | `accident_nearby` | `alerts.accident_nearby` |

Rules for the backend:
- `data` contains `alertId` (required and unique per alert), `alertType` (required), `roadName`, and `distanceMeters`, all as strings.
- Send with `priority: high` and `sound: default`.
- Keep the same `alertId` when retrying, because the app ignores a repeat for 10 minutes.
- Remove tokens that Expo reports as `DeviceNotRegistered`.

## Authentication

Protected requests send `Authorization: Bearer <accessToken>`.

| Method | Path | Auth | Body | Success |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/register` | No | `firstName`, `lastName`, `email`, `mobileNumber`, `password` | `201` auth response |
| `POST` | `/auth/login` | No | `email`, `password` | `200` auth response |
| `POST` | `/auth/refresh` | No | `refreshToken` | `200` `accessToken`, `refreshToken` |

An auth response contains `user`, `accessToken`, and `refreshToken`. `user` contains `id`, `firstName`, `lastName`, `email`, `mobileNumber`, and `onboardingStatus`. `onboardingStatus` is `documents_required` until both documents are accepted, then `complete`.

`confirmPassword` is checked in the form and is never sent.

Rules for the backend:
- Refresh tokens rotate on every successful refresh.
- A rejected refresh token returns `401`. The app signs out only on this response, never on a network or `5xx` failure.
- A wrong email or password returns one generic `401`.
- A taken email or mobile number returns `409`, with the field named in `error.fields`.
- Each token must fit in 2 KB, because iOS secure storage can reject larger values.

Schemas: `src/features/auth/types/auth.schemas.ts`, `src/common/lib/api/authSession.ts`.

## Documents

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| `GET` | `/me/documents` | None | `200` documents response |
| `POST` | `/me/documents` | `multipart/form-data` | `201` documents response |

The upload contains `file_front`, `file_back`, `type` (`driver_license`, `vehicle_registration`), `source` (`scan`, `upload`), `captureLanguage` (`fr`, `ar`), `fields` (a JSON string of confirmed field values), `consentVersion`, and `consentedAt`. Each file is a JPEG, PNG, or PDF of up to 10 MB.

A documents response contains `documents` and `onboardingStatus`. Each document contains `type`, `status` (`missing`, `pending`, `verified`, `rejected`), `rejectionReason`, and `updatedAt`.

Field keys are defined in #28. A document marked `rejected` must include a `rejectionReason` that can be shown to the user. `onboardingStatus` becomes `complete` once neither document is `missing` or `rejected`, so a `pending` document does not block the app.

`GET /me/documents` also tells the app a user's onboarding state at launch.

## Incidents and emergency

| Method | Path | Body or query | Success |
| --- | --- | --- | --- |
| `POST` | `/incidents` | Incident | `201` incident |
| `POST` | `/incidents/{id}/photo` | Multipart `photo`: a JPEG or PNG of up to 10 MB | `204` |
| `GET` | `/incidents/nearby` | `latitude`, `longitude`, `radiusKm` | `200` `incidents` |
| `POST` | `/emergency/escalate` | Escalation | `201` escalation status |
| `POST` | `/emergency/escalate/{id}/location` | `latitude`, `longitude` | `204` |
| `POST` | `/emergency/escalate/{id}/cancel` | None | `200` escalation status |

Incident: `id`, `source` (`user_report`, `crash_detected`), `location`, `occurredAt`, `type`, `severity` (`minor`, `serious`, `critical`), `injuriesVisible`, `note`.

For a `user_report`, `type` is `collision`, `pedestrian`, `rollover`, `fire`, or `other`. A queued report can arrive long after `occurredAt`.

The backend must merge duplicate reports of one accident and protect against abuse, for example with per-user rate limits. A merged report still returns `201`, and a `429` is retried by the app. Any other `4xx` is treated as final, and the app stops retrying.

Escalation: `id`, `incidentId`, `trigger` (`user_requested`, `check_in_timeout`), `location`, `speedBeforeImpactKmh`, `roadName`, `roadNumber`, `shareMedicalInfo`. The response contains `id`, `status` (`escalating`, `resolved`, `canceled`), and `liveLocationUrl`.

`id` values are generated on the device, so the backend must treat a repeated `id` as the same request and return the original result.

Schemas: `src/features/safety/types/safety.schemas.ts`.

## Profile

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| `GET` | `/me` | None | `200` user |
| `PUT` | `/me` | `firstName`, `lastName`, `mobileNumber`, optional `vehicle`, `medical` | `200` updated profile |
| `PUT` | `/me/photo` | Multipart JPEG `photo`, up to 2 MB | `200` `{ photoUrl }` |
| `GET` | `/me/driving-stats` | None | `200` `{ trips, distanceMeters, warnings }` |
| `GET` | `/me/reports` | None | `200` `{ reports }`, latest 100 |
| `PUT` | `/me/preferences` | Settings object described below | `204` |
| `DELETE` | `/me/data` | None | `204`; retain identity, erase personal feature data |
| `DELETE` | `/me` | None | `204`; delete account and its personal data |
| `GET` | `/me/emergency-contacts` | None | `200` `contacts` |
| `PUT` | `/me/emergency-contacts` | `contacts` | `200` `contacts` |
| `POST` | `/me/push-tokens` | `token`, `platform` (`ios`, `android`), `language` (`en`, `fr`, `ar`) | `204` |

A contact contains `id`, `name`, `mobileNumber`, and `relationship`. `PUT` replaces the whole list.

The profile extends the authentication user with nullable `photoUrl` (HTTPS in production), nullable `vehicle`, and `medical: { bloodType, allergies, conditions }`. Medical text is self-reported, optional, and limited to 10/500/1000 characters respectively. Profile PUT must echo the saved medical and vehicle fields. The client retains pending changes if a server silently drops them. Photo PUT replaces the authenticated user's avatar and returns its stable URL; retrying it must not create duplicate resources. The local mock uses a private device file URL for its avatar, since it has no remote image server.

The profile client binds requests to `X-OSY-Owner`, the user ID captured before dispatch. The mobile auth interceptor cancels mismatched requests and retries. The backend must also verify this header, when present, against the authenticated user; it is never an authorization mechanism by itself.

Driving stats are real account totals; distance is always metres. Reports contain `id`, `occurredAt`, `type`, `severity`, and `status` (`received`, `reviewing`, `resolved`), newest first. The client caches the latest 100 and never invents trips or warnings. The local mock starts with zero totals and records reports submitted to it.

Preferences use `src/features/settings/types/settings.types.ts`: per-type notification flags, `nearbyRadiusKm`, crash detection, sensitivity, countdown total, voice/language, units, appearance, and optional analytics/medical-sharing consent. The radius is always kilometres; display units do not change storage or risk-model inputs. The backend must apply notification flags and radius **before sending closed-app push notifications**, and include a valid `distanceMeters` for nearby alerts. On-device settings cannot prevent the OS from displaying a push that the server already sent. Never treat optional analytics consent as consent to share medical information.

The backend may share saved medical information with responders only when the account has opted in and the escalation request's `shareMedicalInfo` is true. A false request value takes priority. Emergency contact delivery and medical sharing occur on the backend; the mobile app does not send SMS itself. Unsynced profile changes are not yet available to responders through the backend.

Profile edits and contact replacement are retryable, account-scoped operations. Use idempotent replacement semantics. Local revisions prevent an older acknowledgement or GET response from overwriting a new edit; failed/409 responses retain the pending snapshot. This initial contract replaces the current device's editable snapshot; cross-device conflict resolution requires a future version/ETag contract.

Deletion endpoints must erase contacts, medical data, optional telemetry, private report history, avatar and vehicle data; account deletion also removes identity/documents and revokes tokens. Return success only after accepting responsibility for deletion. The app confirms the action, requires a connection, protects an active emergency, pauses outbox sync, and durably records local-erasure intent so startup clears device queues before resuming sync after interruption. Device erasure does not claim a backend deletion succeeded without an HTTP acknowledgement.

These additional profile/settings endpoints are implemented by the local mock and typed client. A real backend must implement them before production deployment.

Schemas: `src/features/profile/types/profile.schemas.ts`.

## Errors

Every error response uses this shape:

```json
{
  "error": {
    "code": "email_taken",
    "message": "This email is already registered.",
    "fields": { "email": "This email is already registered." }
  }
}
```

`fields` is optional. The client maps `401` to `unauthorized`, `409` to `conflict`, `422` to `validation`, `429` to `rate_limited`, and `5xx` to `server`. A missing response is `network`.

Error text may be shown to users, so it must never contain passwords, tokens, or document data.

## Weather

`GET /weather?latitude=<decimal>&longitude=<decimal>` returns current model conditions, up to six future hourly readings, local-day sunrise/sunset, area metadata and freshness timestamps. The standalone implementation is in `server/weather/`; the main backend can mount the same service later. Its read-only endpoint is unauthenticated and protected by limits/budgets, independently of account onboarding.

The Zod contract is `src/features/weather/types/weather.types.ts`. Units are Celsius, metres, metres/second, millimetres and UTC ISO timestamps. Each precipitation amount includes its accumulation interval in seconds. `validAt` is provider-valid time, not retrieval time. Missing fields are null. Condition identifiers are translated by the app. `schemaVersion` is 1 and `dataKind` is `model`.

Invalid coordinates return `422`; the standalone per-client rate limit returns `429`; provider failure without a usable cache returns `503`. Error bodies use the common `error` shape and never include a key or upstream request URL. A server-cache fallback preserves the original timestamps so the app can identify stale data. See [weather integration](docs/weather.md) for configuration, cache/risk rules and testing.

## Offline sync

Offline sync requires a signed-in user, a backend, and a registered adapter. Accident reports use it through `POST /incidents`. Task sync stays off until `EXPO_PUBLIC_SYNC_ENABLED` is `true` and its endpoints exist, which are not defined yet. The backend must deduplicate `clientOperationId`, keep client-generated IDs, and return `409` for conflicts.
