"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mark } from "@/components/editor/icons";
import { useUI } from "@/components/editor/editor-ui";
import { useSession } from "@/components/editor/use-session";
import type { AdjustKind } from "@/lib/editor/types";
import type { ReactNode } from "react";

export function MenuBar() {
  const session = useSession();
  const ui = useUI();
  const disabled = !session.hasDoc;

  return (
    <header className="flex h-9 shrink-0 items-center border-b border-white/10 bg-panel px-1">
      <div className="mr-1 flex shrink-0 items-center gap-2 px-1 text-copper">
        <Mark className="size-4" />
        <span className="hidden text-[13px] font-semibold tracking-[0.16em] text-foreground sm:inline">HALIDE</span>
      </div>
      <nav className="flex min-w-0 flex-1 items-center overflow-x-auto">
      <Menu label="File">
        <Item label="New…" shortcut={`${ui.mod}N`} onSelect={() => ui.setDialog({ type: "new" })} />
        <Item label="Open…" shortcut={`${ui.mod}O`} onSelect={ui.openFile} />
        <Item label="Load studio still life" onSelect={() => session.loadSample()} />
        <DropdownMenuSeparator />
        <Item label="Export PNG" shortcut={`${ui.mod}S`} disabled={disabled} onSelect={() => void session.exportImage("image/png")} />
        <Item label="Export JPEG" disabled={disabled} onSelect={() => void session.exportImage("image/jpeg")} />
        <Item label="Export WebP" disabled={disabled} onSelect={() => void session.exportImage("image/webp")} />
      </Menu>
      <Menu label="Edit">
        <Item label="Undo" shortcut={`${ui.mod}Z`} disabled={!session.past.length} onSelect={() => session.undo()} />
        <Item label="Redo" shortcut={`${ui.mod}⇧Z`} disabled={!session.future.length} onSelect={() => session.redo()} />
        <DropdownMenuSeparator />
        <Item label="Cut" shortcut={`${ui.mod}X`} disabled={disabled} onSelect={() => session.cut()} />
        <Item label="Copy" shortcut={`${ui.mod}C`} disabled={disabled} onSelect={() => session.copy()} />
        <Item label="Paste" shortcut={`${ui.mod}V`} disabled={disabled} onSelect={() => session.paste()} />
        <Item label="Clear" shortcut="⌫" disabled={disabled} onSelect={() => session.clear()} />
        <Item label="Fill with foreground" disabled={disabled} onSelect={() => session.fill()} />
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={disabled}>Transform</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <Item label="Flip horizontal" disabled={disabled} onSelect={() => session.flip("h", "layer")} />
            <Item label="Flip vertical" disabled={disabled} onSelect={() => session.flip("v", "layer")} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </Menu>
      <Menu label="Image">
        <Item label="Image size…" disabled={disabled} onSelect={() => ui.setDialog({ type: "size" })} />
        <DropdownMenuSeparator />
        <AdjustItem kind="brightness" label="Brightness / Contrast" />
        <AdjustItem kind="hue" label="Hue / Saturation" />
        <AdjustItem kind="levels" label="Levels" />
        <AdjustItem kind="exposure" label="Exposure" />
        <DropdownMenuSeparator />
        <Item label="Auto levels" disabled={disabled} onSelect={() => session.instantAdjust("auto")} />
        <Item label="Desaturate" disabled={disabled} onSelect={() => session.instantAdjust("desaturate")} />
        <Item label="Invert" shortcut={`${ui.mod}I`} disabled={disabled} onSelect={() => session.instantAdjust("invert")} />
        <DropdownMenuSeparator />
        <Item label="Rotate 90° clockwise" disabled={disabled} onSelect={() => session.rotateCanvas(1)} />
        <Item label="Rotate 90° counterclockwise" disabled={disabled} onSelect={() => session.rotateCanvas(-1)} />
        <Item label="Flip canvas horizontal" disabled={disabled} onSelect={() => session.flip("h", "canvas")} />
        <Item label="Flip canvas vertical" disabled={disabled} onSelect={() => session.flip("v", "canvas")} />
      </Menu>
      <Menu label="Layer">
        <Item label="New layer" disabled={disabled} onSelect={() => session.addLayer()} />
        <Item label="Duplicate layer" disabled={disabled} onSelect={() => session.active() && session.duplicate(session.active()!.id)} />
        <Item label="Delete layer" disabled={disabled} onSelect={() => session.active() && session.deleteLayer(session.active()!.id)} />
        <Item label="Merge down" disabled={disabled} onSelect={() => session.active() && session.mergeDown(session.active()!.id)} />
        <Item label="Flatten image" disabled={disabled} onSelect={() => session.flatten()} />
      </Menu>
      <Menu label="Select">
        <Item label="All" shortcut={`${ui.mod}A`} disabled={disabled} onSelect={() => session.selectAll()} />
        <Item label="Deselect" shortcut={`${ui.mod}D`} disabled={disabled} onSelect={() => session.deselect()} />
        <Item label="Inverse" shortcut={`${ui.mod}⇧I`} disabled={disabled} onSelect={() => session.invertSelection()} />
      </Menu>
      <Menu label="Filter">
        <AdjustItem kind="blur" label="Gaussian blur" />
        <AdjustItem kind="sharpen" label="Sharpen" />
        <AdjustItem kind="noise" label="Add noise" />
        <AdjustItem kind="pixelate" label="Pixelate" />
        <AdjustItem kind="vignette" label="Vignette" />
      </Menu>
      <Menu label="View">
        <Item label="Zoom in" shortcut={`${ui.mod}+`} disabled={disabled} onSelect={() => session.requestView("in")} />
        <Item label="Zoom out" shortcut={`${ui.mod}−`} disabled={disabled} onSelect={() => session.requestView("out")} />
        <Item label="Fit on screen" shortcut={`${ui.mod}0`} disabled={disabled} onSelect={() => session.requestView("fit")} />
        <Item label="100%" shortcut={`${ui.mod}1`} disabled={disabled} onSelect={() => session.requestView("actual")} />
        <DropdownMenuSeparator />
        <Item label={session.showRulers ? "Hide rulers" : "Show rulers"} disabled={disabled} onSelect={() => session.toggleRulers()} />
        <Item label={session.showGrid ? "Hide grid" : "Show grid"} disabled={disabled} onSelect={() => session.toggleGrid()} />
        <DropdownMenuSeparator />
        <Item label="Keyboard shortcuts" shortcut="?" onSelect={() => ui.setDialog({ type: "shortcuts" })} />
      </Menu>
      </nav>
      <div className="shrink-0 lg:hidden">
        <Button variant="ghost" size="sm" onClick={() => ui.setPanels(true)}>
          Panels
        </Button>
      </div>
    </header>
  );
}

function Menu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-1 text-[13px] font-normal sm:px-2">
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Item({
  label,
  shortcut,
  disabled,
  onSelect,
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem disabled={disabled} onSelect={onSelect}>
      {label}
      {shortcut ? <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut> : null}
    </DropdownMenuItem>
  );
}

function AdjustItem({ kind, label }: { kind: AdjustKind; label: string }) {
  const session = useSession();
  const ui = useUI();
  return (
    <Item
      label={label}
      disabled={!session.hasDoc}
      onSelect={() => ui.setDialog({ type: "adjust", kind })}
    />
  );
}
