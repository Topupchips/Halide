"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/editor/field";
import { useUI } from "@/components/editor/editor-ui";
import { useSession } from "@/components/editor/use-session";
import { TOOLS } from "@/lib/editor/tools";
import type { SelectMode, ToolId } from "@/lib/editor/types";
import { cn } from "cn";

export function OptionsBar() {
  const ui = useUI();
  const session = useSession();
  const meta = TOOLS[ui.tool];
  const painting = ui.tool === "brush" || ui.tool === "eraser" || ui.tool === "clone";

  return (
    <div className="flex min-h-12 shrink-0 items-center gap-3 overflow-x-auto border-b border-white/10 bg-[#1a1816] px-3 py-1.5">
      <p className="hidden min-w-36 text-[12px] text-muted-foreground sm:block">
        <span className="text-foreground">{meta.label}</span>
        <span className="mx-2 text-white/20">/</span>
        {meta.hint}
      </p>
      <div className="ml-auto flex items-center gap-3">
        {ui.tool === "marquee" || ui.tool === "ellipse-select" ? (
          <Segment
            value={ui.tool}
            options={[
              ["marquee", "Rect"],
              ["ellipse-select", "Ellipse"],
            ]}
            onChange={(value) => ui.setFamilyTool(value as ToolId)}
          />
        ) : null}
        {ui.tool === "marquee" || ui.tool === "ellipse-select" || ui.tool === "lasso" ? (
          <Segment
            value={ui.selectMode}
            options={[
              ["replace", "New"],
              ["add", "Add"],
              ["subtract", "Subtract"],
            ]}
            onChange={(value) => ui.setSelectMode(value as SelectMode)}
          />
        ) : null}
        {ui.tool === "bucket" || ui.tool === "gradient" ? (
          <Segment
            value={ui.tool}
            options={[
              ["bucket", "Bucket"],
              ["gradient", "Gradient"],
            ]}
            onChange={(value) => ui.setFamilyTool(value as ToolId)}
          />
        ) : null}
        {ui.tool === "gradient" ? (
          <Segment
            value={ui.gradient}
            options={[
              ["linear", "Linear"],
              ["radial", "Radial"],
            ]}
            onChange={(value) => ui.setGradient(value as "linear" | "radial")}
          />
        ) : null}
        {ui.tool === "shape" || ui.tool === "ellipse-shape" ? (
          <>
            <Segment
              value={ui.tool}
              options={[
                ["shape", "Rect"],
                ["ellipse-shape", "Ellipse"],
              ]}
              onChange={(value) => ui.setFamilyTool(value as ToolId)}
            />
            <label className="flex items-center gap-1.5 text-[12px]">
              <input type="checkbox" checked={ui.shapeFill} onChange={(event) => ui.setShapeFill(event.target.checked)} />
              Fill
            </label>
            <label className="flex items-center gap-1.5 text-[12px]">
              <input type="checkbox" checked={ui.shapeStroke} onChange={(event) => ui.setShapeStroke(event.target.checked)} />
              Stroke
            </label>
            <div className="w-28">
              <Field label="Width" value={ui.strokeWidth} min={1} max={64} step={1} onChange={ui.setStrokeWidth} />
            </div>
          </>
        ) : null}
        {painting ? (
          <>
            <div className="w-32">
              <Field label="Size" value={ui.size} min={1} max={400} step={1} onChange={ui.setSize} />
            </div>
            <div className="w-32">
              <Field label="Hardness" value={ui.hardness} min={0} max={1} step={0.01} onChange={ui.setHardness} format={(value) => `${Math.round(value * 100)}%`} />
            </div>
            <div className="w-32">
              <Field label="Opacity" value={ui.brushOpacity} min={0.02} max={1} step={0.01} onChange={ui.setBrushOpacity} format={(value) => `${Math.round(value * 100)}%`} />
            </div>
          </>
        ) : null}
        {ui.tool === "bucket" ? (
          <div className="w-36">
            <Field label="Tolerance" value={ui.tolerance} min={0} max={255} step={1} onChange={ui.setTolerance} />
          </div>
        ) : null}
        {ui.tool === "text" ? (
          <>
            <Segment
              value={ui.font}
              options={[
                ["sans", "Sans"],
                ["serif", "Serif"],
                ["mono", "Mono"],
              ]}
              onChange={(value) => ui.setFont(value as "sans" | "serif" | "mono")}
            />
            <div className="w-28">
              <Field label="Size" value={ui.fontSize} min={8} max={240} step={1} onChange={ui.setFontSize} />
            </div>
          </>
        ) : null}
        {ui.tool === "crop" ? (
          <>
            <span className="font-mono text-[11px] text-muted-foreground">
              {session.crop ? `${Math.round(session.crop.w)} × ${Math.round(session.crop.h)}` : "No crop"}
            </span>
            <Button size="sm" variant="secondary" disabled={!session.crop} onClick={() => session.setCrop(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!session.crop} onClick={() => session.applyCrop()}>
              Apply crop
            </Button>
          </>
        ) : null}
        {ui.tool === "zoom" || ui.tool === "hand" ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => session.requestView("out")}>
              −
            </Button>
            <span className="w-12 text-center font-mono text-[12px]">{Math.round(session.zoom * 100)}%</span>
            <Button size="sm" variant="secondary" onClick={() => session.requestView("in")}>
              +
            </Button>
            <Button size="sm" variant="ghost" onClick={() => session.requestView("fit")}>
              Fit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => session.requestView("actual")}>
              100%
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Segment({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex rounded-md bg-black/25 p-0.5">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={cn(
            "h-7 rounded px-2.5 text-[12px] text-muted-foreground",
            value === id && "bg-white/10 text-foreground",
          )}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
