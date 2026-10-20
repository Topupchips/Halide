export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ToolIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {iconPath(name)}
    </svg>
  );
}

function iconPath(name: string) {
  switch (name) {
    case "move":
      return <path d="M12 3v18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12h18M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />;
    case "marquee":
      return <rect x="4" y="5" width="16" height="14" strokeDasharray="2.5 2.2" />;
    case "ellipse-select":
      return <ellipse cx="12" cy="12" rx="8" ry="6" strokeDasharray="2.5 2.2" />;
    case "lasso":
      return <path d="M7 8c3-4 9-3 10 1 1 4-1 6-3 7-2 1-5 2-6 0-1-2 2-3 1-5" />;
    case "crop":
      return <path d="M7 3v14h14M3 7h14M17 17v4M7 7H3" />;
    case "eyedropper":
      return <path d="M14.5 5.5l4 4M9 16l-3 3 2 2 3-3M13 7l4 4-7 7H6v-4l7-7z" />;
    case "brush":
      return <path d="M15 4l5 5-8.5 8.5a3 3 0 0 1-4.2.2L6 16.4A3 3 0 0 1 6.2 12L15 4zM5 19c1.2.4 2.2.2 3-.6" />;
    case "eraser":
      return <path d="M4 15l7-8 6 6-5 5H8L4 15zM9 19h11" />;
    case "bucket":
      return <path d="M8 11l6-7 4 4-6 7H8v-4zM7 18h8M14 8l2 2" />;
    case "gradient":
      return (
        <>
          <rect x="4" y="5" width="16" height="14" />
          <path d="M7 16c2-6 8-6 10-0" />
        </>
      );
    case "clone":
      return (
        <>
          <circle cx="9" cy="10" r="4" />
          <circle cx="15" cy="14" r="4" />
        </>
      );
    case "text":
      return <path d="M6 6h12M12 6v13M9 19h6" />;
    case "shape":
      return <rect x="5" y="5" width="14" height="14" />;
    case "ellipse-shape":
      return <ellipse cx="12" cy="12" rx="7.5" ry="6" />;
    case "hand":
      return <path d="M8 11V6.5a1.5 1.5 0 0 1 3 0V11M11 10V5.5a1.5 1.5 0 0 1 3 0V11M14 10.5V7.5a1.5 1.5 0 0 1 3 0V14c0 3-2 5.5-5 5.5-2.5 0-4-1.2-5-2.5L5 14.5A1.5 1.5 0 0 1 7.5 13L8 13.5" />;
    case "zoom":
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="M15.5 15.5L20 20M11 8.5v5M8.5 11h5" />
        </>
      );
    default:
      return null;
  }
}
