import { runAdjust, runInstant } from "@/lib/editor/adjust";
import { cloneCanvas, createCanvas, downloadBlob } from "@/lib/editor/canvas";
import { clamp, hexToRgb, rgbToHex } from "@/lib/editor/color";
import type { Point, Rect } from "@/lib/editor/geom";
import { applyMasked, floodFill, luminanceHistogram } from "@/lib/editor/pixels";
import type { AdjustKind, Ants, BlendMode, SelectMode } from "@/lib/editor/types";
import { paintStudio } from "@/lib/editor/sample";

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  x: number;
  y: number;
  canvas: HTMLCanvasElement;
};

export type Selection = {
  canvas: HTMLCanvasElement;
  ants: Ants | null;
  edges?: HTMLCanvasElement;
};

type Snapshot = {
  label: string;
  name: string;
  width: number;
  height: number;
  activeId: string | null;
  layers: Layer[];
  selection: Selection | null;
};

type Stroke = {
  mode: "paint" | "erase" | "clone";
  layerId: string;
  scratch: HTMLCanvasElement;
  sample: HTMLCanvasElement | null;
  size: number;
  hardness: number;
  alpha: number;
  color: string;
  offset: Point;
  last: Point | null;
  remainder: number;
  dirty: boolean;
};

type MoveState = {
  layerId: string;
  base: HTMLCanvasElement;
  baseX: number;
  baseY: number;
  baseSel: HTMLCanvasElement | null;
  baseAnts: Ants | null;
  dirty: boolean;
};

export type SessionEvent = "change" | "composite" | "view";
type Listener = (event: SessionEvent) => void;

const HISTORY_LIMIT = 20;

function stampBrush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  hardness: number,
  color: string,
  alpha: number,
) {
  const [r, g, b] = hexToRgb(color);
  ctx.save();
  if (hardness >= 0.98) {
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const gradient = ctx.createRadialGradient(x, y, radius * hardness, x, y, Math.max(radius, 0.5));
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function shiftAnts(ants: Ants | null, dx: number, dy: number): Ants | null {
  if (!ants) return null;
  if (ants.kind === "poly") {
    return { kind: "poly", points: ants.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
  }
  return { ...ants, x: ants.x + dx, y: ants.y + dy };
}

export class EditorSession {
  hasDoc = false;
  name = "Untitled";
  width = 0;
  height = 0;
  docEpoch = 0;
  layers: Layer[] = [];
  activeId: string | null = null;
  selection: Selection | null = null;
  crop: Rect | null = null;
  foreground = "#1c1612";
  background = "#f4efe6";
  zoom = 1;
  showRulers = true;
  showGrid = false;
  notice: string | null = null;
  cloneSource: Point | null = null;
  pointer: Point | null = null;
  revision = 0;
  past: Snapshot[] = [];
  future: Snapshot[] = [];

  private seq = 1;
  private listeners = new Set<Listener>();
  private stroke: Stroke | null = null;
  private move: MoveState | null = null;
  private preview: HTMLCanvasElement | null = null;
  private clipboard: HTMLCanvasElement | null = null;
  private clipboardPos: Point | null = null;
  private docBuffer: HTMLCanvasElement | null = null;
  private pickBuffer: HTMLCanvasElement | null = null;
  private maskBuffer: HTMLCanvasElement | null = null;
  private stampBuffer: HTMLCanvasElement | null = null;
  private frame = 0;
  viewHandlers = new Set<(command: "fit" | "actual" | "in" | "out") => void>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: SessionEvent) {
    this.revision += 1;
    for (const listener of this.listeners) listener(event);
  }

  requestView(command: "fit" | "actual" | "in" | "out") {
    for (const handler of this.viewHandlers) handler(command);
  }

  active() {
    return this.layers.find((layer) => layer.id === this.activeId) ?? null;
  }

  newDocument(options: {
    width: number;
    height: number;
    background: string;
    name?: string;
  }) {
    this.discardTransient();
    this.width = clamp(Math.round(options.width), 1, 8192);
    this.height = clamp(Math.round(options.height), 1, 8192);
    this.name = options.name ?? "Untitled";
    this.layers = [];
    this.past = [];
    this.future = [];
    this.selection = null;
    this.crop = null;
    this.cloneSource = null;
    const transparent = options.background === "transparent";
    const layer = this.makeLayer(transparent ? "Layer 1" : "Background", !transparent);
    if (!transparent) {
      const ctx = layer.canvas.getContext("2d")!;
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    this.layers = [layer];
    this.activeId = layer.id;
    this.hasDoc = true;
    this.docEpoch += 1;
    this.notice = null;
    this.emit("change");
  }

  openImage(image: CanvasImageSource, sourceWidth: number, sourceHeight: number, name: string) {
    const maxEdge = 4096;
    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    this.newDocument({ width, height, background: "transparent", name });
    const layer = this.active()!;
    layer.name = "Background";
    layer.canvas.getContext("2d")!.drawImage(image, 0, 0, width, height);
    this.past = [];
    this.future = [];
    this.emit("change");
  }

  addImageLayer(image: CanvasImageSource, sourceWidth: number, sourceHeight: number, name: string) {
    if (!this.hasDoc) {
      this.openImage(image, sourceWidth, sourceHeight, name);
      return;
    }
    this.pushHistory("Place image");
    const layer = this.makeLayer(name.replace(/\.[^.]+$/, "") || "Image");
    const scale = Math.min(1, this.width / sourceWidth, this.height / sourceHeight);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const x = Math.round((this.width - width) / 2);
    const y = Math.round((this.height - height) / 2);
    layer.canvas.getContext("2d")!.drawImage(image, x, y, width, height);
    this.layers.push(layer);
    this.activeId = layer.id;
    this.emit("change");
  }

  loadSample() {
    paintStudio(this);
    this.past = [];
    this.future = [];
    this.docEpoch += 1;
    this.emit("change");
  }

  addLayer(name = "Layer", history = true) {
    if (!this.hasDoc) return null;
    if (history) this.pushHistory("New layer");
    const layer = this.makeLayer(this.uniqueName(name));
    const index = Math.max(0, this.layers.findIndex((item) => item.id === this.activeId) + 1);
    this.layers.splice(index, 0, layer);
    this.activeId = layer.id;
    this.emit("change");
    return layer;
  }

  deleteLayer(id: string) {
    if (this.layers.length <= 1) {
      this.notice = "The last layer stays on the plate.";
      this.emit("change");
      return;
    }
    const index = this.layers.findIndex((layer) => layer.id === id);
    if (index < 0) return;
    this.pushHistory("Delete layer");
    this.layers.splice(index, 1);
    if (this.activeId === id) {
      this.activeId = this.layers[Math.min(index, this.layers.length - 1)]?.id ?? null;
    }
    this.emit("change");
  }

  duplicate(id: string) {
    const index = this.layers.findIndex((layer) => layer.id === id);
    const layer = this.layers[index];
    if (!layer) return;
    this.pushHistory("Duplicate layer");
    const copy: Layer = {
      ...layer,
      id: `layer-${this.seq++}`,
      name: this.uniqueName(`${layer.name} copy`),
      locked: false,
      canvas: cloneCanvas(layer.canvas),
    };
    this.layers.splice(index + 1, 0, copy);
    this.activeId = copy.id;
    this.emit("change");
  }

  mergeDown(id: string) {
    const index = this.layers.findIndex((layer) => layer.id === id);
    if (index <= 0) return;
    const upper = this.layers[index];
    const lower = this.layers[index - 1];
    if (lower.locked) {
      this.notice = `${lower.name} is locked.`;
      this.emit("change");
      return;
    }
    this.pushHistory("Merge down");
    const ctx = lower.canvas.getContext("2d")!;
    ctx.save();
    ctx.globalAlpha = upper.opacity;
    ctx.globalCompositeOperation = upper.blendMode;
    ctx.drawImage(upper.canvas, upper.x - lower.x, upper.y - lower.y);
    ctx.restore();
    this.layers.splice(index, 1);
    this.activeId = lower.id;
    this.emit("change");
  }

  flatten() {
    if (!this.hasDoc) return;
    this.endStroke();
    this.pushHistory("Flatten");
    const canvas = createCanvas(this.width, this.height);
    this.paint(canvas.getContext("2d")!);
    const layer = this.makeLayer("Flattened");
    layer.canvas = canvas;
    this.layers = [layer];
    this.activeId = layer.id;
    this.selection = null;
    this.emit("change");
  }

  reorder(id: string, overId: string) {
    if (id === overId) return;
    const from = this.layers.findIndex((layer) => layer.id === id);
    const to = this.layers.findIndex((layer) => layer.id === overId);
    if (from < 0 || to < 0) return;
    this.pushHistory("Reorder layer");
    const [layer] = this.layers.splice(from, 1);
    this.layers.splice(to, 0, layer);
    this.emit("change");
  }

  setActive(id: string) {
    if (!this.layers.some((layer) => layer.id === id)) return;
    this.activeId = id;
    this.emit("change");
  }

  setVisibility(id: string, visible: boolean) {
    const layer = this.layers.find((item) => item.id === id);
    if (!layer || layer.visible === visible) return;
    this.pushHistory("Layer visibility");
    layer.visible = visible;
    this.emit("change");
  }

  solo(id: string) {
    if (!this.layers.some((layer) => layer.id === id)) return;
    const othersHidden = this.layers.every((layer) => layer.id === id || !layer.visible);
    this.pushHistory("Layer visibility");
    for (const layer of this.layers) layer.visible = othersHidden ? true : layer.id === id;
    this.emit("change");
  }

  setLocked(id: string, locked: boolean) {
    const layer = this.layers.find((item) => item.id === id);
    if (!layer) return;
    layer.locked = locked;
    this.emit("change");
  }

  setOpacity(id: string, opacity: number) {
    const layer = this.layers.find((item) => item.id === id);
    if (!layer) return;
    layer.opacity = clamp(opacity, 0, 1);
    this.emit("change");
  }

  setBlend(id: string, blendMode: BlendMode) {
    const layer = this.layers.find((item) => item.id === id);
    if (!layer || layer.blendMode === blendMode) return;
    this.pushHistory("Blend mode");
    layer.blendMode = blendMode;
    this.emit("change");
  }

  rename(id: string, name: string) {
    const layer = this.layers.find((item) => item.id === id);
    const next = name.trim();
    if (!layer || !next || layer.name === next) return;
    this.pushHistory("Rename layer");
    layer.name = next;
    this.emit("change");
  }

  setForeground(color: string) {
    this.foreground = color;
    this.emit("change");
  }

  setBackground(color: string) {
    this.background = color;
    this.emit("change");
  }

  swapColors() {
    const next = this.foreground;
    this.foreground = this.background;
    this.background = next;
    this.emit("change");
  }

  resetColors() {
    this.foreground = "#1c1612";
    this.background = "#f4efe6";
    this.emit("change");
  }

  setZoom(zoom: number) {
    this.zoom = clamp(zoom, 0.05, 32);
    this.emit("view");
  }

  toggleRulers() {
    this.showRulers = !this.showRulers;
    this.emit("view");
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    this.emit("view");
  }

  setCrop(rect: Rect | null, silent = false) {
    this.crop = rect;
    if (!silent) this.emit("view");
  }

  applyCrop() {
    if (!this.crop || !this.hasDoc) return;
    const x = Math.round(this.crop.x);
    const y = Math.round(this.crop.y);
    const w = Math.round(this.crop.w);
    const h = Math.round(this.crop.h);
    if (w < 1 || h < 1) return;
    this.pushHistory("Crop");
    for (const layer of this.layers) {
      const next = createCanvas(w, h);
      next.getContext("2d")!.drawImage(layer.canvas, layer.x - x, layer.y - y);
      layer.canvas = next;
      layer.x = 0;
      layer.y = 0;
    }
    this.width = w;
    this.height = h;
    this.selection = null;
    this.crop = null;
    this.docEpoch += 1;
    this.emit("change");
  }

  resize(width: number, height: number) {
    if (!this.hasDoc) return;
    const nextWidth = clamp(Math.round(width), 1, 8192);
    const nextHeight = clamp(Math.round(height), 1, 8192);
    if (nextWidth === this.width && nextHeight === this.height) return;
    this.pushHistory("Image size");
    const sx = nextWidth / this.width;
    const sy = nextHeight / this.height;
    for (const layer of this.layers) {
      const next = createCanvas(nextWidth, nextHeight);
      const ctx = next.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        layer.canvas,
        layer.x * sx,
        layer.y * sy,
        layer.canvas.width * sx,
        layer.canvas.height * sy,
      );
      layer.canvas = next;
      layer.x = 0;
      layer.y = 0;
    }
    this.width = nextWidth;
    this.height = nextHeight;
    this.selection = null;
    this.crop = null;
    this.docEpoch += 1;
    this.emit("change");
  }

  flip(axis: "h" | "v", scope: "layer" | "canvas") {
    if (!this.hasDoc) return;
    const targets = scope === "canvas" ? this.layers : this.active() ? [this.active()!] : [];
    if (!targets.length) return;
    if (scope === "layer" && targets[0].locked) {
      this.notice = `${targets[0].name} is locked.`;
      this.emit("change");
      return;
    }
    this.pushHistory(axis === "h" ? "Flip horizontal" : "Flip vertical");
    for (const layer of targets) {
      const doc = createCanvas(this.width, this.height);
      doc.getContext("2d")!.drawImage(layer.canvas, layer.x, layer.y);
      const next = createCanvas(this.width, this.height);
      const ctx = next.getContext("2d")!;
      if (axis === "h") {
        ctx.translate(this.width, 0);
        ctx.scale(-1, 1);
      } else {
        ctx.translate(0, this.height);
        ctx.scale(1, -1);
      }
      ctx.drawImage(doc, 0, 0);
      layer.canvas = next;
      layer.x = 0;
      layer.y = 0;
    }
    if (scope === "canvas") this.selection = null;
    this.emit("change");
  }

  rotateCanvas(direction: 1 | -1) {
    if (!this.hasDoc) return;
    this.pushHistory(direction === 1 ? "Rotate canvas clockwise" : "Rotate canvas counterclockwise");
    const nextWidth = this.height;
    const nextHeight = this.width;
    for (const layer of this.layers) {
      const doc = createCanvas(this.width, this.height);
      doc.getContext("2d")!.drawImage(layer.canvas, layer.x, layer.y);
      const next = createCanvas(nextWidth, nextHeight);
      const ctx = next.getContext("2d")!;
      if (direction === 1) {
        ctx.translate(nextWidth, 0);
        ctx.rotate(-Math.PI / 2);
      } else {
        ctx.translate(0, nextHeight);
        ctx.rotate(Math.PI / 2);
      }
      ctx.drawImage(doc, 0, 0);
      layer.canvas = next;
      layer.x = 0;
      layer.y = 0;
    }
    this.width = nextWidth;
    this.height = nextHeight;
    this.selection = null;
    this.crop = null;
    this.docEpoch += 1;
    this.emit("change");
  }

  selectRect(rect: Rect, mode: SelectMode) {
    if (rect.w < 1 || rect.h < 1) {
      if (mode === "replace") this.deselect();
      return;
    }
    this.writeSelection((ctx) => ctx.fillRect(rect.x, rect.y, rect.w, rect.h), mode, {
      kind: "rect",
      ...rect,
    });
  }

  selectEllipse(rect: Rect, mode: SelectMode) {
    if (rect.w < 1 || rect.h < 1) {
      if (mode === "replace") this.deselect();
      return;
    }
    this.writeSelection(
      (ctx) => {
        ctx.beginPath();
        ctx.ellipse(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w / 2, rect.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      },
      mode,
      { kind: "ellipse", ...rect },
    );
  }

  selectLasso(points: Point[], mode: SelectMode) {
    if (points.length < 3) {
      if (mode === "replace") this.deselect();
      return;
    }
    this.writeSelection(
      (ctx) => {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.closePath();
        ctx.fill();
      },
      mode,
      { kind: "poly", points },
    );
  }

  selectAll() {
    if (!this.hasDoc) return;
    this.pushHistory("Select all");
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, this.width, this.height);
    this.selection = {
      canvas,
      ants: { kind: "rect", x: 0, y: 0, w: this.width, h: this.height },
    };
    this.emit("change");
  }

  deselect() {
    if (!this.selection) return;
    this.pushHistory("Deselect");
    this.selection = null;
    this.emit("change");
  }

  invertSelection() {
    if (!this.hasDoc) return;
    this.pushHistory("Inverse selection");
    if (!this.selection) {
      const canvas = createCanvas(this.width, this.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, this.width, this.height);
      this.selection = { canvas, ants: { kind: "rect", x: 0, y: 0, w: this.width, h: this.height } };
      this.emit("change");
      return;
    }
    const ctx = this.selection.canvas.getContext("2d", { willReadFrequently: true })!;
    const image = ctx.getImageData(0, 0, this.width, this.height);
    for (let index = 0; index < image.data.length; index += 4) {
      image.data[index] = 255;
      image.data[index + 1] = 255;
      image.data[index + 2] = 255;
      image.data[index + 3] = 255 - image.data[index + 3];
    }
    ctx.putImageData(image, 0, 0);
    this.selection.ants = null;
    this.selection.edges = undefined;
    this.emit("change");
  }

  copy() {
    const layer = this.active();
    if (!layer) return;
    const bounds = this.selectionBounds();
    if (!bounds || bounds.w < 1 || bounds.h < 1) return;
    const canvas = createCanvas(bounds.w, bounds.h);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(
      layer.canvas,
      bounds.x - layer.x,
      bounds.y - layer.y,
      bounds.w,
      bounds.h,
      0,
      0,
      bounds.w,
      bounds.h,
    );
    if (this.selection) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(this.selection.canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
    }
    this.clipboard = canvas;
    this.clipboardPos = { x: bounds.x, y: bounds.y };
    this.notice = "Copied to the plate clipboard.";
    this.emit("change");
  }

  cut() {
    this.copy();
    this.clear();
  }

  paste() {
    if (!this.hasDoc || !this.clipboard) {
      this.notice = "Copy a region first.";
      this.emit("change");
      return;
    }
    this.pushHistory("Paste");
    const layer = this.makeLayer("Pasted");
    const x = (this.clipboardPos?.x ?? Math.round((this.width - this.clipboard.width) / 2)) + 16;
    const y = (this.clipboardPos?.y ?? Math.round((this.height - this.clipboard.height) / 2)) + 16;
    layer.canvas.getContext("2d")!.drawImage(this.clipboard, x, y);
    this.layers.push(layer);
    this.activeId = layer.id;
    this.clipboardPos = { x, y };
    this.emit("change");
  }

  clear() {
    const layer = this.editable();
    if (!layer) return;
    this.pushHistory("Clear");
    const ctx = layer.canvas.getContext("2d")!;
    if (!this.selection) ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    else {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(this.selection.canvas, -layer.x, -layer.y);
      ctx.restore();
    }
    this.emit("change");
  }

  fill() {
    const layer = this.editable();
    if (!layer) return;
    this.pushHistory("Fill");
    this.blitScratch(layer, (ctx) => {
      ctx.fillStyle = this.foreground;
      ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
    });
    this.emit("change");
  }

  flood(docX: number, docY: number, tolerance: number) {
    const layer = this.editable();
    if (!layer) return;
    const x = Math.floor(docX - layer.x);
    const y = Math.floor(docY - layer.y);
    if (x < 0 || y < 0 || x >= layer.canvas.width || y >= layer.canvas.height) return;
    this.pushHistory("Paint bucket");
    const ctx = layer.canvas.getContext("2d", { willReadFrequently: true })!;
    const image = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    const [r, g, b] = hexToRgb(this.foreground);
    floodFill(image.data, layer.canvas.width, layer.canvas.height, x, y, [r, g, b, 255], tolerance, this.layerMask(layer));
    ctx.putImageData(image, 0, 0);
    this.emit("change");
  }

  gradient(x0: number, y0: number, x1: number, y1: number, kind: "linear" | "radial", alpha: number) {
    const layer = this.editable();
    if (!layer) return;
    this.pushHistory("Gradient");
    const [fr, fg, fb] = hexToRgb(this.foreground);
    const [br, bg, bb] = hexToRgb(this.background);
    this.blitScratch(layer, (ctx) => {
      const gradient =
        kind === "radial"
          ? ctx.createRadialGradient(x0 - layer.x, y0 - layer.y, 0, x0 - layer.x, y0 - layer.y, Math.max(1, Math.hypot(x1 - x0, y1 - y0)))
          : ctx.createLinearGradient(x0 - layer.x, y0 - layer.y, x1 - layer.x, y1 - layer.y);
      gradient.addColorStop(0, `rgba(${fr}, ${fg}, ${fb}, ${alpha})`);
      gradient.addColorStop(1, `rgba(${br}, ${bg}, ${bb}, ${alpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
    });
    this.emit("change");
  }

  drawShape(
    kind: "rect" | "ellipse",
    rect: Rect,
    fill: boolean,
    stroke: boolean,
    strokeWidth: number,
  ) {
    const layer = this.editable();
    if (!layer || rect.w < 1 || rect.h < 1) return;
    this.pushHistory(kind === "rect" ? "Rectangle" : "Ellipse");
    this.blitScratch(layer, (ctx) => {
      ctx.beginPath();
      if (kind === "rect") ctx.rect(rect.x - layer.x, rect.y - layer.y, rect.w, rect.h);
      else ctx.ellipse(rect.x - layer.x + rect.w / 2, rect.y - layer.y + rect.h / 2, rect.w / 2, rect.h / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = this.foreground;
      ctx.strokeStyle = this.foreground;
      ctx.lineWidth = strokeWidth;
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    });
    this.emit("change");
  }

  drawText(text: string, docX: number, docY: number, fontSize: number, family: string) {
    if (!this.hasDoc || !text.trim()) return;
    this.pushHistory("Text");
    const layer = this.makeLayer(text.trim().split("\n")[0].slice(0, 28) || "Text");
    const ctx = layer.canvas.getContext("2d")!;
    ctx.fillStyle = this.foreground;
    ctx.font = `${fontSize}px ${family}`;
    ctx.textBaseline = "top";
    text.split("\n").forEach((line, index) => {
      ctx.fillText(line, docX, docY + index * fontSize * 1.25);
    });
    this.layers.push(layer);
    this.activeId = layer.id;
    this.emit("change");
  }

  beginStroke(
    mode: Stroke["mode"],
    doc: Point,
    settings: { size: number; hardness: number; opacity: number; color: string },
  ) {
    const layer = this.editable();
    if (!layer) return false;
    if (mode === "clone" && !this.cloneSource) {
      this.notice = "Alt-click with the clone stamp to set a source.";
      this.emit("change");
      return false;
    }
    this.stroke = {
      mode,
      layerId: layer.id,
      scratch: createCanvas(layer.canvas.width, layer.canvas.height),
      sample: mode === "clone" ? cloneCanvas(layer.canvas) : null,
      size: settings.size,
      hardness: settings.hardness,
      alpha: settings.opacity,
      color: settings.color,
      offset: this.cloneSource ? { x: this.cloneSource.x - doc.x, y: this.cloneSource.y - doc.y } : { x: 0, y: 0 },
      last: { ...doc },
      remainder: 0,
      dirty: false,
    };
    this.stamp(doc);
    this.schedule();
    return true;
  }

  extendStroke(doc: Point) {
    const stroke = this.stroke;
    if (!stroke?.last) return;
    const spacing = Math.max(0.75, stroke.size * 0.12);
    const from = stroke.last;
    const dx = doc.x - from.x;
    const dy = doc.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;
    if (dist + stroke.remainder < spacing) {
      stroke.remainder += dist;
      stroke.last = { ...doc };
      return;
    }
    let traveled = spacing - stroke.remainder;
    while (traveled <= dist) {
      const t = traveled / dist;
      this.stamp({ x: from.x + dx * t, y: from.y + dy * t });
      traveled += spacing;
    }
    stroke.remainder = spacing - (traveled - dist);
    stroke.last = { ...doc };
    this.schedule();
  }

  endStroke() {
    const stroke = this.stroke;
    if (!stroke) return;
    const layer = this.layers.find((item) => item.id === stroke.layerId);
    if (!layer || !stroke.dirty) {
      this.stroke = null;
      this.schedule();
      return;
    }
    const label = stroke.mode === "erase" ? "Eraser" : stroke.mode === "clone" ? "Clone stamp" : "Brush";
    const scratch = this.selection ? this.masked(stroke.scratch, layer) : stroke.scratch;
    this.pushHistory(label);
    const ctx = layer.canvas.getContext("2d")!;
    ctx.save();
    ctx.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over";
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
    this.stroke = null;
    this.emit("change");
  }

  beginMove() {
    const layer = this.editable();
    if (!layer) return false;
    this.move = {
      layerId: layer.id,
      base: cloneCanvas(layer.canvas),
      baseX: layer.x,
      baseY: layer.y,
      baseSel: this.selection ? cloneCanvas(this.selection.canvas) : null,
      baseAnts: this.selection?.ants ? structuredClone(this.selection.ants) : null,
      dirty: false,
    };
    return true;
  }

  updateMove(dx: number, dy: number) {
    const move = this.move;
    if (!move) return;
    const layer = this.layers.find((item) => item.id === move.layerId);
    if (!layer) return;
    move.dirty = dx !== 0 || dy !== 0;
    const ctx = layer.canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    if (move.baseSel && this.selection) {
      ctx.drawImage(move.base, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(move.baseSel, -layer.x, -layer.y);
      ctx.restore();
      const shifted = this.sized(this.docBuffer, layer.canvas.width, layer.canvas.height);
      this.docBuffer = shifted;
      const shiftCtx = shifted.getContext("2d")!;
      shiftCtx.setTransform(1, 0, 0, 1, 0, 0);
      shiftCtx.clearRect(0, 0, shifted.width, shifted.height);
      shiftCtx.drawImage(move.base, 0, 0);
      shiftCtx.globalCompositeOperation = "destination-in";
      shiftCtx.drawImage(move.baseSel, -layer.x, -layer.y);
      ctx.drawImage(shifted, dx, dy);
      const sel = this.selection.canvas.getContext("2d")!;
      sel.setTransform(1, 0, 0, 1, 0, 0);
      sel.clearRect(0, 0, this.width, this.height);
      sel.drawImage(move.baseSel, dx, dy);
      this.selection.ants = shiftAnts(move.baseAnts, dx, dy);
      this.selection.edges = undefined;
    } else {
      ctx.drawImage(move.base, 0, 0);
      layer.x = move.baseX + dx;
      layer.y = move.baseY + dy;
    }
    this.schedule();
  }

  endMove() {
    const move = this.move;
    if (!move) return;
    if (!move.dirty) {
      this.move = null;
      return;
    }
    const before = this.capture("Move");
    const snap = before.layers.find((layer) => layer.id === move.layerId);
    if (snap) {
      snap.canvas = move.base;
      snap.x = move.baseX;
      snap.y = move.baseY;
    }
    before.selection = move.baseSel ? { canvas: move.baseSel, ants: move.baseAnts } : null;
    this.remember(before);
    this.move = null;
    this.emit("change");
  }

  nudge(dx: number, dy: number) {
    if (!this.beginMove()) return;
    this.updateMove(dx, dy);
    this.endMove();
  }

  beginPreview() {
    const layer = this.editable();
    if (!layer) return false;
    this.preview = cloneCanvas(layer.canvas);
    return true;
  }

  previewAdjust(kind: AdjustKind, values: Record<string, number>) {
    if (!this.preview) return;
    const layer = this.active();
    if (!layer) return;
    const ctx = layer.canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    ctx.drawImage(this.preview, 0, 0);
    const image = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    applyMasked(image.data, layer.canvas.width, layer.canvas.height, this.layerMask(layer), (data) => {
      runAdjust(kind, values, data, layer.canvas.width, layer.canvas.height);
    });
    ctx.putImageData(image, 0, 0);
    this.schedule();
  }

  commitPreview(label: string) {
    if (!this.preview) return;
    const layer = this.active();
    if (!layer) {
      this.preview = null;
      return;
    }
    const result = cloneCanvas(layer.canvas);
    const ctx = layer.canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    ctx.drawImage(this.preview, 0, 0);
    this.pushHistory(label);
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    ctx.drawImage(result, 0, 0);
    this.preview = null;
    this.emit("change");
  }

  cancelPreview() {
    if (!this.preview) return;
    const layer = this.active();
    if (layer) {
      const ctx = layer.canvas.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      ctx.drawImage(this.preview, 0, 0);
    }
    this.preview = null;
    this.schedule();
  }

  instantAdjust(kind: "invert" | "desaturate" | "auto") {
    const layer = this.editable();
    if (!layer) return;
    const label = kind === "invert" ? "Invert" : kind === "desaturate" ? "Desaturate" : "Auto levels";
    this.pushHistory(label);
    const ctx = layer.canvas.getContext("2d", { willReadFrequently: true })!;
    const image = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    applyMasked(image.data, layer.canvas.width, layer.canvas.height, this.layerMask(layer), (data) => {
      runInstant(kind, data);
    });
    ctx.putImageData(image, 0, 0);
    this.emit("change");
  }

  histogram() {
    const layer = this.active();
    if (!layer) return new Array<number>(256).fill(0);
    const data = layer.canvas
      .getContext("2d", { willReadFrequently: true })!
      .getImageData(0, 0, layer.canvas.width, layer.canvas.height).data;
    return luminanceHistogram(data);
  }

  pick(docX: number, docY: number) {
    const x = Math.floor(docX);
    const y = Math.floor(docY);
    if (!this.hasDoc || x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    const flat = this.sized(this.pickBuffer, this.width, this.height);
    this.pickBuffer = flat;
    const ctx = flat.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const saved = this.stroke;
    this.stroke = null;
    this.paint(ctx);
    this.stroke = saved;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    if (pixel[3] === 0) return null;
    return rgbToHex(pixel[0], pixel[1], pixel[2]);
  }

  paint(ctx: CanvasRenderingContext2D) {
    for (const layer of this.layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;
      if (this.stroke?.layerId === layer.id) this.paintStroke(ctx, layer);
      else ctx.drawImage(layer.canvas, layer.x, layer.y);
      ctx.restore();
    }
  }

  selectionEdges() {
    if (!this.selection) return null;
    if (!this.selection.edges) this.selection.edges = this.buildEdges(this.selection.canvas);
    return this.selection.edges;
  }

  async exportImage(mime: "image/png" | "image/jpeg" | "image/webp") {
    if (!this.hasDoc) return;
    this.endStroke();
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d")!;
    if (mime !== "image/png") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, this.width, this.height);
    }
    this.paint(ctx);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
    if (!blob) {
      this.notice = "Export failed.";
      this.emit("change");
      return;
    }
    const extension = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
    const slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "halide";
    downloadBlob(blob, `${slug}.${extension}`);
  }

  pushHistory(label: string) {
    this.remember(this.capture(label));
  }

  undo() {
    if (!this.past.length) return;
    this.stroke = null;
    this.move = null;
    this.cancelPreview();
    const prev = this.past.pop()!;
    this.future.push(this.capture(prev.label));
    if (this.future.length > HISTORY_LIMIT) this.future.shift();
    this.restore(prev);
    this.emit("change");
  }

  redo() {
    if (!this.future.length) return;
    this.stroke = null;
    this.move = null;
    this.cancelPreview();
    const next = this.future.pop()!;
    this.past.push(this.capture(next.label));
    this.restore(next);
    this.emit("change");
  }

  jump(length: number) {
    while (this.past.length > length) this.undo();
    while (this.past.length < length && this.future.length) this.redo();
  }

  private makeLayer(name: string, locked = false): Layer {
    return {
      id: `layer-${this.seq++}`,
      name,
      visible: true,
      locked,
      opacity: 1,
      blendMode: "source-over",
      x: 0,
      y: 0,
      canvas: createCanvas(this.width, this.height),
    };
  }

  private uniqueName(name: string) {
    const names = new Set(this.layers.map((layer) => layer.name));
    if (!names.has(name)) return name;
    let index = 2;
    while (names.has(`${name} ${index}`)) index += 1;
    return `${name} ${index}`;
  }

  private editable() {
    const layer = this.active();
    if (!layer) {
      this.notice = "Add a layer before painting.";
      this.emit("change");
      return null;
    }
    if (layer.locked) {
      this.notice = `${layer.name} is locked. Unlock it in the layers panel.`;
      this.emit("change");
      return null;
    }
    if (this.notice) {
      this.notice = null;
      this.emit("change");
    }
    return layer;
  }

  private writeSelection(
    draw: (ctx: CanvasRenderingContext2D) => void,
    mode: SelectMode,
    ants: Ants | null,
  ) {
    if (!this.hasDoc) return;
    this.pushHistory("Selection");
    const canvas =
      mode === "replace" || !this.selection
        ? createCanvas(this.width, this.height)
        : cloneCanvas(this.selection.canvas);
    const ctx = canvas.getContext("2d")!;
    ctx.globalCompositeOperation = mode === "subtract" ? "destination-out" : "source-over";
    ctx.fillStyle = "#fff";
    draw(ctx);
    this.selection = { canvas, ants: mode === "replace" ? ants : null };
    this.emit("change");
  }

  private selectionBounds(): Rect | null {
    if (!this.hasDoc) return null;
    if (!this.selection) return { x: 0, y: 0, w: this.width, h: this.height };
    const ants = this.selection.ants;
    if (ants && ants.kind !== "poly") {
      return { x: ants.x, y: ants.y, w: ants.w, h: ants.h };
    }
    if (ants?.kind === "poly") {
      const xs = ants.points.map((point) => point.x);
      const ys = ants.points.map((point) => point.y);
      const x = Math.floor(Math.min(...xs));
      const y = Math.floor(Math.min(...ys));
      const w = Math.ceil(Math.max(...xs) - x);
      const h = Math.ceil(Math.max(...ys) - y);
      return { x, y, w, h };
    }
    const data = this.selection.canvas
      .getContext("2d", { willReadFrequently: true })!
      .getImageData(0, 0, this.width, this.height).data;
    let minX = this.width;
    let minY = this.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (data[(y * this.width + x) * 4 + 3] === 0) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxX < minX) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  private layerMask(layer: Layer) {
    if (!this.selection) return null;
    const mask = new Uint8Array(layer.canvas.width * layer.canvas.height);
    const data = this.selection.canvas
      .getContext("2d", { willReadFrequently: true })!
      .getImageData(0, 0, this.width, this.height).data;
    for (let y = 0; y < layer.canvas.height; y++) {
      for (let x = 0; x < layer.canvas.width; x++) {
        const docX = x + layer.x;
        const docY = y + layer.y;
        if (docX < 0 || docY < 0 || docX >= this.width || docY >= this.height) continue;
        mask[y * layer.canvas.width + x] = data[(docY * this.width + docX) * 4 + 3];
      }
    }
    return mask;
  }

  private blitScratch(layer: Layer, draw: (ctx: CanvasRenderingContext2D) => void) {
    const scratch = createCanvas(layer.canvas.width, layer.canvas.height);
    draw(scratch.getContext("2d")!);
    const source = this.selection ? this.masked(scratch, layer) : scratch;
    layer.canvas.getContext("2d")!.drawImage(source, 0, 0);
  }

  private masked(scratch: HTMLCanvasElement, layer: Layer) {
    const buffer = this.sized(this.maskBuffer, scratch.width, scratch.height);
    this.maskBuffer = buffer;
    const ctx = buffer.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, buffer.width, buffer.height);
    ctx.drawImage(scratch, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(this.selection!.canvas, -layer.x, -layer.y);
    ctx.globalCompositeOperation = "source-over";
    return buffer;
  }

  private stamp(doc: Point) {
    const stroke = this.stroke;
    if (!stroke) return;
    const layer = this.layers.find((item) => item.id === stroke.layerId);
    if (!layer) return;
    const x = doc.x - layer.x;
    const y = doc.y - layer.y;
    const ctx = stroke.scratch.getContext("2d")!;
    const radius = stroke.size / 2;
    if (stroke.mode === "clone" && stroke.sample) {
      const size = Math.max(1, Math.ceil(radius * 2));
      const stamp = this.sized(this.stampBuffer, size, size);
      this.stampBuffer = stamp;
      const stampCtx = stamp.getContext("2d")!;
      stampCtx.setTransform(1, 0, 0, 1, 0, 0);
      stampCtx.globalCompositeOperation = "source-over";
      stampCtx.clearRect(0, 0, size, size);
      stampCtx.drawImage(stroke.sample, x + stroke.offset.x - radius, y + stroke.offset.y - radius, size, size, 0, 0, size, size);
      stampCtx.globalCompositeOperation = "destination-in";
      stampBrush(stampCtx, radius, radius, radius, stroke.hardness, "#ffffff", stroke.alpha);
      ctx.drawImage(stamp, x - radius, y - radius);
    } else {
      stampBrush(ctx, x, y, radius, stroke.hardness, stroke.mode === "erase" ? "#ffffff" : stroke.color, stroke.alpha);
    }
    stroke.dirty = true;
  }

  private paintStroke(ctx: CanvasRenderingContext2D, layer: Layer) {
    const stroke = this.stroke;
    if (!stroke) return;
    const buffer = this.sized(this.docBuffer, this.width, this.height);
    this.docBuffer = buffer;
    const bufferCtx = buffer.getContext("2d")!;
    bufferCtx.setTransform(1, 0, 0, 1, 0, 0);
    bufferCtx.globalCompositeOperation = "source-over";
    bufferCtx.clearRect(0, 0, this.width, this.height);
    bufferCtx.drawImage(layer.canvas, layer.x, layer.y);
    const scratch = this.selection ? this.masked(stroke.scratch, layer) : stroke.scratch;
    bufferCtx.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over";
    bufferCtx.drawImage(scratch, layer.x, layer.y);
    ctx.drawImage(buffer, 0, 0);
  }

  private buildEdges(mask: HTMLCanvasElement) {
    const width = mask.width;
    const height = mask.height;
    const source = mask.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, width, height).data;
    const canvas = createCanvas(width, height);
    const image = canvas.getContext("2d")!.createImageData(width, height);
    const on = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < width && y < height && source[(y * width + x) * 4 + 3] > 127;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!on(x, y)) continue;
        if (on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1)) continue;
        const index = (y * width + x) * 4;
        image.data[index] = 255;
        image.data[index + 1] = 255;
        image.data[index + 2] = 255;
        image.data[index + 3] = 255;
      }
    }
    canvas.getContext("2d")!.putImageData(image, 0, 0);
    return canvas;
  }

  private schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.emit("composite");
    });
  }

  private capture(label: string): Snapshot {
    return {
      label,
      name: this.name,
      width: this.width,
      height: this.height,
      activeId: this.activeId,
      layers: this.layers.map((layer) => ({ ...layer, canvas: cloneCanvas(layer.canvas) })),
      selection: this.selection
        ? { canvas: cloneCanvas(this.selection.canvas), ants: this.selection.ants ? structuredClone(this.selection.ants) : null }
        : null,
    };
  }

  private restore(snapshot: Snapshot) {
    this.name = snapshot.name;
    this.width = snapshot.width;
    this.height = snapshot.height;
    this.activeId = snapshot.activeId;
    this.layers = snapshot.layers.map((layer) => ({ ...layer, canvas: cloneCanvas(layer.canvas) }));
    this.selection = snapshot.selection
      ? {
          canvas: cloneCanvas(snapshot.selection.canvas),
          ants: snapshot.selection.ants ? structuredClone(snapshot.selection.ants) : null,
        }
      : null;
    this.crop = null;
    this.hasDoc = true;
  }

  private remember(snapshot: Snapshot) {
    this.past.push(snapshot);
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
  }

  private discardTransient() {
    this.stroke = null;
    this.move = null;
    this.preview = null;
  }

  private sized(current: HTMLCanvasElement | null, width: number, height: number) {
    if (current && current.width === width && current.height === height) return current;
    return createCanvas(width, height);
  }
}

let singleton: EditorSession | null = null;

export function getSession() {
  if (!singleton) singleton = new EditorSession();
  return singleton;
}
