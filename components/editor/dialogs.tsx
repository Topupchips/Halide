"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/editor/field";
import { useUI } from "@/components/editor/editor-ui";
import { useSession } from "@/components/editor/use-session";
import { ADJUST_FIELDS, ADJUST_LABELS, defaultAdjustValues } from "@/lib/editor/adjust";
import { getSession } from "@/lib/editor/session";
import { PRESETS, TOOLS } from "@/lib/editor/tools";
import type { AdjustKind } from "@/lib/editor/types";
import { useEffect, useState } from "react";

export function EditorDialogs() {
  const ui = useUI();
  const session = useSession();
  return (
    <>
      <NewDocumentDialog />
      <ImageSizeDialog />
      <ShortcutsDialog />
      {ui.dialog?.type === "adjust" ? <AdjustDialog kind={ui.dialog.kind} key={ui.dialog.kind} /> : null}
      <span className="sr-only">{session.name}</span>
    </>
  );
}

function NewDocumentDialog() {
  const ui = useUI();
  const open = ui.dialog?.type === "new";
  const [width, setWidth] = useState(1440);
  const [height, setHeight] = useState(900);
  const [background, setBackground] = useState("#f4efe6");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && ui.setDialog(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New plate</DialogTitle>
          <DialogDescription>Choose a size. Transparent plates start with an empty layer.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="secondary"
              size="sm"
              onClick={() => {
                setWidth(preset.width);
                setHeight(preset.height);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Label className="grid gap-1.5">
            Width
            <Input type="number" min={1} max={8192} value={width} onChange={(event) => setWidth(Number(event.target.value))} />
          </Label>
          <Label className="grid gap-1.5">
            Height
            <Input type="number" min={1} max={8192} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
          </Label>
        </div>
        <div className="flex gap-2">
          {[
            ["#f4efe6", "Paper"],
            ["#111111", "Ink"],
            ["transparent", "Clear"],
          ].map(([value, label]) => (
            <Button key={value} variant={background === value ? "default" : "secondary"} size="sm" onClick={() => setBackground(value)}>
              {label}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              getSession().newDocument({ width, height, background, name: "Untitled" });
              ui.setDialog(null);
            }}
          >
            Create plate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImageSizeDialog() {
  const ui = useUI();
  const open = ui.dialog?.type === "size";
  return (
    <Dialog open={open} onOpenChange={(next) => !next && ui.setDialog(null)}>
      <DialogContent>
        {open ? <ImageSizeForm onDone={() => ui.setDialog(null)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ImageSizeForm({ onDone }: { onDone: () => void }) {
  const session = useSession();
  const [width, setWidth] = useState(session.width || 1440);
  const [height, setHeight] = useState(session.height || 900);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Image size</DialogTitle>
        <DialogDescription>Resamples every layer. Undo brings the previous plate back.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <Label className="grid gap-1.5">
          Width
          <Input type="number" min={1} max={8192} value={width} onChange={(event) => setWidth(Number(event.target.value))} />
        </Label>
        <Label className="grid gap-1.5">
          Height
          <Input type="number" min={1} max={8192} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
        </Label>
      </div>
      <DialogFooter>
        <Button
          onClick={() => {
            session.resize(width, height);
            onDone();
          }}
        >
          Resize
        </Button>
      </DialogFooter>
    </>
  );
}

function AdjustDialog({ kind }: { kind: AdjustKind }) {
  const ui = useUI();
  const session = useSession();
  const [values, setValues] = useState<Record<string, number>>(() => defaultAdjustValues(kind));
  const layer = session.active();
  const ready = Boolean(layer && !layer.locked);

  useEffect(() => {
    if (!ready) return;
    getSession().beginPreview();
    return () => getSession().cancelPreview();
  }, [ready]);

  const close = () => ui.setDialog(null);

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ADJUST_LABELS[kind]}</DialogTitle>
          <DialogDescription>
            {ready ? `Previewing on ${session.active()?.name ?? "the active layer"}.` : "Unlock the active layer to adjust it."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {ADJUST_FIELDS[kind].map((field) => (
            <Field
              key={field.key}
              label={field.label}
              min={field.min}
              max={field.max}
              step={field.step}
              value={values[field.key] ?? field.value}
              onChange={(value) => {
                const next = { ...values, [field.key]: value };
                setValues(next);
                if (ready) session.previewAdjust(kind, next);
              }}
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!ready}
            onClick={() => {
              session.commitPreview(ADJUST_LABELS[kind]);
              close();
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutsDialog() {
  const ui = useUI();
  const groups = [
    ["Tools", Object.values(TOOLS).map((tool) => [tool.shortcut, tool.label])],
    ["Edit", [["⌘/Ctrl Z", "Undo"], ["⌘/Ctrl ⇧ Z", "Redo"], ["⌘/Ctrl C / X / V", "Copy, cut, paste"], ["⌘/Ctrl A", "Select all"], ["⌘/Ctrl D", "Deselect"], ["⌫", "Clear"]]],
    ["View", [["⌘/Ctrl +", "Zoom in"], ["⌘/Ctrl −", "Zoom out"], ["⌘/Ctrl 0", "Fit"], ["⌘/Ctrl 1", "100%"], ["Space", "Pan"], ["?", "This list"]]],
    ["Brush", [["[ ]", "Size"], ["⇧ [ ]", "Hardness"], ["1–0", "Opacity"], ["X", "Swap colors"], ["D", "Default colors"]]],
  ] as const;
  return (
    <Dialog open={ui.dialog?.type === "shortcuts"} onOpenChange={(next) => !next && ui.setDialog(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Shortcuts</DialogTitle>
          <DialogDescription>The same keys a desktop darkroom teaches your hands.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-auto pr-1 sm:grid-cols-2">
          {groups.map(([title, rows]) => (
            <section key={title}>
              <h3 className="mb-1 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{title}</h3>
              <ul>
                {rows.map(([key, label]) => (
                  <li key={label} className="flex items-center justify-between gap-3 border-b border-white/8 py-1 text-[13px]">
                    <span>{label}</span>
                    <span className="font-mono text-[11px] text-copper">{key}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
