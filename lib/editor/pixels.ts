import { clamp, hslToRgb, rgbToHsl } from "@/lib/editor/color";

export type Mask = Uint8Array | null;

export function applyMasked(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mask: Mask,
  mutate: (data: Uint8ClampedArray) => void,
) {
  if (!mask) {
    mutate(data);
    return;
  }
  const before = new Uint8ClampedArray(data);
  mutate(data);
  const count = width * height;
  for (let pixel = 0; pixel < count; pixel++) {
    const amount = mask[pixel] / 255;
    const index = pixel * 4;
    if (amount >= 1) continue;
    if (amount <= 0) {
      data[index] = before[index];
      data[index + 1] = before[index + 1];
      data[index + 2] = before[index + 2];
      data[index + 3] = before[index + 3];
      continue;
    }
    for (let channel = 0; channel < 4; channel++) {
      const source = before[index + channel];
      data[index + channel] = source + (data[index + channel] - source) * amount;
    }
  }
}

export function brightnessContrast(
  data: Uint8ClampedArray,
  brightness: number,
  contrast: number,
) {
  const shift = brightness * 2.55;
  const bounded = clamp(contrast, -100, 100);
  const factor = (259 * (bounded + 255)) / (255 * (259 - bounded));
  for (let index = 0; index < data.length; index += 4) {
    data[index] = clamp(factor * (data[index] - 128) + 128 + shift, 0, 255);
    data[index + 1] = clamp(factor * (data[index + 1] - 128) + 128 + shift, 0, 255);
    data[index + 2] = clamp(factor * (data[index + 2] - 128) + 128 + shift, 0, 255);
  }
}

export function hueSaturation(
  data: Uint8ClampedArray,
  hue: number,
  saturation: number,
  lightness: number,
) {
  for (let index = 0; index < data.length; index += 4) {
    const [h, s, l] = rgbToHsl(data[index], data[index + 1], data[index + 2]);
    let nextHue = (h + hue) % 360;
    if (nextHue < 0) nextHue += 360;
    const [r, g, b] = hslToRgb(
      nextHue,
      clamp(s + saturation / 100, 0, 1),
      clamp(l + lightness / 100, 0, 1),
    );
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
  }
}

export function levels(
  data: Uint8ClampedArray,
  inBlack: number,
  inWhite: number,
  gamma: number,
  outBlack: number,
  outWhite: number,
) {
  const range = Math.max(1, inWhite - inBlack);
  const power = 1 / (gamma <= 0 ? 1 : gamma);
  const lut = new Uint8ClampedArray(256);
  for (let value = 0; value < 256; value++) {
    let t = clamp((value - inBlack) / range, 0, 1);
    t = Math.pow(t, power);
    lut[value] = clamp(outBlack + t * (outWhite - outBlack), 0, 255);
  }
  for (let index = 0; index < data.length; index += 4) {
    data[index] = lut[data[index]];
    data[index + 1] = lut[data[index + 1]];
    data[index + 2] = lut[data[index + 2]];
  }
}

export function exposure(data: Uint8ClampedArray, ev: number) {
  const gain = 2 ** ev;
  for (let index = 0; index < data.length; index += 4) {
    data[index] = clamp(data[index] * gain, 0, 255);
    data[index + 1] = clamp(data[index + 1] * gain, 0, 255);
    data[index + 2] = clamp(data[index + 2] * gain, 0, 255);
  }
}

export function invert(data: Uint8ClampedArray) {
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 255 - data[index];
    data[index + 1] = 255 - data[index + 1];
    data[index + 2] = 255 - data[index + 2];
  }
}

export function desaturate(data: Uint8ClampedArray) {
  for (let index = 0; index < data.length; index += 4) {
    const luma =
      0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    data[index] = luma;
    data[index + 1] = luma;
    data[index + 2] = luma;
  }
}

export function threshold(data: Uint8ClampedArray, level: number) {
  for (let index = 0; index < data.length; index += 4) {
    const luma =
      0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    const value = luma >= level ? 255 : 0;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
}

export function posterize(data: Uint8ClampedArray, steps: number) {
  const count = Math.max(2, Math.round(steps));
  const lut = new Uint8ClampedArray(256);
  for (let value = 0; value < 256; value++) {
    lut[value] = Math.round((value / 255) * (count - 1)) / (count - 1) * 255;
  }
  for (let index = 0; index < data.length; index += 4) {
    data[index] = lut[data[index]];
    data[index + 1] = lut[data[index + 1]];
    data[index + 2] = lut[data[index + 2]];
  }
}

export function autoLevels(data: Uint8ClampedArray) {
  for (const channel of [0, 1, 2]) {
    let min = 255;
    let max = 0;
    for (let index = channel; index < data.length; index += 4) {
      min = Math.min(min, data[index]);
      max = Math.max(max, data[index]);
    }
    if (max <= min) continue;
    const scale = 255 / (max - min);
    for (let index = channel; index < data.length; index += 4) {
      data[index] = clamp((data[index] - min) * scale, 0, 255);
    }
  }
}

export function addNoise(data: Uint8ClampedArray, amount: number) {
  const amplitude = amount * 2.55;
  for (let index = 0; index < data.length; index += 4) {
    const noise = (Math.random() - 0.5) * 2 * amplitude;
    data[index] = clamp(data[index] + noise, 0, 255);
    data[index + 1] = clamp(data[index + 1] + noise, 0, 255);
    data[index + 2] = clamp(data[index + 2] + noise, 0, 255);
  }
}

export function pixelate(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  size: number,
) {
  const block = Math.max(1, Math.round(size));
  const copy = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y += block) {
    for (let x = 0; x < width; x += block) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      const yMax = Math.min(height, y + block);
      const xMax = Math.min(width, x + block);
      for (let yy = y; yy < yMax; yy++) {
        for (let xx = x; xx < xMax; xx++) {
          const index = (yy * width + xx) * 4;
          r += copy[index];
          g += copy[index + 1];
          b += copy[index + 2];
          a += copy[index + 3];
          count++;
        }
      }
      r /= count;
      g /= count;
      b /= count;
      a /= count;
      for (let yy = y; yy < yMax; yy++) {
        for (let xx = x; xx < xMax; xx++) {
          const index = (yy * width + xx) * 4;
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = a;
        }
      }
    }
  }
}

export function vignette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.hypot(cx, cy) || 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distance = Math.hypot(x - cx, y - cy) / maxRadius;
      const falloff = clamp((distance - 0.35) / 0.65, 0, 1);
      const factor = 1 - amount * falloff * falloff;
      const index = (y * width + x) * 4;
      data[index] *= factor;
      data[index + 1] *= factor;
      data[index + 2] *= factor;
    }
  }
}

function blurAxis(
  source: Float32Array,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
) {
  const output = new Float32Array(source.length);
  const window = radius + radius + 1;
  const outer = horizontal ? height : width;
  const inner = horizontal ? width : height;
  for (let outerIndex = 0; outerIndex < outer; outerIndex++) {
    const sums = [0, 0, 0, 0];
    for (let kernel = -radius; kernel <= radius; kernel++) {
      const sample = clamp(kernel, 0, inner - 1);
      const index = horizontal
        ? (outerIndex * width + sample) * 4
        : (sample * width + outerIndex) * 4;
      sums[0] += source[index];
      sums[1] += source[index + 1];
      sums[2] += source[index + 2];
      sums[3] += source[index + 3];
    }
    for (let innerIndex = 0; innerIndex < inner; innerIndex++) {
      const index = horizontal
        ? (outerIndex * width + innerIndex) * 4
        : (innerIndex * width + outerIndex) * 4;
      output[index] = sums[0] / window;
      output[index + 1] = sums[1] / window;
      output[index + 2] = sums[2] / window;
      output[index + 3] = sums[3] / window;
      const leave = clamp(innerIndex - radius, 0, inner - 1);
      const enter = clamp(innerIndex + radius + 1, 0, inner - 1);
      const leaveIndex = horizontal
        ? (outerIndex * width + leave) * 4
        : (leave * width + outerIndex) * 4;
      const enterIndex = horizontal
        ? (outerIndex * width + enter) * 4
        : (enter * width + outerIndex) * 4;
      sums[0] += source[enterIndex] - source[leaveIndex];
      sums[1] += source[enterIndex + 1] - source[leaveIndex + 1];
      sums[2] += source[enterIndex + 2] - source[leaveIndex + 2];
      sums[3] += source[enterIndex + 3] - source[leaveIndex + 3];
    }
  }
  return output;
}

export function gaussianBlur(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
) {
  const rounded = Math.max(0, Math.round(radius));
  if (rounded < 1) return new Uint8ClampedArray(source);
  const count = width * height;
  let buffer = new Float32Array(count * 4);
  for (let pixel = 0; pixel < count; pixel++) {
    const alpha = source[pixel * 4 + 3] / 255;
    buffer[pixel * 4] = source[pixel * 4] * alpha;
    buffer[pixel * 4 + 1] = source[pixel * 4 + 1] * alpha;
    buffer[pixel * 4 + 2] = source[pixel * 4 + 2] * alpha;
    buffer[pixel * 4 + 3] = source[pixel * 4 + 3];
  }
  const box = Math.max(1, Math.round(rounded / 3));
  for (let pass = 0; pass < 3; pass++) {
    buffer = blurAxis(buffer, width, height, box, true);
    buffer = blurAxis(buffer, width, height, box, false);
  }
  const output = new Uint8ClampedArray(source.length);
  for (let pixel = 0; pixel < count; pixel++) {
    const alpha = buffer[pixel * 4 + 3];
    const inverse = alpha > 0 ? 255 / alpha : 0;
    output[pixel * 4] = clamp(buffer[pixel * 4] * inverse, 0, 255);
    output[pixel * 4 + 1] = clamp(buffer[pixel * 4 + 1] * inverse, 0, 255);
    output[pixel * 4 + 2] = clamp(buffer[pixel * 4 + 2] * inverse, 0, 255);
    output[pixel * 4 + 3] = clamp(alpha, 0, 255);
  }
  return output;
}

const SHARPEN = [0, -1, 0, -1, 5, -1, 0, -1, 0];

export function sharpen(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
) {
  const output = new Uint8ClampedArray(source);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let kernel = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const index = ((y + ky) * width + (x + kx)) * 4;
          const weight = SHARPEN[kernel++];
          r += source[index] * weight;
          g += source[index + 1] * weight;
          b += source[index + 2] * weight;
        }
      }
      const index = (y * width + x) * 4;
      output[index] = clamp(source[index] * (1 - amount) + r * amount, 0, 255);
      output[index + 1] = clamp(source[index + 1] * (1 - amount) + g * amount, 0, 255);
      output[index + 2] = clamp(source[index + 2] * (1 - amount) + b * amount, 0, 255);
    }
  }
  return output;
}

export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fill: [number, number, number, number],
  tolerance: number,
  mask: Mask,
) {
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return;
  const startIndex = startY * width + startX;
  if (mask && mask[startIndex] === 0) return;
  const origin = startIndex * 4;
  const sr = data[origin];
  const sg = data[origin + 1];
  const sb = data[origin + 2];
  const sa = data[origin + 3];
  if (sr === fill[0] && sg === fill[1] && sb === fill[2] && sa === fill[3]) return;

  const matches = (index: number) => {
    const offset = index * 4;
    return (
      Math.abs(data[offset] - sr) <= tolerance &&
      Math.abs(data[offset + 1] - sg) <= tolerance &&
      Math.abs(data[offset + 2] - sb) <= tolerance &&
      Math.abs(data[offset + 3] - sa) <= tolerance
    );
  };
  const allowed = (index: number) => matches(index) && !(mask && mask[index] === 0);
  const seen = new Uint8Array(width * height);
  const stack = [startX, startY];

  while (stack.length) {
    const cy = stack.pop() as number;
    let cx = stack.pop() as number;
    let index = cy * width + cx;
    while (cx > 0 && !seen[index - 1] && allowed(index - 1)) {
      cx--;
      index--;
    }
    let above = false;
    let below = false;
    while (cx < width && !seen[index] && allowed(index)) {
      seen[index] = 1;
      const offset = index * 4;
      data[offset] = fill[0];
      data[offset + 1] = fill[1];
      data[offset + 2] = fill[2];
      data[offset + 3] = fill[3];
      if (cy > 0) {
        const up = index - width;
        const can = !seen[up] && allowed(up);
        if (can && !above) {
          stack.push(cx, cy - 1);
          above = true;
        } else if (!can) above = false;
      }
      if (cy < height - 1) {
        const down = index + width;
        const can = !seen[down] && allowed(down);
        if (can && !below) {
          stack.push(cx, cy + 1);
          below = true;
        } else if (!can) below = false;
      }
      cx++;
      index++;
    }
  }
}

export function luminanceHistogram(data: Uint8ClampedArray) {
  const bins = new Array<number>(256).fill(0);
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    const luma = Math.round(
      0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2],
    );
    bins[luma] += 1;
  }
  return bins;
}
