# Accident reports

Drivers and passengers report an accident from **Report accident** on the Home and Map tabs.

## How a report is sent

1. The location comes from a GPS fix under 5 minutes old, and **Adjust on map** can move it. With no usable fix, the pin must be placed on the map.
2. The report needs a location, a type, and a severity. Injuries, a note, and a photo are optional.
3. While the car is moving, the screen first asks whether the person is a passenger.
4. The report goes into the sync queue, and any photo is copied to `report-photos` in the app's documents folder.
5. The queue sends the report when the phone is online, the user is signed in, and the app is open. The photo follows as a separate step, so a failed upload never sends the report twice.
6. A delivered photo is deleted, and delivered reports are cleared at the next launch.

Reports use `id` values from the device, so a retry is safe. A `4xx` other than `401` or `429` stops the retries. The web build has no local database, so it sends at once, without a photo, and shows an error if that fails.

## What the backend must do

See `API_CONTRACT.md`: `POST /incidents`, `POST /incidents/{id}/photo`, duplicate merging, and abuse protection. The mock accepts reports and photos, and stores neither.

## Limits

- Queued reports are sent only while the app is open, not in the background.
- A report still queued at sign-out is sent by the next account to sign in on that phone.
