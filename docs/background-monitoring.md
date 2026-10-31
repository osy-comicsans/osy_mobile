# Background monitoring

With "Always" location access, crash detection keeps running while the app is in the background or the phone is locked. Without it, tracking stops when the user leaves the app, as before.

## How it works

1. A task in `src/features/location/native/backgroundLocation.ts` receives location updates and feeds them into the normal location service.
2. Those updates keep the app alive, so the crash sensors and check-in timers keep running.
3. Sensors still run only while driving.
4. Trips for the driving stats on Profile are recorded from the same updates.

| State | GPS in the background |
|---|---|
| Stationary or walking | Balanced accuracy, every 30 seconds or 100 m |
| Driving | Full accuracy, every second |

On Android, a foreground service shows a notification while this runs. Android only lets it start while the app is visible, so it starts when driving begins, and again when the user leaves the app. Each start reads the crash detection setting: the notification says detection is on only when it is, and otherwise says the app is using the location.

## Patches

`expo-sensors` stops all sensors when an Android app goes to the background. `patches/expo-sensors@58.0.4.patch` removes that, because the app stops its own sensors when not driving. Check this patch again when upgrading Expo.

## Testing

In a development build, open Settings and press **Simulate a crash in 15 s**, then lock the phone. The crash notification should arrive.

This needs a real device. Location and sensors behave differently in the Simulator.

## Limits

- If the user force-quits the app, monitoring stops. Android does not restart it, and iOS may not.
- Android phone makers can kill background apps, so reliability varies by device.
- With the screen off, Android may deliver sensor readings late or in batches, which could affect impact detection.
- Timers rely on the app staying alive, which is not guaranteed.
- App store review requires a clear reason for "Always" location. The text in the app is a draft.
