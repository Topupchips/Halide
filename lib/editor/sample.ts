import type { EditorSession } from "@/lib/editor/session";
import { addNoise, vignette } from "@/lib/editor/pixels";

function shade(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
) {
  const gradient = ctx.createRadialGradient(x, y, rx * 0.1, x, y, Math.max(rx, ry));
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function paintStudio(session: EditorSession) {
  session.newDocument({
    width: 1200,
    height: 760,
    background: "#241814",
    name: "Studio still life",
  });
  const base = session.active();
  if (!base) return;
  base.locked = false;
  base.name = "Still life";
  const ctx = base.canvas.getContext("2d")!;
  const width = session.width;
  const height = session.height;

  const wall = ctx.createLinearGradient(0, 0, 0, height);
  wall.addColorStop(0, "#5a3b32");
  wall.addColorStop(0.42, "#3a2620");
  wall.addColorStop(1, "#120e0c");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, height);

  shade(ctx, 240, 70, 420, 280, "rgba(255, 206, 160, 0.28)");
  ctx.fillStyle = "rgba(255, 244, 230, 0.05)";
  ctx.fillRect(0, 0, width, height);

  ctx.beginPath();
  ctx.moveTo(0, 470);
  ctx.bezierCurveTo(280, 430, 860, 500, 1200, 455);
  ctx.lineTo(1200, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  const table = ctx.createLinearGradient(0, 450, 0, height);
  table.addColorStop(0, "#4a3026");
  table.addColorStop(1, "#1a100d");
  ctx.fillStyle = table;
  ctx.fill();

  ctx.save();
  ctx.translate(160, 520);
  ctx.rotate(-0.04);
  const cloth = ctx.createLinearGradient(0, 0, 520, 180);
  cloth.addColorStop(0, "#e6d3b4");
  cloth.addColorStop(0.5, "#c9b18d");
  cloth.addColorStop(1, "#a89070");
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(40, 40);
  ctx.quadraticCurveTo(180, 0, 420, 36);
  ctx.quadraticCurveTo(560, 70, 500, 150);
  ctx.quadraticCurveTo(300, 210, 80, 160);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(90, 58, 36, 0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, 48);
  ctx.quadraticCurveTo(240, 90, 180, 150);
  ctx.stroke();
  ctx.restore();

  shade(ctx, 620, 560, 280, 46, "rgba(0,0,0,0.45)");

  const vase = ctx.createRadialGradient(560, 390, 10, 600, 430, 120);
  vase.addColorStop(0, "#f7f1ea");
  vase.addColorStop(0.55, "#d9d0c6");
  vase.addColorStop(1, "#8d847c");
  ctx.fillStyle = vase;
  ctx.beginPath();
  ctx.moveTo(575, 250);
  ctx.bezierCurveTo(545, 250, 530, 290, 528, 320);
  ctx.bezierCurveTo(470, 340, 455, 420, 500, 490);
  ctx.bezierCurveTo(540, 545, 680, 545, 715, 480);
  ctx.bezierCurveTo(755, 410, 730, 330, 678, 312);
  ctx.bezierCurveTo(676, 280, 650, 248, 620, 248);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(575, 360, 10, 46, -0.4, 0, Math.PI * 2);
  ctx.fill();

  const stem = ctx.createLinearGradient(600, 180, 640, 280);
  stem.addColorStop(0, "#6e8f62");
  stem.addColorStop(1, "#2f4a34");
  ctx.strokeStyle = stem;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(610, 250);
  ctx.quadraticCurveTo(590, 180, 640, 140);
  ctx.stroke();
  ctx.fillStyle = "#3d6848";
  ctx.beginPath();
  ctx.ellipse(668, 150, 36, 16, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2c4a34";
  ctx.beginPath();
  ctx.ellipse(612, 168, 28, 12, -0.8, 0, Math.PI * 2);
  ctx.fill();

  const fruit = (x: number, y: number, radius: number, highlight: string) => {
    shade(ctx, x + 16, y + radius * 0.8, radius * 1.3, radius * 0.35, "rgba(0,0,0,0.35)");
    const gradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.35, radius * 0.1, x, y, radius);
    gradient.addColorStop(0, highlight);
    gradient.addColorStop(0.45, "#e36a24");
    gradient.addColorStop(1, "#8a3414");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.ellipse(x - radius * 0.28, y - radius * 0.32, radius * 0.18, radius * 0.1, -0.6, 0, Math.PI * 2);
    ctx.fill();
  };
  fruit(760, 500, 58, "#ffb067");
  fruit(840, 530, 46, "#ffc27a");

  const bowl = ctx.createLinearGradient(900, 470, 1080, 590);
  bowl.addColorStop(0, "#f0c56a");
  bowl.addColorStop(0.5, "#b8832e");
  bowl.addColorStop(1, "#6d4a16");
  ctx.fillStyle = bowl;
  ctx.beginPath();
  ctx.ellipse(990, 545, 120, 36, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8a5e1d";
  ctx.beginPath();
  ctx.ellipse(990, 532, 92, 22, -0.1, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 236, 196, 0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(990, 528, 90, 18, -0.15, Math.PI * 1.05, Math.PI * 1.7);
  ctx.stroke();

  const image = ctx.getImageData(0, 0, width, height);
  vignette(image.data, width, height, 0.55);
  addNoise(image.data, 6);
  ctx.putImageData(image, 0, 0);

  const light = session.addLayer("Window light", false);
  if (light) {
    light.blendMode = "screen";
    light.opacity = 0.72;
    const lightCtx = light.canvas.getContext("2d")!;
    const glow = lightCtx.createRadialGradient(160, -20, 30, 220, 120, 680);
    glow.addColorStop(0, "rgba(255, 244, 224, 0.95)");
    glow.addColorStop(0.45, "rgba(255, 214, 170, 0.28)");
    glow.addColorStop(1, "rgba(255, 214, 170, 0)");
    lightCtx.fillStyle = glow;
    lightCtx.fillRect(0, 0, width, height);
  }

  const card = session.addLayer("Studio card", false);
  if (card) {
    const cardCtx = card.canvas.getContext("2d")!;
    cardCtx.save();
    cardCtx.translate(150, 575);
    cardCtx.rotate(-0.06);
    cardCtx.fillStyle = "rgba(42, 28, 20, 0.25)";
    cardCtx.fillRect(10, 12, 210, 112);
    cardCtx.fillStyle = "#f6efe4";
    cardCtx.fillRect(0, 0, 210, 112);
    cardCtx.fillStyle = "#c4553a";
    cardCtx.fillRect(0, 0, 6, 112);
    cardCtx.fillStyle = "#2a211c";
    cardCtx.font = "22px Georgia, serif";
    cardCtx.fillText("STUDIO", 22, 42);
    cardCtx.font = "13px Georgia, serif";
    cardCtx.fillStyle = "#6d6258";
    cardCtx.fillText("Afternoon light, plate 04", 22, 68);
    cardCtx.restore();
  }

  session.setActive(base.id);
}
