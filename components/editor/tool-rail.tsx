"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToolIcon } from "@/components/editor/icons";
import { useUI } from "@/components/editor/editor-ui";
import { useSession } from "@/components/editor/use-session";
import { RAIL, TOOLS } from "@/lib/editor/tools";
import type { ToolId } from "@/lib/editor/types";
import { cn } from "cn";

export function ToolRail() {
  const ui = useUI();
  const session = useSession();

  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/10 bg-panel px-1.5 py-1 lg:w-[52px] lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-1.5 lg:py-2">
      {RAIL.map((entry) => {
        const family = entry.family;
        const activeInFamily = family?.includes(ui.tool) ? ui.tool : null;
        const id = activeInFamily ?? (family ? ui.variant(familyName(entry.id)) : entry.id);
        const meta = TOOLS[id];
        const active = ui.tool === id || Boolean(family?.includes(ui.tool));
        return (
          <Tooltip key={entry.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={meta.label}
                aria-pressed={active}
                className={cn(
                  "relative grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground",
                  active && "bg-copper/15 text-copper",
                )}
                onClick={() => ui.setTool(id)}
              >
                <ToolIcon name={id} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {meta.label}
              <span className="ml-2 font-mono text-[10px] opacity-70">{meta.shortcut}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
      <div className="mx-1 hidden h-px w-6 bg-white/10 lg:my-2 lg:block" />
      <ColorWells />
      <span className="sr-only">{session.foreground}</span>
    </div>
  );
}

function familyName(id: ToolId): "select" | "fill" | "shape" {
  if (id === "bucket") return "fill";
  if (id === "shape") return "shape";
  return "select";
}

function ColorWells() {
  const session = useSession();
  return (
    <div className="relative ml-auto size-9 shrink-0 lg:ml-0 lg:mt-auto">
      <button
        type="button"
        aria-label="Background color"
        className="absolute top-1.5 right-0 size-5 rounded-sm border border-black/40 shadow-sm"
        style={{ background: session.background }}
        onClick={() => {
          const input = document.getElementById("halide-bg") as HTMLInputElement | null;
          input?.click();
        }}
      />
      <button
        type="button"
        aria-label="Foreground color"
        className="absolute top-0 left-0 size-5 rounded-sm border border-black/40 shadow-sm"
        style={{ background: session.foreground }}
        onClick={() => {
          const input = document.getElementById("halide-fg") as HTMLInputElement | null;
          input?.click();
        }}
      />
      <input
        id="halide-fg"
        className="sr-only"
        type="color"
        value={session.foreground}
        onChange={(event) => session.setForeground(event.target.value)}
      />
      <input
        id="halide-bg"
        className="sr-only"
        type="color"
        value={session.background}
        onChange={(event) => session.setBackground(event.target.value)}
      />
    </div>
  );
}
