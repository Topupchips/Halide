import type { BlendMode, ToolId } from "@/lib/editor/types";

export type ToolMeta = {
  id: ToolId;
  label: string;
  shortcut: string;
  hint: string;
};

export const TOOLS: Record<ToolId, ToolMeta> = {
  move: {
    id: "move",
    label: "Move",
    shortcut: "V",
    hint: "Drag the layer. Arrows nudge 1px, Shift nudges 10.",
  },
  marquee: {
    id: "marquee",
    label: "Rectangular marquee",
    shortcut: "M",
    hint: "Drag a rectangle. Shift constrains a square. Alt draws from the center.",
  },
  "ellipse-select": {
    id: "ellipse-select",
    label: "Elliptical marquee",
    shortcut: "M",
    hint: "Drag an ellipse. Shift constrains a circle. Alt draws from the center.",
  },
  lasso: {
    id: "lasso",
    label: "Lasso",
    shortcut: "L",
    hint: "Draw a freeform selection. It closes when you release.",
  },
  crop: {
    id: "crop",
    label: "Crop",
    shortcut: "C",
    hint: "Drag the crop. Enter applies it. Escape cancels.",
  },
  eyedropper: {
    id: "eyedropper",
    label: "Eyedropper",
    shortcut: "I",
    hint: "Click to sample the composite color. Alt-click samples while brushing.",
  },
  brush: {
    id: "brush",
    label: "Brush",
    shortcut: "B",
    hint: "Paint with the foreground color. [ and ] change size.",
  },
  eraser: {
    id: "eraser",
    label: "Eraser",
    shortcut: "E",
    hint: "Erase to transparency. Hardness controls the edge.",
  },
  bucket: {
    id: "bucket",
    label: "Paint bucket",
    shortcut: "G",
    hint: "Fill a connected area. Raise tolerance to cross soft edges.",
  },
  gradient: {
    id: "gradient",
    label: "Gradient",
    shortcut: "G",
    hint: "Drag from foreground to background.",
  },
  clone: {
    id: "clone",
    label: "Clone stamp",
    shortcut: "S",
    hint: "Alt-click to set the source, then paint to copy it.",
  },
  text: {
    id: "text",
    label: "Text",
    shortcut: "T",
    hint: "Click to place type. Enter commits. Shift+Enter adds a line.",
  },
  shape: {
    id: "shape",
    label: "Rectangle",
    shortcut: "U",
    hint: "Drag a rectangle. Shift constrains a square.",
  },
  "ellipse-shape": {
    id: "ellipse-shape",
    label: "Ellipse",
    shortcut: "U",
    hint: "Drag an ellipse. Shift constrains a circle.",
  },
  hand: {
    id: "hand",
    label: "Hand",
    shortcut: "H",
    hint: "Drag to pan. Hold Space for a temporary hand.",
  },
  zoom: {
    id: "zoom",
    label: "Zoom",
    shortcut: "Z",
    hint: "Click to zoom in. Alt-click zooms out. Drag to magnify a region.",
  },
};

export const RAIL: { id: ToolId; family?: ToolId[] }[] = [
  { id: "move" },
  { id: "marquee", family: ["marquee", "ellipse-select"] },
  { id: "lasso" },
  { id: "crop" },
  { id: "eyedropper" },
  { id: "brush" },
  { id: "eraser" },
  { id: "bucket", family: ["bucket", "gradient"] },
  { id: "clone" },
  { id: "text" },
  { id: "shape", family: ["shape", "ellipse-shape"] },
  { id: "hand" },
  { id: "zoom" },
];

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: "source-over", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color dodge" },
  { value: "color-burn", label: "Color burn" },
  { value: "hard-light", label: "Hard light" },
  { value: "soft-light", label: "Soft light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
];

export const PRESETS = [
  { label: "HD", width: 1920, height: 1080 },
  { label: "Square", width: 1080, height: 1080 },
  { label: "Story", width: 1080, height: 1920 },
  { label: "Postcard", width: 1200, height: 800 },
  { label: "Screen", width: 1440, height: 900 },
];
