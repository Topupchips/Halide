export type Point = { x: number; y: number };

export type Rect = { x: number; y: number; w: number; h: number };

export function normalizeRect(x: number, y: number, w: number, h: number): Rect {
  return {
    x: w < 0 ? x + w : x,
    y: h < 0 ? y + h : y,
    w: Math.abs(w),
    h: Math.abs(h),
  };
}

export function dragRect(
  start: Point,
  current: Point,
  options: { square?: boolean; center?: boolean },
): Rect {
  let x1 = start.x;
  let y1 = start.y;
  let x2 = current.x;
  let y2 = current.y;
  if (options.square) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    x2 = x1 + Math.sign(dx || 1) * side;
    y2 = y1 + Math.sign(dy || 1) * side;
  }
  if (options.center) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    x1 = start.x - dx;
    y1 = start.y - dy;
    x2 = start.x + dx;
    y2 = start.y + dy;
  }
  return normalizeRect(x1, y1, x2 - x1, y2 - y1);
}
