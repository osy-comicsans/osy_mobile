import { resizeBilinear, type RgbaImage } from './image';

export interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_SIDE = 960;
const SIZE_STEP = 32;
const PIXEL_THRESHOLD = 0.3;
const BOX_THRESHOLD = 0.6;
const MIN_BOX_SIDE = 3;
// DB models find a shrunken core of each text line, so boxes grow back out.
const UNCLIP_RATIO = 1.6;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

// PaddleOCR models are trained on BGR images.
export function prepareDetection(image: RgbaImage) {
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const stepped = (side: number) => Math.max(SIZE_STEP, Math.round((side * scale) / SIZE_STEP) * SIZE_STEP);
  const width = stepped(image.width);
  const height = stepped(image.height);
  const { data } = resizeBilinear(image, width, height);
  const tensor = new Float32Array(3 * width * height);

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = data[pixel * 4 + 2 - channel] / 255;
      tensor[channel * width * height + pixel] = (value - MEAN[channel]) / STD[channel];
    }
  }
  return { tensor, dims: [1, 3, height, width], width, height };
}

// Groups joined pixels above the threshold, one group per line of text.
export function findTextBoxes(
  probabilities: ArrayLike<number>,
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
): TextBox[] {
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const boxes: TextBox[] = [];

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] || probabilities[start] < PIXEL_THRESHOLD) continue;

    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;
    let sum = 0;
    let count = 0;
    visited[start] = 1;
    stack.push(start);

    while (stack.length > 0) {
      const index = stack.pop() as number;
      const x = index % width;
      const y = (index - x) / width;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      sum += probabilities[index];
      count += 1;

      const neighbours = [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, y > 0 ? index - width : -1, y < height - 1 ? index + width : -1];
      for (const next of neighbours) {
        if (next >= 0 && !visited[next] && probabilities[next] >= PIXEL_THRESHOLD) {
          visited[next] = 1;
          stack.push(next);
        }
      }
    }

    const boxWidth = right - left + 1;
    const boxHeight = bottom - top + 1;
    if (sum / count < BOX_THRESHOLD || Math.min(boxWidth, boxHeight) < MIN_BOX_SIDE) continue;

    const margin = (boxWidth * boxHeight * UNCLIP_RATIO) / (2 * (boxWidth + boxHeight));
    const scaleX = imageWidth / width;
    const scaleY = imageHeight / height;
    const x = Math.max(0, Math.floor((left - margin) * scaleX));
    const y = Math.max(0, Math.floor((top - margin) * scaleY));
    boxes.push({
      x,
      y,
      width: Math.min(imageWidth, Math.ceil((right + 1 + margin) * scaleX)) - x,
      height: Math.min(imageHeight, Math.ceil((bottom + 1 + margin) * scaleY)) - y,
    });
  }
  return boxes;
}
