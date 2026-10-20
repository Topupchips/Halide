"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUI } from "@/components/editor/editor-ui";
import { useSession } from "@/components/editor/use-session";
import { ADJUST_LABELS } from "@/lib/editor/adjust";
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from "@/lib/editor/color";
import { getSession } from "@/lib/editor/session";
import { BLEND_MODES } from "@/lib/editor/tools";
import type { AdjustKind, BlendMode } from "@/lib/editor/types";
import { cn } from "cn";
import { Eye, EyeOff, Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export function SidePanel() {
  const session = useSession();
  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <ColorPanel />
      <Tabs defaultValue="layers" className="min-h-0 flex-1 gap-0">
        <TabsList variant="line" className="mx-3 w-[calc(100%-1.5rem)] justify-start">
          <TabsTrigger value="layers">Layers</TabsTrigger>
          <TabsTrigger value="adjust">Adjust</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="layers" className="min-h-0">
          <LayersPanel />
        </TabsContent>
        <TabsContent value="adjust" className="min-h-0">
          <AdjustPanel />
        </TabsContent>
        <TabsContent value="history" className="min-h-0">
          <HistoryPanel />
        </TabsContent>
      </Tabs>
      <p className="sr-only">{session.name}</p>
    </div>
  );
}

function ColorPanel() {
  const session = useSession();
  const hsv = rgbToHsv(...hexToRgb(session.foreground));
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>(["#1c1612", "#f4efe6", "#e4a574", "#c4553a", "#3d6848", "#1f4b73"]);
  const square = useRef<HTMLDivElement>(null);
  const hex = hexDraft ?? session.foreground;

  const apply = (next: [number, number, number], commit = false) => {
    const color = rgbToHex(...hsvToRgb(...next));
    setHexDraft(null);
    session.setForeground(color);
    if (commit) setRecents((colors) => [color, ...colors.filter((item) => item !== color)].slice(0, 8));
  };

  const dragSquare = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = square.current?.getBoundingClientRect();
    if (!bounds) return;
    const s = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const v = Math.min(1, Math.max(0, 1 - (event.clientY - bounds.top) / bounds.height));
    apply([hsv[0], s, v]);
  };

  const hueColor = rgbToHex(...hsvToRgb(hsv[0], 1, 1));

  return (
    <div className="grid gap-3 border-b border-white/10 p-3">
      <div className="flex gap-3">
        <div
          ref={square}
          className="relative h-28 flex-1 cursor-crosshair overflow-hidden rounded-md"
          style={{ backgroundColor: hueColor }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragSquare(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) dragSquare(event);
          }}
          onPointerUp={() =>
            setRecents((colors) => [session.foreground, ...colors.filter((item) => item !== session.foreground)].slice(0, 8))
          }
        >
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, #fff, transparent)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(#0000, #000)" }} />
          <span
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%` }}
          />
        </div>
        <input
          aria-label="Hue"
          className="h-28 w-5 cursor-pointer accent-copper"
          style={{
            writingMode: "vertical-lr",
            direction: "rtl",
            background: "linear-gradient(180deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
          }}
          type="range"
          min={0}
          max={360}
          value={hsv[0]}
          onChange={(event) => apply([Number(event.target.value), hsv[1], hsv[2]])}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="size-7 rounded-md border border-white/10" style={{ background: session.foreground }} />
        <input
          aria-label="Hex color"
          className="h-7 w-24 rounded-md border border-white/10 bg-black/20 px-2 font-mono text-[12px] uppercase"
          value={hex}
          onFocus={() => setHexDraft(session.foreground)}
          onBlur={() => setHexDraft(null)}
          onChange={(event) => {
            const value = event.target.value;
            setHexDraft(value);
            if (/^#?[0-9a-fA-F]{6}$/.test(value)) {
              const color = value.startsWith("#") ? value : `#${value}`;
              session.setForeground(color);
            }
          }}
        />
        <div className="ml-auto flex gap-1">
          {recents.slice(0, 6).map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              className="size-5 rounded-sm border border-white/10"
              style={{ background: color }}
              onClick={() => session.setForeground(color)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LayersPanel() {
  const session = useSession();
  const active = session.active();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {active ? (
        <div className="grid gap-2 border-b border-white/10 px-3 py-2">
          <label className="grid gap-1 text-[11px] text-muted-foreground">
            Opacity
            <Slider
              value={[active.opacity]}
              min={0}
              max={1}
              step={0.01}
              onPointerDown={() => session.pushHistory("Layer opacity")}
              onValueChange={(values) => session.setOpacity(active.id, values[0] ?? active.opacity)}
            />
          </label>
          <label className="grid gap-1 text-[11px] text-muted-foreground">
            Blend
            <select
              className="h-8 rounded-md border border-white/10 bg-black/20 px-2 text-[13px] text-foreground"
              value={active.blendMode}
              onChange={(event) => session.setBlend(active.id, event.target.value as BlendMode)}
            >
              {BLEND_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        {session.layers.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] leading-5 text-muted-foreground">Open a plate to stack layers.</p>
        ) : null}
        <ul className="flex flex-col-reverse p-2">
          {session.layers.map((layer) => (
            <li key={layer.id}>
              <div
                draggable
                onDragStart={(event) => event.dataTransfer.setData("text/plain", layer.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  session.reorder(event.dataTransfer.getData("text/plain"), layer.id);
                }}
                className={cn(
                  "mb-1 flex items-center gap-1 rounded-md border border-transparent px-1 py-1",
                  layer.id === session.activeId && "border-copper/40 bg-copper/10",
                )}
                onClick={() => session.setActive(layer.id)}
              >
                <button
                  type="button"
                  aria-label={layer.visible ? "Hide layer" : "Show layer"}
                  className="grid size-7 place-items-center text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (event.altKey) session.solo(layer.id);
                    else session.setVisibility(layer.id, !layer.visible);
                  }}
                >
                  {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </button>
                <Thumb id={layer.id} />
                {editing === layer.id ? (
                  <input
                    autoFocus
                    className="h-7 min-w-0 flex-1 rounded bg-black/30 px-1 text-[13px]"
                    defaultValue={layer.name}
                    onBlur={(event) => {
                      session.rename(layer.id, event.target.value);
                      setEditing(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") setEditing(null);
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : (
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-[13px]"
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      setEditing(layer.id);
                    }}
                  >
                    {layer.name}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
                  className="grid size-7 place-items-center text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    session.setLocked(layer.id, !layer.locked);
                  }}
                >
                  {layer.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5 opacity-40" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>
      <div className="flex gap-1 border-t border-white/10 p-2">
        <Button variant="ghost" size="sm" onClick={() => session.addLayer()} disabled={!session.hasDoc}>
          <Plus /> New
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!active}
          onClick={() => active && session.duplicate(active.id)}
        >
          Duplicate
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          disabled={!active}
          onClick={() => active && session.deleteLayer(active.id)}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

function Thumb({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const session = useSession();
  useEffect(() => {
    const canvas = ref.current;
    const layer = getSession().layers.find((item) => item.id === id);
    if (!canvas || !layer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(layer.canvas, 0, 0, canvas.width, canvas.height);
  }, [id, session.revision]);
  return <canvas ref={ref} width={32} height={24} className="checker h-6 w-8 rounded-sm border border-white/10" />;
}

const ADJUST_BUTTONS: AdjustKind[] = [
  "brightness",
  "hue",
  "levels",
  "exposure",
  "threshold",
  "posterize",
  "blur",
  "sharpen",
  "noise",
  "pixelate",
  "vignette",
];

function AdjustPanel() {
  const session = useSession();
  const ui = useUI();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const bins = session.histogram();
    const ctx = target.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, target.width, target.height);
    const max = Math.max(...bins, 1);
    ctx.fillStyle = "#e4a574";
    bins.forEach((value, index) => {
      const height = (value / max) * target.height;
      ctx.fillRect(index, target.height - height, 1, height);
    });
  }, [session]);

  return (
    <ScrollArea className="h-full">
      <div className="grid gap-3 p-3">
        <canvas ref={canvas} width={256} height={72} className="h-16 w-full rounded-md bg-black/30" />
        <p className="text-[11px] text-muted-foreground">Luminance of the active layer. Adjustments stay on that layer, inside the selection if you have one.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {ADJUST_BUTTONS.map((kind) => (
            <Button
              key={kind}
              variant="secondary"
              size="sm"
              disabled={!session.hasDoc}
              onClick={() => ui.setDialog({ type: "adjust", kind })}
            >
              {ADJUST_LABELS[kind]}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Button variant="ghost" size="sm" disabled={!session.hasDoc} onClick={() => session.instantAdjust("auto")}>
            Auto
          </Button>
          <Button variant="ghost" size="sm" disabled={!session.hasDoc} onClick={() => session.instantAdjust("desaturate")}>
            Mono
          </Button>
          <Button variant="ghost" size="sm" disabled={!session.hasDoc} onClick={() => session.instantAdjust("invert")}>
            Invert
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function HistoryPanel() {
  const session = useSession();
  const rows = ["New document", ...session.past.map((entry) => entry.label)];
  return (
    <ScrollArea className="h-full">
      <ul className="p-2">
        {rows.map((label, index) => {
          const current = index === rows.length - 1;
          return (
            <li key={`${label}-${index}`}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-white/5",
                  current && "bg-white/8 text-foreground",
                )}
                onClick={() => session.jump(index)}
              >
                <span className={cn("mr-2 size-1.5 rounded-full", current ? "bg-copper" : "bg-transparent")} />
                {label}
              </button>
            </li>
          );
        })}
        {!session.hasDoc ? <li className="px-2 py-3 text-[13px] text-muted-foreground">History starts once a plate is open.</li> : null}
      </ul>
    </ScrollArea>
  );
}
