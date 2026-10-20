import {
  addNoise,
  autoLevels,
  brightnessContrast,
  desaturate,
  exposure,
  gaussianBlur,
  hueSaturation,
  invert,
  levels,
  pixelate,
  posterize,
  sharpen,
  threshold,
  vignette,
} from "@/lib/editor/pixels";
import type { AdjustKind, FieldSpec } from "@/lib/editor/types";

export const ADJUST_FIELDS: Record<AdjustKind, FieldSpec[]> = {
  brightness: [
    { key: "brightness", label: "Brightness", min: -100, max: 100, step: 1, value: 0 },
    { key: "contrast", label: "Contrast", min: -100, max: 100, step: 1, value: 0 },
  ],
  hue: [
    { key: "hue", label: "Hue", min: -180, max: 180, step: 1, value: 0 },
    { key: "saturation", label: "Saturation", min: -100, max: 100, step: 1, value: 0 },
    { key: "lightness", label: "Lightness", min: -100, max: 100, step: 1, value: 0 },
  ],
  levels: [
    { key: "inBlack", label: "Input black", min: 0, max: 255, step: 1, value: 0 },
    { key: "gamma", label: "Midtones", min: 0.1, max: 3, step: 0.01, value: 1 },
    { key: "inWhite", label: "Input white", min: 0, max: 255, step: 1, value: 255 },
    { key: "outBlack", label: "Output black", min: 0, max: 255, step: 1, value: 0 },
    { key: "outWhite", label: "Output white", min: 0, max: 255, step: 1, value: 255 },
  ],
  exposure: [{ key: "ev", label: "Exposure", min: -3, max: 3, step: 0.05, value: 0 }],
  threshold: [{ key: "level", label: "Threshold", min: 1, max: 255, step: 1, value: 128 }],
  posterize: [{ key: "steps", label: "Levels", min: 2, max: 16, step: 1, value: 4 }],
  blur: [{ key: "radius", label: "Radius", min: 0, max: 40, step: 1, value: 4 }],
  noise: [{ key: "amount", label: "Amount", min: 0, max: 100, step: 1, value: 12 }],
  pixelate: [{ key: "size", label: "Cell size", min: 2, max: 64, step: 1, value: 8 }],
  vignette: [{ key: "amount", label: "Amount", min: 0, max: 1, step: 0.01, value: 0.45 }],
  sharpen: [{ key: "amount", label: "Amount", min: 0, max: 2, step: 0.05, value: 0.6 }],
};

export const ADJUST_LABELS: Record<AdjustKind, string> = {
  brightness: "Brightness / Contrast",
  hue: "Hue / Saturation",
  levels: "Levels",
  exposure: "Exposure",
  threshold: "Threshold",
  posterize: "Posterize",
  blur: "Gaussian blur",
  noise: "Add noise",
  pixelate: "Pixelate",
  vignette: "Vignette",
  sharpen: "Sharpen",
};

export function defaultAdjustValues(kind: AdjustKind) {
  return Object.fromEntries(ADJUST_FIELDS[kind].map((field) => [field.key, field.value]));
}

export function runAdjust(
  kind: AdjustKind,
  values: Record<string, number>,
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  switch (kind) {
    case "brightness":
      brightnessContrast(data, values.brightness, values.contrast);
      break;
    case "hue":
      hueSaturation(data, values.hue, values.saturation, values.lightness);
      break;
    case "levels":
      levels(data, values.inBlack, values.inWhite, values.gamma, values.outBlack, values.outWhite);
      break;
    case "exposure":
      exposure(data, values.ev);
      break;
    case "threshold":
      threshold(data, values.level);
      break;
    case "posterize":
      posterize(data, values.steps);
      break;
    case "blur":
      data.set(gaussianBlur(data, width, height, values.radius));
      break;
    case "noise":
      addNoise(data, values.amount);
      break;
    case "pixelate":
      pixelate(data, width, height, values.size);
      break;
    case "vignette":
      vignette(data, width, height, values.amount);
      break;
    case "sharpen":
      data.set(sharpen(data, width, height, values.amount));
      break;
    default:
      break;
  }
}

export function runInstant(
  kind: "invert" | "desaturate" | "auto",
  data: Uint8ClampedArray,
) {
  if (kind === "invert") invert(data);
  else if (kind === "desaturate") desaturate(data);
  else autoLevels(data);
}
