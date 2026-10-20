"use client";

import { useSession } from "@/components/editor/use-session";
import { useUI } from "@/components/editor/editor-ui";
import { TOOLS } from "@/lib/editor/tools";
import { getSession } from "@/lib/editor/session";
import { useEffect, useRef } from "react";

export function StatusBar() {
  const session = useSession();
  const ui = useUI();
  const cursorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const point = getSession().pointer;
      if (cursorRef.current) {
        cursorRef.current.textContent = point ? `${Math.round(point.x)}, ${Math.round(point.y)}` : "—";
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-white/10 bg-panel px-3 font-mono text-[11px] text-muted-foreground">
      <span className="text-foreground">{TOOLS[ui.tool].label}</span>
      <span>{session.hasDoc ? `${session.width} × ${session.height}` : "No plate"}</span>
      <span>{session.hasDoc ? `${Math.round(session.zoom * 100)}%` : ""}</span>
      <span ref={cursorRef}>—</span>
      <span className="min-w-0 flex-1 truncate text-copper">{session.notice ?? (session.hasDoc ? session.name : "No plate open")}</span>
      <span className="hidden sm:inline">{session.hasDoc ? (session.past.length ? "Edited" : "Saved in this tab") : ""}</span>
    </footer>
  );
}
