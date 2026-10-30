export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export function resizeBilinear(image: RgbaImage, width: number, height: number): RgbaImage {
  const { width: sourceWidth, height: sourceHeight, data: source } = image;
  const data = new Uint8Array(width * height * 4);
  const scaleX = sourceWidth / width;
  const scaleY = sourceHeight / height;

  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.max(0, (y + 0.5) * scaleY - 0.5);
    const top = Math.floor(sourceY);
    const bottom = Math.min(top + 1, sourceHeight - 1);
    const weightY = sourceY - top;

    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.max(0, (x + 0.5) * scaleX - 0.5);
      const left = Math.floor(sourceX);
      const right = Math.min(left + 1, sourceWidth - 1);
      const weightX = sourceX - left;

      for (let channel = 0; channel < 4; channel += 1) {
        const upper = source[(top * sourceWidth + left) * 4 + channel] * (1 - weightX)
          + source[(top * sourceWidth + right) * 4 + channel] * weightX;
        const lower = source[(bottom * sourceWidth + left) * 4 + channel] * (1 - weightX)
          + source[(bottom * sourceWidth + right) * 4 + channel] * weightX;
        data[(y * width + x) * 4 + channel] = upper * (1 - weightY) + lower * weightY;
      }
    }
  }
  return { width, height, data };
}

export function cropImage(image: RgbaImage, x: number, y: number, width: number, height: number): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const start = ((y + row) * image.width + x) * 4;
    data.set(image.data.subarray(start, start + width * 4), row * width * 4);
  }
  return { width, height, data };
}
