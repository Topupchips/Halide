"use client";

import { EditorDialogs } from "@/components/editor/dialogs";
import { EditorUIProvider, type DialogKind, type EditorUI } from "@/components/editor/editor-ui";
import { MenuBar } from "@/components/editor/menu-bar";
import { OptionsBar } from "@/components/editor/options-bar";
import { SidePanel } from "@/components/editor/panels";
import { StatusBar } from "@/components/editor/status-bar";
import { ToolRail } from "@/components/editor/tool-rail";
import { useSession } from "@/components/editor/use-session";
import { Workspace } from "@/components/editor/workspace";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { clamp } from "@/lib/editor/color";
import { loadImageFile } from "@/lib/editor/load-image";
import { getSession } from "@/lib/editor/session";
import type { SelectMode, ToolId } from "@/lib/editor/types";
import { useEffect, useRef, useState } from "react";

function familyOf(tool: ToolId) {
  if (tool === "marquee" || tool === "ellipse-select") return "select" as const;
  if (tool === "bucket" || tool === "gradient") return "fill" as const;
  if (tool === "shape" || tool === "ellipse-shape") return "shape" as const;
  return null;
}

function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)
  );
}

export function EditorApp() {
  const session = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tool, setToolState] = useState<ToolId>("brush");
  const [variants, setVariants] = useState({ select: "marquee" as ToolId, fill: "bucket" as ToolId, shape: "shape" as ToolId });
  const [size, setSize] = useState(28);
  const [hardness, setHardness] = useState(0.75);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [tolerance, setTolerance] = useState(32);
  const [gradient, setGradient] = useState<"linear" | "radial">("linear");
  const [shapeFill, setShapeFill] = useState(true);
  const [shapeStroke, setShapeStroke] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [font, setFont] = useState<"sans" | "serif" | "mono">("sans");
  const [fontSize, setFontSize] = useState(64);
  const [selectMode, setSelectMode] = useState<SelectMode>("replace");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [panels, setPanels] = useState(false);
  const mod = "⌘/Ctrl";

  const setTool = (next: ToolId) => {
    setToolState(next);
    const family = familyOf(next);
    if (family) setVariants((current) => ({ ...current, [family]: next }));
  };

  const ui: EditorUI = {
    tool,
    setTool,
    variant: (family) => variants[family],
    setFamilyTool: setTool,
    size,
    setSize,
    hardness,
    setHardness,
    brushOpacity,
    setBrushOpacity,
    tolerance,
    setTolerance,
    gradient,
    setGradient,
    shapeFill,
    setShapeFill,
    shapeStroke,
    setShapeStroke,
    strokeWidth,
    setStrokeWidth,
    font,
    setFont,
    fontSize,
    setFontSize,
    selectMode,
    setSelectMode,
    dialog,
    setDialog,
    panels,
    setPanels,
    openFile: () => fileRef.current?.click(),
    mod,
  };

  useEffect(() => {
    document.title = session.hasDoc ? `Halide — ${session.name}` : "Halide";
  }, [session.hasDoc, session.name, session.revision]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (dialog) return;
      if (typing(event.target)) return;
      const current = getSession();
      const modKey = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modKey && key === "z") {
        event.preventDefault();
        if (event.shiftKey) current.redo();
        else current.undo();
        return;
      }
      if (modKey && key === "y") {
        event.preventDefault();
        current.redo();
        return;
      }
      if (modKey && key === "s") {
        event.preventDefault();
        void current.exportImage("image/png");
        return;
      }
      if (modKey && key === "o") {
        event.preventDefault();
        fileRef.current?.click();
        return;
      }
      if (modKey && key === "n") {
        event.preventDefault();
        setDialog({ type: "new" });
        return;
      }
      if (modKey && key === "a") {
        event.preventDefault();
        current.selectAll();
        return;
      }
      if (modKey && key === "d") {
        event.preventDefault();
        current.deselect();
        return;
      }
      if (modKey && key === "c") {
        event.preventDefault();
        current.copy();
        return;
      }
      if (modKey && key === "x") {
        event.preventDefault();
        current.cut();
        return;
      }
      if (modKey && key === "v") {
        event.preventDefault();
        current.paste();
        return;
      }
      if (modKey && key === "i" && event.shiftKey) {
        event.preventDefault();
        current.invertSelection();
        return;
      }
      if (modKey && key === "i") {
        event.preventDefault();
        current.instantAdjust("invert");
        return;
      }
      if (modKey && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        current.requestView("in");
        return;
      }
      if (modKey && key === "-") {
        event.preventDefault();
        current.requestView("out");
        return;
      }
      if (modKey && key === "0") {
        event.preventDefault();
        current.requestView("fit");
        return;
      }
      if (modKey && key === "1") {
        event.preventDefault();
        current.requestView("actual");
        return;
      }
      if (event.key === "Escape") {
        if (current.crop) current.setCrop(null);
        else current.deselect();
        return;
      }
      if (event.key === "Enter" && tool === "crop") {
        current.applyCrop();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        current.clear();
        return;
      }
      if (event.key === "?" ) {
        setDialog({ type: "shortcuts" });
        return;
      }
      if (!modKey && key === "x") {
        current.swapColors();
        return;
      }
      if (!modKey && key === "d") {
        current.resetColors();
        return;
      }
      if (event.key === "[" || event.key === "]") {
        event.preventDefault();
        const direction = event.key === "]" ? 1 : -1;
        if (event.shiftKey) setHardness((value) => clamp(value + direction * 0.05, 0, 1));
        else setSize((value) => clamp(value + direction * (value >= 40 ? 10 : 2), 1, 400));
        return;
      }
      if (!modKey && /^[0-9]$/.test(event.key)) {
        const amount = event.key === "0" ? 1 : Number(event.key) / 10;
        if (tool === "brush" || tool === "eraser" || tool === "clone") setBrushOpacity(amount);
        else if (current.active()) {
          current.pushHistory("Layer opacity");
          current.setOpacity(current.active()!.id, amount);
        }
        return;
      }
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        current.nudge(dx, dy);
        return;
      }
      if (modKey || event.altKey) return;

      if (key === "m") setTool(tool === "marquee" ? "ellipse-select" : tool === "ellipse-select" ? "marquee" : variants.select);
      else if (key === "g") setTool(tool === "bucket" ? "gradient" : tool === "gradient" ? "bucket" : variants.fill);
      else if (key === "u") setTool(tool === "shape" ? "ellipse-shape" : tool === "ellipse-shape" ? "shape" : variants.shape);
      else if (key === "v") setTool("move");
      else if (key === "l") setTool("lasso");
      else if (key === "c") setTool("crop");
      else if (key === "i") setTool("eyedropper");
      else if (key === "b") setTool("brush");
      else if (key === "e") setTool("eraser");
      else if (key === "s") setTool("clone");
      else if (key === "t") setTool("text");
      else if (key === "h") setTool("hand");
      else if (key === "z") setTool("zoom");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, tool, variants]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!getSession().past.length) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const openFiles = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (!images.length) {
      const current = getSession();
      current.notice = "Halide can open PNG, JPEG, WebP, and GIF.";
      current.emit("change");
      return;
    }
    for (let index = 0; index < images.length; index++) {
      const file = images[index];
      try {
        const image = await loadImageFile(file);
        const current = getSession();
        const title = file.name.replace(/\.[^.]+$/, "");
        if (!current.hasDoc && index === 0) current.openImage(image, image.naturalWidth, image.naturalHeight, title);
        else current.addImageLayer(image, image.naturalWidth, image.naturalHeight, file.name);
      } catch {
        const current = getSession();
        current.notice = `Could not read ${file.name}.`;
        current.emit("change");
      }
    }
  };

  return (
    <TooltipProvider>
      <EditorUIProvider value={ui}>
        <div
          className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void openFiles([...event.dataTransfer.files]);
          }}
        >
          <MenuBar />
          <OptionsBar />
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <ToolRail />
            <Workspace />
            <aside className="hidden h-full w-[300px] shrink-0 border-l border-white/10 lg:block">
              <SidePanel />
            </aside>
          </div>
          <StatusBar />
          <EditorDialogs />
          <Sheet open={panels} onOpenChange={setPanels}>
            <SheetContent side="right" className="w-[min(100%,340px)] p-0">
              <SheetHeader className="border-b border-white/10">
                <SheetTitle>Panels</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1">
                <SidePanel />
              </div>
            </SheetContent>
          </Sheet>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              void openFiles(files);
            }}
          />
        </div>
      </EditorUIProvider>
    </TooltipProvider>
  );
}
