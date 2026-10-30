import { resizeBilinear, type RgbaImage } from './image';

const INPUT_HEIGHT = 48;
const MIN_WIDTH = 48;
const MAX_WIDTH = 960;

export function prepareRecognition(crop: RgbaImage) {
  const scaled = Math.round((crop.width * INPUT_HEIGHT) / crop.height);
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, scaled));
  const { data } = resizeBilinear(crop, width, INPUT_HEIGHT);
  const tensor = new Float32Array(3 * width * INPUT_HEIGHT);

  for (let pixel = 0; pixel < width * INPUT_HEIGHT; pixel += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      tensor[channel * width * INPUT_HEIGHT + pixel] = (data[pixel * 4 + 2 - channel] / 255 - 0.5) / 0.5;
    }
  }
  return { tensor, dims: [1, 3, INPUT_HEIGHT, width] };
}

// Index 0 is the CTC blank, and the class after the dictionary is a space.
export function ctcDecode(scores: ArrayLike<number>, dims: readonly number[], dictionary: readonly string[]) {
  const [, steps, classes] = dims;
  let text = '';
  let sum = 0;
  let count = 0;
  let previous = 0;

  for (let step = 0; step < steps; step += 1) {
    let best = 0;
    let bestScore = -Infinity;
    for (let index = 0; index < classes; index += 1) {
      const score = scores[step * classes + index];
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    }
    if (best !== 0 && best !== previous) {
      text += best - 1 < dictionary.length ? dictionary[best - 1] : ' ';
      sum += bestScore;
      count += 1;
    }
    previous = best;
  }
  return { text: text.trim(), confidence: count > 0 ? sum / count : 0 };
}

const ARABIC = /[؀-ۿ]/;
const LATIN_OR_DIGIT_RUN = /[A-Za-z0-9.,:/-]+/g;

// The model reads pixels left to right, which is backwards for Arabic text.
export function toReadingOrder(text: string): string {
  if (!ARABIC.test(text)) return text;
  return [...text].reverse().join('')
    .replace(LATIN_OR_DIGIT_RUN, (run) => [...run].reverse().join(''));
}
