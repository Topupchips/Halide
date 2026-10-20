export type ToolId =
  | "move"
  | "marquee"
  | "ellipse-select"
  | "lasso"
  | "crop"
  | "eyedropper"
  | "brush"
  | "eraser"
  | "bucket"
  | "gradient"
  | "clone"
  | "text"
  | "shape"
  | "ellipse-shape"
  | "hand"
  | "zoom";

export type SelectMode = "replace" | "add" | "subtract";

export type BlendMode = GlobalCompositeOperation;

export type Ants =
  | { kind: "rect" | "ellipse"; x: number; y: number; w: number; h: number }
  | { kind: "poly"; points: { x: number; y: number }[] };

export type AdjustKind =
  | "brightness"
  | "hue"
  | "levels"
  | "exposure"
  | "threshold"
  | "posterize"
  | "blur"
  | "noise"
  | "pixelate"
  | "vignette"
  | "sharpen";

export type FieldSpec = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
};
