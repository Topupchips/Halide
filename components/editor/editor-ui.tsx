"use client";

import type { AdjustKind, SelectMode, ToolId } from "@/lib/editor/types";
import { createContext, useContext, type ReactNode } from "react";

export type DialogKind =
  | null
  | { type: "new" }
  | { type: "size" }
  | { type: "shortcuts" }
  | { type: "adjust"; kind: AdjustKind };

export type EditorUI = {
  tool: ToolId;
  setTool: (tool: ToolId) => void;
  variant: (family: "select" | "fill" | "shape") => ToolId;
  setFamilyTool: (tool: ToolId) => void;
  size: number;
  setSize: (value: number | ((value: number) => number)) => void;
  hardness: number;
  setHardness: (value: number | ((value: number) => number)) => void;
  brushOpacity: number;
  setBrushOpacity: (value: number | ((value: number) => number)) => void;
  tolerance: number;
  setTolerance: (value: number) => void;
  gradient: "linear" | "radial";
  setGradient: (value: "linear" | "radial") => void;
  shapeFill: boolean;
  setShapeFill: (value: boolean) => void;
  shapeStroke: boolean;
  setShapeStroke: (value: boolean) => void;
  strokeWidth: number;
  setStrokeWidth: (value: number) => void;
  font: "sans" | "serif" | "mono";
  setFont: (value: "sans" | "serif" | "mono") => void;
  fontSize: number;
  setFontSize: (value: number) => void;
  selectMode: SelectMode;
  setSelectMode: (value: SelectMode) => void;
  dialog: DialogKind;
  setDialog: (value: DialogKind) => void;
  panels: boolean;
  setPanels: (value: boolean) => void;
  openFile: () => void;
  mod: string;
};

const EditorUIContext = createContext<EditorUI | null>(null);

export function EditorUIProvider({ value, children }: { value: EditorUI; children: ReactNode }) {
  return <EditorUIContext.Provider value={value}>{children}</EditorUIContext.Provider>;
}

export function useUI() {
  const value = useContext(EditorUIContext);
  if (!value) throw new Error("Halide controls are only available inside the editor.");
  return value;
}
