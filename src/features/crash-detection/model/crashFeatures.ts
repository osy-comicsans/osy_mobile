// A port of `extract()` from the VZCrash training notebook. The model has no feature
// names, only positions, so the order here must never change. tests/crash-model.test.cjs
// compares this with the notebook's own output.

export const SAMPLE_HZ = 100;
export const WINDOW_SECONDS = 16;
export const WINDOW_SAMPLES = SAMPLE_HZ * WINDOW_SECONDS;

export interface ModelWindow {
  // Interleaved x, y, z for 1600 samples: acceleration in g, rotation in deg/s.
  acceleration: Float32Array;
  rotation: Float32Array;
  // One speed per second, in km/h.
  speed: Float32Array;
}

const VEHICLE_SIZE_UNKNOWN = 3;
const GYRO_STANDARD_RESOLUTION = 0;

const mean = (values: ArrayLike<number>) => {
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += values[i];
  return sum / values.length;
};

const std = (values: ArrayLike<number>) => {
  const average = mean(values);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += (values[i] - average) ** 2;
  return Math.sqrt(sum / values.length);
};

function argMax(values: ArrayLike<number>) {
  let best = 0;
  for (let i = 1; i < values.length; i += 1) if (values[i] > values[best]) best = i;
  return best;
}

function argMin(values: ArrayLike<number>) {
  let best = 0;
  for (let i = 1; i < values.length; i += 1) if (values[i] < values[best]) best = i;
  return best;
}

const axis = (signal: Float32Array, index: number) => {
  const values = new Float32Array(WINDOW_SAMPLES);
  for (let i = 0; i < WINDOW_SAMPLES; i += 1) values[i] = signal[i * 3 + index];
  return values;
};

function pushAxisStats(signal: Float32Array, out: number[]) {
  for (let index = 0; index < 3; index += 1) {
    const values = axis(signal, index);
    let min = Infinity;
    let max = -Infinity;
    let absMax = 0;
    let squares = 0;
    for (const value of values) {
      min = Math.min(min, value);
      max = Math.max(max, value);
      absMax = Math.max(absMax, Math.abs(value));
      squares += value * value;
    }
    out.push(mean(values), std(values), min, max, absMax, max - min, Math.sqrt(squares / values.length));
  }
}

function pushMagnitudeStats(signal: Float32Array, out: number[]) {
  const perSecond = new Float32Array(WINDOW_SECONDS);
  for (let second = 0; second < WINDOW_SECONDS; second += 1) {
    let peak = -Infinity;
    for (let i = second * SAMPLE_HZ; i < (second + 1) * SAMPLE_HZ; i += 1) peak = Math.max(peak, signal[i]);
    perSecond[second] = peak;
  }
  out.push(mean(signal), std(signal), signal[argMax(signal)], argMax(signal) / SAMPLE_HZ);
  out.push(...perSecond, argMax(perSecond));
}

const norm = (signal: Float32Array) => {
  const values = new Float32Array(WINDOW_SAMPLES);
  for (let i = 0; i < WINDOW_SAMPLES; i += 1) {
    values[i] = Math.hypot(signal[i * 3], signal[i * 3 + 1], signal[i * 3 + 2]);
  }
  return values;
};

export function extractFeatures({ acceleration, rotation, speed }: ModelWindow): Float32Array {
  const out: number[] = [];

  pushAxisStats(acceleration, out);
  pushMagnitudeStats(norm(acceleration).map((value) => Math.abs(value - 1)), out);

  const jerkPeaks = [0, 0, 0];
  let jerkNorm = 0;
  for (let i = 0; i < WINDOW_SAMPLES - 1; i += 1) {
    let squares = 0;
    for (let index = 0; index < 3; index += 1) {
      const jerk = (acceleration[(i + 1) * 3 + index] - acceleration[i * 3 + index]) * SAMPLE_HZ;
      jerkPeaks[index] = Math.max(jerkPeaks[index], Math.abs(jerk));
      squares += jerk * jerk;
    }
    jerkNorm = Math.max(jerkNorm, Math.sqrt(squares));
  }
  out.push(...jerkPeaks, jerkNorm);

  pushAxisStats(rotation, out);
  pushMagnitudeStats(norm(rotation), out);

  const changes = new Float32Array(WINDOW_SECONDS - 1);
  for (let i = 0; i < changes.length; i += 1) changes[i] = speed[i + 1] - speed[i];
  out.push(
    ...speed,
    mean(speed),
    Math.max(...speed),
    Math.min(...speed),
    std(speed),
    Math.min(...changes),
    Math.max(...changes),
    speed[WINDOW_SECONDS - 1] - speed[0],
    argMin(changes),
    VEHICLE_SIZE_UNKNOWN,
    GYRO_STANDARD_RESOLUTION,
  );
  return Float32Array.from(out, (value) => (Number.isFinite(value) ? value : 0));
}
