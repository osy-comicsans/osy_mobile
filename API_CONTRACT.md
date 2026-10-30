# OSY API contract

Draft v1, for review with the backend team. The zod schemas named below are the source of truth for the client.

All paths are relative to `EXPO_PUBLIC_API_URL`, and requests use HTTPS. JSON is used unless stated otherwise. Timestamps are ISO 8601 with an offset, coordinates are decimal degrees, and mobile numbers use E.164.

## Language

Every request sends `Accept-Language` with the app language: `en`, `fr`, or `ar`. The backend uses it for any text it generates.

Alerts and push notifications send stable keys plus values such as road names and distances. The app holds the display text, so a safety alert still reads correctly offline.

## Push notifications

The backend sends through FCM and APNs directly, not the Expo push service, because Expo push has no field for translation keys. `POST /me/push-tokens` receives the device's native FCM or APNs token.

| Alert | `alertType` | Channel and category | Title key | Body key |
| --- | --- | --- | --- | --- |
| Crash detected | `crash_detected` | `crash_detected` | `alert_crash_detected_title` | `alert_crash_detected_body` |
| Potential accident | `potential_accident` | `potential_accident` | `alert_potential_accident_title` | `alert_potential_accident_body` |
| Accident nearby | `accident_nearby` | `accident_nearby` | `alert_accident_nearby_title` | `alert_accident_nearby_body` |

Rules for the backend:
- FCM sets `title_loc_key`, `body_loc_key`, and `channel_id` under `android.notification`. It also sends English `title` and `body`, because Android has no base string file for languages the app does not support.
- APNs sets `title-loc-key` and `loc-key` under `aps.alert`, and `category` under `aps`.
- Every push includes these string values: `alertId` (required and unique per alert), `alertType` (required), `roadName`, and `distanceMeters`. FCM sends them in `data`. APNs sends them in a top-level `body` object.
- Keep the same `alertId` when retrying, because the app ignores a repeat for 10 minutes.

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

The upload contains `file`, `type` (`driver_license`, `vehicle_registration`), `source` (`scan`, `upload`), `captureLanguage` (`fr`, `ar`), and `fields`, a JSON string of confirmed field values. `file` is a JPEG, PNG, or PDF.

A documents response contains `documents` and `onboardingStatus`. Each document contains `type`, `status` (`missing`, `pending`, `verified`, `rejected`), `rejectionReason`, and `updatedAt`.

Field keys are defined in #28. What is uploaded is still an open decision in #23.

## Incidents and emergency

| Method | Path | Body or query | Success |
| --- | --- | --- | --- |
| `POST` | `/incidents` | Incident | `201` incident |
| `GET` | `/incidents/nearby` | `latitude`, `longitude`, `radiusKm` | `200` `incidents` |
| `POST` | `/emergency/escalate` | Escalation | `201` escalation status |

Incident: `id`, `source` (`user_report`, `crash_detected`), `location`, `occurredAt`, `type`, `severity` (`minor`, `serious`, `critical`), `injuriesVisible`, `note`.

Escalation: `id`, `incidentId`, `trigger` (`user_requested`, `check_in_timeout`), `location`, `speedBeforeImpactKmh`, `roadName`, `roadNumber`, `shareMedicalInfo`. The response contains `id`, `status` (`escalating`, `resolved`, `canceled`), and `liveLocationUrl`.

`id` values are generated on the device, so the backend must treat a repeated `id` as the same request and return the original result.

Schemas: `src/features/safety/types/safety.schemas.ts`.

## Profile

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| `GET` | `/me` | None | `200` user |
| `PUT` | `/me` | `firstName`, `lastName`, `mobileNumber` | `200` user |
| `GET` | `/me/emergency-contacts` | None | `200` `contacts` |
| `PUT` | `/me/emergency-contacts` | `contacts` | `200` `contacts` |
| `POST` | `/me/push-tokens` | `token`, `platform` (`ios`, `android`) | `204` |

A contact contains `id`, `name`, `mobileNumber`, and `relationship`. `PUT` replaces the whole list.

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

## Offline sync

Offline sync requires a signed-in user and stays disabled until `EXPO_PUBLIC_SYNC_ENABLED` is `true`, an adapter is registered, and the endpoints exist. No sync endpoints are defined yet. The backend must deduplicate `clientOperationId`, keep client-generated IDs, and return `409` for conflicts.
