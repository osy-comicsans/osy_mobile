# Crash model

`assets/models/vzcrash_xgb.onnx` runs on the phone beside the rule-based detector. It can add a detection, but it never replaces the rules. It needs a development build. In Expo Go the app uses the rules alone.

## How it works

1. A jolt of 1.5 g or more while moving at 20 km/h or faster opens a candidate.
2. 8 seconds later, the last 16 seconds of sensor data are prepared for the model:
   - resampled from 50 Hz to 100 Hz
   - rotated into a vehicle frame
   - rotation converted to deg/s
3. `extractFeatures()` computes the 114 features, in the same order as the training notebook.
4. A crash score of 0.5 or more raises the normal check-in (detection). A near-miss score of 0.5 or more raises the `potential_accident` warning (prediction), telling the driver to slow down.

The model runs only on candidates because it was trained on flagged events, not ordinary driving. A crash already raised by the rules within 60 seconds is not raised twice.

## Changing the features

`tests/fixtures/crash-features.json` holds the notebook's `extract()` output for two test signals. If the model is retrained with different features, regenerate this file.

## To confirm

- **Impact position:** `IMPACT_OFFSET_SECONDS` assumes the impact is 8 seconds into the window. The timing features depend on this.
- **Threshold:** `CRASH_THRESHOLD` is the notebook's default. Choose it from validation data.
- **Forward direction:** a phone cannot tell which way the car faces, so the code assumes a frontal impact. Side and rear crashes have swapped axes.
- **Vehicle size:** always sent as `Unknown`.
- **Dataset licence:** check it before shipping.

## Accuracy so far

The model was trained on 10,000 of the 137,954 training events. On 5,000 validation events, which held only 10 crashes, crash precision was 0.35 and recall 0.60. These results are from vehicle-mounted sensors, not phones, so accuracy on phones is unknown.

## Prediction limits

The warning follows a near miss that has already happened: it signals raised risk, and it does not forecast a specific crash. The model scores a window around an event, about 8 seconds after it, so it cannot warn before a first impact.

## Checking on a phone

In a development build, open Settings and run **Crash model check**. It reads the real sensors for 16 seconds and shows the three scores, the sensor rates and any model error. It needs no driving and raises no alert. **Simulate a crash** does not use the model.
