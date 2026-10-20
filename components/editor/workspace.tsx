"use client";

import { Button } from "@/components/ui/button";
import { useUI } from "@/components/editor/editor-ui";
import { useSession } from "@/components/editor/use-session";
import { Mark } from "@/components/editor/icons";
import { dragRect, normalizeRect, type Point, type Rect } from "@/lib/editor/geom";
import { getSession } from "@/lib/editor/session";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type CropMode = "new" | "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

type Drag = {
  kind: "stroke" | "move" | "hand" | "marquee" | "lasso" | "shape" | "gradient" | "zoom" | "crop" | "eyedropper";
  start: Point;
  current: Point;
  screenX: number;
  screenY: number;
  scrollLeft: number;
  scrollTop: number;
  points: Point[];
  cropMode: CropMode;
  origin: Rect | null;
  moved: boolean;
  shift: boolean;
  alt: boolean;
};

export function Workspace() {
  const session = useSession();
  const ui = useUI();
  const uiRef = useRef(ui);
  const [spaceDown, setSpaceDown] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rulerXRef = useRef<HTMLCanvasElement>(null);
  const rulerYRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const welcomeRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const spaceRef = useRef(false);
  const anchorRef = useRef<{ docX: number; docY: number; clientX: number; clientY: number } | null>(null);
  const centerRef = useRef(false);
  const [viewport, setViewport] = useState({ w: 800, h: 600 });
  const [draft, setDraft] = useState<{ x: number; y: number; text: string } | null>(null);
  const cancelText = useRef(false);

  const drawView = () => {
    const canvas = viewRef.current;
    const current = getSession();
    if (!canvas || !current.hasDoc) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(Math.max(current.zoom, 1), 2) * dpr;
    const width = Math.max(1, Math.round(current.width * scale));
    const height = Math.max(1, Math.round(current.height * scale));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, current.width, current.height);
    ctx.imageSmoothingEnabled = current.zoom < 3;
    current.paint(ctx);
  };

  const drawOverlay = (dash: number) => {
    const overlay = overlayRef.current;
    const current = getSession();
    if (!overlay || !current.hasDoc) return;
    const zoom = current.zoom;
    const dpr = window.devicePixelRatio || 1;
    const cssW = current.width * zoom;
    const cssH = current.height * zoom;
    const width = Math.max(1, Math.round(cssW * dpr));
    const height = Math.max(1, Math.round(cssH * dpr));
    if (overlay.width !== width) overlay.width = width;
    if (overlay.height !== height) overlay.height = height;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (current.showGrid) {
      ctx.strokeStyle = "rgba(255,244,230,0.09)";
      ctx.lineWidth = 1;
      const step = zoom < 0.6 ? 200 : 100;
      for (let x = 0; x <= current.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(Math.round(x * zoom) + 0.5, 0);
        ctx.lineTo(Math.round(x * zoom) + 0.5, cssH);
        ctx.stroke();
      }
      for (let y = 0; y <= current.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y * zoom) + 0.5);
        ctx.lineTo(cssW, Math.round(y * zoom) + 0.5);
        ctx.stroke();
      }
    }

    if (current.selection) {
      ctx.save();
      ctx.drawImage(current.selection.canvas, 0, 0, cssW, cssH);
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = "rgba(120, 168, 255, 0.2)";
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.restore();
      strokeAnts(ctx, current, zoom, dash);
    }

    const drag = dragRef.current;
    if (drag && (drag.kind === "marquee" || drag.kind === "shape" || drag.kind === "zoom")) {
      const rect = dragRect(drag.start, drag.current, {
        square: drag.kind !== "zoom" && drag.shift,
        center: drag.kind !== "zoom" && drag.alt,
      });
      ctx.save();
      ctx.strokeStyle = "#f4efe6";
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -dash;
      ctx.strokeRect(rect.x * zoom, rect.y * zoom, rect.w * zoom, rect.h * zoom);
      ctx.restore();
    }
    if (drag?.kind === "lasso" && drag.points.length) {
      ctx.beginPath();
      ctx.moveTo(drag.points[0].x * zoom, drag.points[0].y * zoom);
      for (const point of drag.points) ctx.lineTo(point.x * zoom, point.y * zoom);
      ctx.strokeStyle = "#f4efe6";
      ctx.setLineDash([4, 4]);
      ctx.stroke();
    }
    if (drag?.kind === "gradient") {
      ctx.beginPath();
      ctx.moveTo(drag.start.x * zoom, drag.start.y * zoom);
      ctx.lineTo(drag.current.x * zoom, drag.current.y * zoom);
      ctx.strokeStyle = "#f4efe6";
      ctx.stroke();
    }
    const crop = current.crop;
    if (crop) drawCrop(ctx, crop, zoom, cssW, cssH);
    if (current.cloneSource && uiRef.current.tool === "clone") {
      ctx.strokeStyle = "#e4a574";
      ctx.beginPath();
      ctx.moveTo(current.cloneSource.x * zoom - 6, current.cloneSource.y * zoom);
      ctx.lineTo(current.cloneSource.x * zoom + 6, current.cloneSource.y * zoom);
      ctx.moveTo(current.cloneSource.x * zoom, current.cloneSource.y * zoom - 6);
      ctx.lineTo(current.cloneSource.x * zoom, current.cloneSource.y * zoom + 6);
      ctx.stroke();
    }
    drawRulers();
  };

  const drawRulers = () => {
    const current = getSession();
    const frame = frameRef.current;
    const rulerX = rulerXRef.current;
    const rulerY = rulerYRef.current;
    if (!current.showRulers || !frame || !rulerX || !rulerY) return;
    const dpr = window.devicePixelRatio || 1;
    paintRuler(rulerX, frame, "x", current.zoom, dpr);
    paintRuler(rulerY, frame, "y", current.zoom, dpr);
  };

  useEffect(() => {
    uiRef.current = ui;
  });

  function zoomAt(clientX: number, clientY: number, next: number) {
    const frame = frameRef.current;
    const current = getSession();
    if (!frame) return;
    const before = frame.getBoundingClientRect();
    anchorRef.current = {
      docX: (clientX - before.left) / current.zoom,
      docY: (clientY - before.top) / current.zoom,
      clientX,
      clientY,
    };
    current.setZoom(next);
  }

  function fit() {
    const scroller = scrollerRef.current;
    const current = getSession();
    if (!scroller || !current.hasDoc) return;
    const next = Math.min((scroller.clientWidth - 72) / current.width, (scroller.clientHeight - 72) / current.height);
    current.setZoom(Number.isFinite(next) && next > 0 ? next : 1);
  }

  useEffect(() => {
    drawView();
    return getSession().subscribe((event) => {
      if (event === "composite" || event === "change") drawView();
    });
  }, []);

  useEffect(() => {
    drawView();
  }, [session.revision, session.zoom, session.width, session.height]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let dash = 0;
    const loop = () => {
      dash = reduce ? 0 : (dash + 0.35) % 8;
      drawOverlay(dash);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // Overlay reads refs and the live session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(() => {
      setViewport({ w: scroller.clientWidth, h: scroller.clientHeight });
    });
    observer.observe(scroller);
    setViewport({ w: scroller.clientWidth, h: scroller.clientHeight });
    return () => observer.disconnect();
  }, [session.hasDoc, session.showRulers]);

  useEffect(() => {
    if (!session.hasDoc) return;
    const id = requestAnimationFrame(() => {
      centerRef.current = true;
      fit();
    });
    return () => cancelAnimationFrame(id);
    // Fit when a new plate opens or its pixel size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.docEpoch]);

  useLayoutEffect(() => {
    const pending = anchorRef.current;
    const frame = frameRef.current;
    const scroller = scrollerRef.current;
    if (pending && frame && scroller) {
      anchorRef.current = null;
      const after = frame.getBoundingClientRect();
      scroller.scrollLeft += after.left + pending.docX * session.zoom - pending.clientX;
      scroller.scrollTop += after.top + pending.docY * session.zoom - pending.clientY;
      return;
    }
    if (!centerRef.current || !frame || !scroller) return;
    centerRef.current = false;
    scroller.scrollLeft = frame.offsetLeft - (scroller.clientWidth - frame.offsetWidth) / 2;
    scroller.scrollTop = frame.offsetTop - (scroller.clientHeight - frame.offsetHeight) / 2;
  }, [session.zoom, session.docEpoch, viewport]);

  useEffect(() => {
    const current = getSession();
    const handler = (command: "fit" | "actual" | "in" | "out") => {
      if (command === "fit") {
        centerRef.current = true;
        fit();
      } else if (command === "actual") {
        centerRef.current = true;
        current.setZoom(1);
      } else if (command === "in" || command === "out") {
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const bounds = scroller.getBoundingClientRect();
        zoomAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, current.zoom * (command === "in" ? 1.25 : 0.8));
      }
    };
    current.viewHandlers.add(handler);
    return () => {
      current.viewHandlers.delete(handler);
    };
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !getSession().hasDoc) return;
      event.preventDefault();
      const next = getSession().zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08);
      zoomAt(event.clientX, event.clientY, next);
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [session.hasDoc]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space" && !typing(event.target)) {
        event.preventDefault();
        if (!spaceRef.current) {
          spaceRef.current = true;
          setSpaceDown(true);
        }
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space" && spaceRef.current) {
        spaceRef.current = false;
        setSpaceDown(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const node = welcomeRef.current;
    if (!node || session.hasDoc) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let revert: (() => void) | null = null;
    let cancelled = false;
    void import("gsap").then(({ default: gsap }) => {
      if (cancelled) return;
      const context = gsap.context(() => {
        gsap.from("[data-rise]", {
          y: 14,
          opacity: 0,
          stagger: 0.06,
          duration: 0.55,
          ease: "power2.out",
        });
      }, node);
      revert = () => context.revert();
    });
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [session.hasDoc]);

  const toDoc = (event: { clientX: number; clientY: number }) => {
    const frame = frameRef.current;
    const zoom = getSession().zoom || 1;
    if (!frame) return { x: 0, y: 0 };
    const bounds = frame.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / zoom, y: (event.clientY - bounds.top) / zoom };
  };

  const placeRing = (point: Point | null) => {
    const ring = ringRef.current;
    if (!ring) return;
    const tool = spaceRef.current ? "hand" : uiRef.current.tool;
    const show = point && (tool === "brush" || tool === "eraser" || tool === "clone");
    ring.style.opacity = show ? "1" : "0";
    if (!point) return;
    const zoom = getSession().zoom;
    const size = uiRef.current.size * zoom;
    ring.style.width = `${size}px`;
    ring.style.height = `${size}px`;
    ring.style.transform = `translate(${point.x * zoom - size / 2}px, ${point.y * zoom - size / 2}px)`;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!session.hasDoc || event.button !== 0) return;
    const point = toDoc(event);
    const current = getSession();
    current.pointer = point;
    const tool = spaceRef.current ? "hand" : uiRef.current.tool;
    event.currentTarget.setPointerCapture(event.pointerId);
    const drag: Drag = {
      kind: "marquee",
      start: point,
      current: point,
      screenX: event.clientX,
      screenY: event.clientY,
      scrollLeft: scrollerRef.current?.scrollLeft ?? 0,
      scrollTop: scrollerRef.current?.scrollTop ?? 0,
      points: [point],
      cropMode: "new",
      origin: current.crop ? { ...current.crop } : null,
      moved: false,
      shift: event.shiftKey,
      alt: event.altKey,
    };

    if (tool === "brush" || tool === "eraser" || tool === "clone") {
      if (event.altKey) {
        const color = current.pick(point.x, point.y);
        if (tool === "clone") current.cloneSource = { ...point };
        if (color) current.setForeground(color);
        drag.kind = "eyedropper";
        dragRef.current = drag;
        return;
      }
      drag.kind = "stroke";
      current.beginStroke(tool === "brush" ? "paint" : tool === "eraser" ? "erase" : "clone", point, {
        size: uiRef.current.size,
        hardness: uiRef.current.hardness,
        opacity: uiRef.current.brushOpacity,
        color: current.foreground,
      });
      dragRef.current = drag;
      return;
    }
    if (tool === "eyedropper") {
      const color = current.pick(point.x, point.y);
      if (color) current.setForeground(color);
      drag.kind = "eyedropper";
      dragRef.current = drag;
      return;
    }
    if (tool === "move") {
      drag.kind = "move";
      current.beginMove();
      dragRef.current = drag;
      return;
    }
    if (tool === "hand") {
      drag.kind = "hand";
      dragRef.current = drag;
      return;
    }
    if (tool === "bucket") {
      current.flood(point.x, point.y, uiRef.current.tolerance);
      return;
    }
    if (tool === "text") {
      setDraft({ x: point.x, y: point.y, text: "" });
      return;
    }
    if (tool === "crop") {
      drag.kind = "crop";
      const hit = current.crop ? hitCrop(point, current.crop, current.zoom) : null;
      drag.cropMode = hit ?? "new";
      drag.origin = current.crop ? { ...current.crop } : { x: point.x, y: point.y, w: 0, h: 0 };
      dragRef.current = drag;
      return;
    }
    if (tool === "lasso") drag.kind = "lasso";
    else if (tool === "gradient") drag.kind = "gradient";
    else if (tool === "shape" || tool === "ellipse-shape") drag.kind = "shape";
    else if (tool === "zoom") drag.kind = "zoom";
    else drag.kind = "marquee";
    dragRef.current = drag;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = toDoc(event);
    const current = getSession();
    current.pointer = point;
    placeRing(point);
    const drag = dragRef.current;
    if (!drag) return;
    drag.current = point;
    drag.shift = event.shiftKey;
    drag.alt = event.altKey;
    drag.moved = drag.moved || Math.hypot(event.clientX - drag.screenX, event.clientY - drag.screenY) > 2;
    if (drag.kind === "stroke") current.extendStroke(point);
    else if (drag.kind === "eyedropper") {
      const color = current.pick(point.x, point.y);
      if (color) current.setForeground(color);
    } else if (drag.kind === "move") current.updateMove(point.x - drag.start.x, point.y - drag.start.y);
    else if (drag.kind === "hand" && scrollerRef.current) {
      scrollerRef.current.scrollLeft = drag.scrollLeft - (event.clientX - drag.screenX);
      scrollerRef.current.scrollTop = drag.scrollTop - (event.clientY - drag.screenY);
    } else if (drag.kind === "lasso") {
      const last = drag.points[drag.points.length - 1];
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 1.5) drag.points.push(point);
    } else if (drag.kind === "crop" && drag.origin) {
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      const next =
        drag.cropMode === "new"
          ? dragRect(drag.start, point, { square: event.shiftKey, center: event.altKey })
          : resizeCrop(drag.cropMode, drag.origin, dx, dy);
      current.setCrop(next, true);
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const current = getSession();
    const point = toDoc(event);
    if (drag.kind === "stroke") current.endStroke();
    else if (drag.kind === "move") current.endMove();
    else if (drag.kind === "marquee") {
      const rect = dragRect(drag.start, point, { square: event.shiftKey, center: event.altKey });
      if (uiRef.current.tool === "ellipse-select") current.selectEllipse(rect, uiRef.current.selectMode);
      else current.selectRect(rect, uiRef.current.selectMode);
    } else if (drag.kind === "lasso") current.selectLasso(drag.points, uiRef.current.selectMode);
    else if (drag.kind === "shape") {
      const rect = dragRect(drag.start, point, { square: event.shiftKey, center: event.altKey });
      current.drawShape(
        uiRef.current.tool === "ellipse-shape" ? "ellipse" : "rect",
        rect,
        uiRef.current.shapeFill,
        uiRef.current.shapeStroke,
        uiRef.current.strokeWidth,
      );
    } else if (drag.kind === "gradient") {
      current.gradient(drag.start.x, drag.start.y, point.x, point.y, uiRef.current.gradient, uiRef.current.brushOpacity);
    } else if (drag.kind === "zoom") {
      if (!drag.moved || event.altKey) zoomAt(event.clientX, event.clientY, current.zoom * (event.altKey ? 0.8 : 1.25));
      else {
        const rect = dragRect(drag.start, point, {});
        const scroller = scrollerRef.current;
        if (scroller && rect.w > 4 && rect.h > 4) {
          const bounds = scroller.getBoundingClientRect();
          anchorRef.current = {
            docX: rect.x + rect.w / 2,
            docY: rect.y + rect.h / 2,
            clientX: bounds.left + bounds.width / 2,
            clientY: bounds.top + bounds.height / 2,
          };
          current.setZoom(Math.min(scroller.clientWidth / rect.w, scroller.clientHeight / rect.h));
        }
      }
    } else if (drag.kind === "crop") {
      current.setCrop(current.crop, false);
    }
  };

  const commitText = () => {
    if (!draft || cancelText.current) {
      cancelText.current = false;
      setDraft(null);
      return;
    }
    const family =
      ui.font === "serif"
        ? "Georgia, 'Iowan Old Style', serif"
        : ui.font === "mono"
          ? "ui-monospace, SFMono-Regular, Menlo, monospace"
          : getComputedStyle(document.body).fontFamily || "sans-serif";
    getSession().drawText(draft.text, draft.x, draft.y, ui.fontSize, family);
    setDraft(null);
  };

  if (!session.hasDoc) {
    return (
      <div ref={welcomeRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-workspace px-6">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(228,165,116,0.16), transparent 55%)" }} />
        <div className="relative max-w-xl text-center">
          <div data-rise className="mx-auto mb-5 grid size-12 place-items-center rounded-full border border-copper/40 text-copper">
            <Mark className="size-6" />
          </div>
          <p data-rise className="text-[11px] tracking-[0.22em] text-copper uppercase">Browser darkroom</p>
          <h1 data-rise className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Open a plate.
          </h1>
          <p data-rise className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Layers, brushes, selections, and color — the working surface of a desktop photo editor, running in the browser.
          </p>
          <div data-rise className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => ui.setDialog({ type: "new" })}>New document</Button>
            <Button variant="secondary" onClick={ui.openFile}>
              Open image
            </Button>
          </div>
          <button
            data-rise
            type="button"
            className="mt-4 text-[13px] text-muted-foreground underline decoration-white/20 underline-offset-4 hover:text-foreground"
            onClick={() => session.loadSample()}
          >
            Load the studio still life
          </button>
        </div>
      </div>
    );
  }

  const pad = 96;
  const docW = session.width * session.zoom;
  const docH = session.height * session.zoom;
  const outerW = Math.max(viewport.w, docW + pad);
  const outerH = Math.max(viewport.h, docH + pad);
  const left = (outerW - docW) / 2;
  const top = (outerH - docH) / 2;
  const tool = spaceDown ? "hand" : ui.tool;
  const cursor =
    tool === "hand" ? "grab" : tool === "move" ? "move" : tool === "text" ? "text" : tool === "zoom" ? "zoom-in" : tool === "brush" || tool === "eraser" || tool === "clone" ? "none" : "crosshair";

  return (
    <div
      className="grid min-h-0 min-w-0 flex-1 bg-workspace"
      style={{
        gridTemplateColumns: session.showRulers ? "22px minmax(0,1fr)" : "minmax(0,1fr)",
        gridTemplateRows: session.showRulers ? "22px minmax(0,1fr)" : "minmax(0,1fr)",
      }}
    >
      {session.showRulers ? <div className="border-r border-b border-white/10 bg-[#171513]" /> : null}
      {session.showRulers ? <canvas ref={rulerXRef} className="h-[22px] w-full border-b border-white/10 bg-[#171513]" /> : null}
      {session.showRulers ? <canvas ref={rulerYRef} className="h-full w-[22px] border-r border-white/10 bg-[#171513]" /> : null}
      <div ref={scrollerRef} className="relative overflow-auto" onScroll={drawRulers}>
        <div className="relative" style={{ width: outerW, height: outerH }}>
          <div
            ref={frameRef}
            className="checker absolute shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            style={{ left, top, width: docW, height: docH, cursor }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => placeRing(null)}
          >
            <canvas ref={viewRef} className="absolute inset-0 h-full w-full" />
            <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
            <div
              ref={ringRef}
              className="pointer-events-none absolute top-0 left-0 rounded-full border border-white/90 opacity-0"
              style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.65)" }}
            />
            {draft ? (
              <textarea
                autoFocus
                value={draft.text}
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                onBlur={commitText}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    cancelText.current = true;
                    event.currentTarget.blur();
                  } else if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
                className="absolute min-w-40 resize-none rounded-sm bg-black/35 px-1 text-foreground outline outline-copper/70"
                style={{
                  left: draft.x * session.zoom,
                  top: draft.y * session.zoom,
                  fontSize: ui.fontSize * session.zoom,
                  lineHeight: 1.25,
                  fontFamily: ui.font === "serif" ? "Georgia, serif" : ui.font === "mono" ? "ui-monospace, monospace" : "inherit",
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function typing(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
}

function strokeAnts(
  ctx: CanvasRenderingContext2D,
  session: ReturnType<typeof getSession>,
  zoom: number,
  dash: number,
) {
  const ants = session.selection?.ants;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.lineDashOffset = -dash;
  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  if (ants?.kind === "rect") ctx.rect(ants.x * zoom, ants.y * zoom, ants.w * zoom, ants.h * zoom);
  else if (ants?.kind === "ellipse") ctx.ellipse((ants.x + ants.w / 2) * zoom, (ants.y + ants.h / 2) * zoom, Math.max(0.5, (ants.w / 2) * zoom), Math.max(0.5, (ants.h / 2) * zoom), 0, 0, Math.PI * 2);
  else if (ants?.kind === "poly" && ants.points.length) {
    ctx.moveTo(ants.points[0].x * zoom, ants.points[0].y * zoom);
    for (const point of ants.points) ctx.lineTo(point.x * zoom, point.y * zoom);
    ctx.closePath();
  } else {
    const edges = session.selectionEdges();
    ctx.restore();
    if (edges) ctx.drawImage(edges, 0, 0, session.width * zoom, session.height * zoom);
    return;
  }
  ctx.stroke();
  ctx.strokeStyle = "#161311";
  ctx.lineDashOffset = 4 - dash;
  ctx.stroke();
  ctx.restore();
}

function drawCrop(ctx: CanvasRenderingContext2D, crop: Rect, zoom: number, cssW: number, cssH: number) {
  const x = crop.x * zoom;
  const y = crop.y * zoom;
  const w = crop.w * zoom;
  const h = crop.h * zoom;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.rect(0, 0, cssW, cssH);
  ctx.rect(x, y, w, h);
  ctx.fill("evenodd");
  ctx.strokeStyle = "#f4efe6";
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = "rgba(244,239,230,0.35)";
  ctx.beginPath();
  ctx.moveTo(x + w / 3, y);
  ctx.lineTo(x + w / 3, y + h);
  ctx.moveTo(x + (2 * w) / 3, y);
  ctx.lineTo(x + (2 * w) / 3, y + h);
  ctx.moveTo(x, y + h / 3);
  ctx.lineTo(x + w, y + h / 3);
  ctx.moveTo(x, y + (2 * h) / 3);
  ctx.lineTo(x + w, y + (2 * h) / 3);
  ctx.stroke();
  ctx.fillStyle = "#f4efe6";
  for (const [hx, hy] of [
    [x, y],
    [x + w / 2, y],
    [x + w, y],
    [x, y + h / 2],
    [x + w, y + h / 2],
    [x, y + h],
    [x + w / 2, y + h],
    [x + w, y + h],
  ]) {
    ctx.fillRect(hx - 3, hy - 3, 6, 6);
  }
  ctx.restore();
}

function hitCrop(point: Point, crop: Rect, zoom: number): CropMode | null {
  const handle = 8 / Math.max(zoom, 0.2);
  const near = (x: number, y: number) => Math.abs(point.x - x) <= handle && Math.abs(point.y - y) <= handle;
  const { x, y, w, h } = crop;
  if (near(x, y)) return "nw";
  if (near(x + w, y)) return "ne";
  if (near(x, y + h)) return "sw";
  if (near(x + w, y + h)) return "se";
  if (Math.abs(point.y - y) <= handle && point.x > x && point.x < x + w) return "n";
  if (Math.abs(point.y - (y + h)) <= handle && point.x > x && point.x < x + w) return "s";
  if (Math.abs(point.x - x) <= handle && point.y > y && point.y < y + h) return "w";
  if (Math.abs(point.x - (x + w)) <= handle && point.y > y && point.y < y + h) return "e";
  if (point.x >= x && point.y >= y && point.x <= x + w && point.y <= y + h) return "move";
  return null;
}

function resizeCrop(mode: CropMode, origin: Rect, dx: number, dy: number): Rect {
  let { x, y, w, h } = origin;
  if (mode === "move") return { x: x + dx, y: y + dy, w, h };
  if (mode === "e" || mode === "ne" || mode === "se") w += dx;
  if (mode === "s" || mode === "se" || mode === "sw") h += dy;
  if (mode === "w" || mode === "nw" || mode === "sw") {
    x += dx;
    w -= dx;
  }
  if (mode === "n" || mode === "ne" || mode === "nw") {
    y += dy;
    h -= dy;
  }
  return normalizeRect(x, y, w, h);
}

function paintRuler(
  canvas: HTMLCanvasElement,
  frame: HTMLDivElement,
  axis: "x" | "y",
  zoom: number,
  dpr: number,
) {
  const bounds = canvas.getBoundingClientRect();
  const frameBounds = frame.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width * dpr));
  const height = Math.max(1, Math.round(bounds.height * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, bounds.width, bounds.height);
  ctx.fillStyle = "#171513";
  ctx.fillRect(0, 0, bounds.width, bounds.height);
  ctx.strokeStyle = "rgba(243,239,231,0.35)";
  ctx.fillStyle = "rgba(243,239,231,0.55)";
  ctx.font = "9px ui-monospace, monospace";
  const origin = axis === "x" ? frameBounds.left - bounds.left : frameBounds.top - bounds.top;
  const span = axis === "x" ? bounds.width : bounds.height;
  const step = zoom >= 2 ? 50 : zoom >= 0.75 ? 100 : 200;
  const start = Math.floor(-origin / zoom / step) * step - step;
  const end = start + span / zoom + step * 2;
  for (let value = start; value < end; value += step) {
    const pos = origin + value * zoom;
    ctx.beginPath();
    if (axis === "x") {
      ctx.moveTo(pos, 22);
      ctx.lineTo(pos, 10);
      if (value >= 0) ctx.fillText(String(value), pos + 2, 9);
    } else {
      ctx.moveTo(22, pos);
      ctx.lineTo(10, pos);
      if (value >= 0) {
        ctx.save();
        ctx.translate(9, pos + 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(value), 0, 0);
        ctx.restore();
      }
    }
    ctx.stroke();
  }
}
