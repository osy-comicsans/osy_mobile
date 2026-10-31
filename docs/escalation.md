# Emergency escalation

When a driver presses "I need help", or a check-in times out, `escalationService` sends a request for help. **Until a real backend exists, this goes to the mock backend, and nobody is contacted.** The screen says so with a test mode label.

## How it works

1. It creates an incident, then sends the escalation with location, speed before impact, and road name and number.
2. If that fails, it retries every 15 seconds with the same IDs, so the server sees one request. The request is saved in SecureStore, so it survives the app closing.
3. Once sent, it shares the latest location every 30 seconds until canceled.
4. "I'm OK" cancels it. An unsent request never goes out.

Each step is recorded in an audit trail on the device. The server keeps the lasting record.

The call button uses `tel:14` and needs the user's tap, because apps cannot place calls alone.

Emergency contacts are managed from Profile, through `GET` and `PUT /me/emergency-contacts`.

## What the backend must do

- Notify emergency contacts by SMS or push, with a live location link in `liveLocationUrl`.
- Treat a repeated `id` as the same request.
- Accept `POST /emergency/escalate/{id}/location` and `/cancel`.
- Tell contacts when a request is canceled.

## Not built yet

- Real SMS, push, and live location pages. These need the backend.
- Medical info: `shareMedicalInfo` is always false, because it needs consent and is not collected.
- A contact list stored on the phone for offline use. Contacts are read from the server.
- Confirming the emergency number before release.
