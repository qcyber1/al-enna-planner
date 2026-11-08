// رسم الغرف والأثاث الداخلي في المسقط (مثل مخططات المهندسين): أرضية، جدران سميكة، أبواب بقوس الفتح، شبابيك
import type { FloorFinish, PlanElement } from '../types/plan';
import { shade } from '../lib/color';
import { SIDES, WALL, sidePoint, wallPieces } from '../lib/rooms';
import type { DrawOpts } from './draw';
import { outline } from './drawExtra';

type Ctx = CanvasRenderingContext2D;
const px = (o: DrawOpts, n: number) => n / o.ppm;
const lw = (o: DrawOpts, n: number) => Math.max(px(o, n), 0.015);

const FLOOR_BASE: Record<FloorFinish, string> = {
  marble: '#f2f1ee',
  wood: '#c9a27a',
  microcement: '#b9b6b0',
  tiles: '#e6e0d4',
  carpet: '#c8b89a',
};

function floor(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const r = el.room!;
  const w = el.width - 2 * WALL;
  const d = el.depth - 2 * WALL;
  const x0 = -w / 2;
  const y0 = -d / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, d);
  ctx.clip();
  ctx.fillStyle = FLOOR_BASE[r.floor];
  ctx.fillRect(x0, y0, w, d);
  ctx.lineWidth = lw(o, 0.6);
  if (r.floor === 'wood') {
    ctx.strokeStyle = 'rgba(90,55,25,0.35)';
    for (let y = y0; y < y0 + d; y += 0.2) {
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,55,25,0.25)';
    let k = 0;
    for (let y = y0; y < y0 + d; y += 0.2, k++)
      for (let x = x0 + (k % 3) * 0.4; x < x0 + w; x += 1.2) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 0.2);
        ctx.stroke();
      }
  } else if (r.floor === 'tiles' || r.floor === 'marble') {
    const s = r.floor === 'marble' ? 1.2 : 0.6;
    ctx.strokeStyle = r.floor === 'marble' ? 'rgba(120,120,120,0.25)' : 'rgba(110,95,75,0.35)';
    for (let x = x0; x <= x0 + w; x += s) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + d);
      ctx.stroke();
    }
    for (let y = y0; y <= y0 + d; y += s) {
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w, y);
      ctx.stroke();
    }
    if (r.floor === 'marble') {
      // عروق الرخام
      ctx.strokeStyle = 'rgba(40,40,40,0.35)';
      ctx.lineWidth = lw(o, 0.8);
      let seed = Math.round(el.width * 31 + el.depth * 17);
      const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      for (let i = 0; i < Math.max(2, Math.round((w * d) / 6)); i++) {
        const sx = x0 + rnd() * w;
        const sy = y0 + rnd() * d;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(sx + rnd() * 1.2, sy + rnd() * 0.6, sx + rnd() * 1.8, sy - rnd() * 0.5, sx + 1 + rnd() * 1.5, sy + rnd() * 0.8);
        ctx.stroke();
      }
    }
  } else if (r.floor === 'microcement') {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(x0 + ((i * 0.37) % 1) * w, y0 + ((i * 0.61) % 1) * d, w * 0.25, d * 0.18, i, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function walls(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const wallFill = '#3b2f26';
  for (const side of SIDES) {
    for (const p of wallPieces(el, side)) {
      const a0 = sidePoint(el, side, p.a, 0);
      const a1 = sidePoint(el, side, p.a, WALL);
      const b1 = sidePoint(el, side, p.b, WALL);
      const b0 = sidePoint(el, side, p.b, 0);
      if (p.kind === 'solid') {
        ctx.fillStyle = wallFill;
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(a1.x, a1.y);
        ctx.lineTo(b1.x, b1.y);
        ctx.lineTo(b0.x, b0.y);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'window') {
        // شباك: خطين رفيعين داخل سماكة الجدار
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(a1.x, a1.y);
        ctx.lineTo(b1.x, b1.y);
        ctx.lineTo(b0.x, b0.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2f6fb0';
        ctx.lineWidth = lw(o, 1);
        for (const n of [WALL * 0.33, WALL * 0.67]) {
          const s = sidePoint(el, side, p.a, n);
          const e = sidePoint(el, side, p.b, n);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
        }
        ctx.strokeStyle = wallFill;
        ctx.strokeRect(Math.min(a0.x, b1.x), Math.min(a0.y, b1.y), Math.abs(b1.x - a0.x), Math.abs(b1.y - a0.y));
      } else {
        // باب: ضلفة وقوس الفتح للداخل
        const len = p.b - p.a;
        const hinge = sidePoint(el, side, p.a, WALL);
        const tip = sidePoint(el, side, p.a, WALL + len);
        const end = sidePoint(el, side, p.b, WALL);
        ctx.strokeStyle = shade(el.accent, -0.5);
        ctx.lineWidth = lw(o, 1.4);
        ctx.beginPath();
        ctx.moveTo(hinge.x, hinge.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        ctx.lineWidth = lw(o, 0.8);
        ctx.setLineDash([px(o, 3), px(o, 3)]);
        const a1a = Math.atan2(tip.y - hinge.y, tip.x - hinge.x);
        const a2a = Math.atan2(end.y - hinge.y, end.x - hinge.x);
        let da = a2a - a1a;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(hinge.x, hinge.y, len, a1a, a2a, da < 0);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}

function room(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  // ظل خفيف وحافة السقف (لون الكيربي)
  ctx.fillStyle = 'rgba(60,40,20,0.12)';
  ctx.fillRect(-el.width / 2 + 0.15, -el.depth / 2 + 0.2, el.width, el.depth);
  floor(ctx, el, o);
  walls(ctx, el, o);
  if (el.roof) {
    ctx.strokeStyle = el.roof;
    ctx.lineWidth = lw(o, 1.5);
    ctx.setLineDash([px(o, 6), px(o, 4)]);
    ctx.strokeRect(-el.width / 2 - 0.3, -el.depth / 2 - 0.3, el.width + 0.6, el.depth + 0.6);
    ctx.setLineDash([]);
  }
  outline(ctx, el.width, el.depth, o);
}

// ——— الأثاث من فوق ———
function sofaL(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  const t = Math.min(0.85, w / 3, d / 3);
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, t);
  ctx.fillRect(-w / 2, -d / 2, t, d);
  ctx.fillStyle = shade(el.color, -0.12);
  ctx.fillRect(-w / 2, -d / 2, w, t * 0.3);
  ctx.fillRect(-w / 2, -d / 2, t * 0.3, d);
  // مساند
  ctx.fillStyle = el.accent;
  for (let x = -w / 2 + t + 0.3; x < w / 2 - 0.4; x += 0.8) ctx.fillRect(x, -d / 2 + t * 0.3, 0.5, 0.14);
  for (let y = -d / 2 + t + 0.3; y < d / 2 - 0.4; y += 0.8) ctx.fillRect(-w / 2 + t * 0.3, y, 0.14, 0.5);
  ctx.strokeStyle = shade(el.color, -0.35);
  ctx.lineWidth = lw(o, 0.8);
  ctx.strokeRect(-w / 2, -d / 2, w, t);
  ctx.strokeRect(-w / 2, -d / 2, t, d);
  if (o.selected || o.issue) outline(ctx, w, d, o);
}

function boxTop(ctx: Ctx, el: PlanElement, o: DrawOpts, fill: string, stroke = shade(fill, -0.35)) {
  ctx.fillStyle = fill;
  ctx.fillRect(-el.width / 2, -el.depth / 2, el.width, el.depth);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw(o, 1);
  ctx.strokeRect(-el.width / 2, -el.depth / 2, el.width, el.depth);
}

function furniture(ctx: Ctx, el: PlanElement, o: DrawOpts): boolean {
  const w = el.width;
  const d = el.depth;
  switch (el.kind) {
    case 'sofa-l':
      sofaL(ctx, el, o);
      return true;
    case 'tv-unit':
      boxTop(ctx, el, o, el.color);
      ctx.fillStyle = el.accent;
      ctx.fillRect(-w * 0.3, d / 2 - 0.08, w * 0.6, 0.06);
      break;
    case 'coffee-table':
      boxTop(ctx, el, o, el.color);
      ctx.strokeStyle = el.accent;
      ctx.lineWidth = lw(o, 1);
      ctx.strokeRect(-w / 2 + 0.08, -d / 2 + 0.08, w - 0.16, d - 0.16);
      break;
    case 'bed': {
      boxTop(ctx, el, o, el.color);
      ctx.fillStyle = '#ffffff';
      const pw = w > 1.3 ? (w - 0.3) / 2 : w - 0.2;
      for (let i = 0; i < (w > 1.3 ? 2 : 1); i++) ctx.fillRect(-w / 2 + 0.1 + i * (pw + 0.1), -d / 2 + 0.1, pw, 0.4);
      ctx.fillStyle = el.accent;
      ctx.fillRect(-w / 2, -d / 2 + d * 0.45, w, d * 0.55);
      break;
    }
    case 'wardrobe':
      boxTop(ctx, el, o, el.color);
      ctx.strokeStyle = shade(el.color, -0.3);
      ctx.lineWidth = lw(o, 0.8);
      for (let x = -w / 2 + 0.5; x < w / 2 - 0.1; x += 0.5) {
        ctx.beginPath();
        ctx.moveTo(x, -d / 2);
        ctx.lineTo(x, d / 2);
        ctx.stroke();
      }
      break;
    case 'billiard':
      boxTop(ctx, el, o, el.accent);
      ctx.fillStyle = el.color;
      ctx.fillRect(-w / 2 + 0.12, -d / 2 + 0.12, w - 0.24, d - 0.24);
      ctx.fillStyle = '#111';
      for (const [x, y] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]])
        ctx.beginPath(), ctx.arc(x * (w / 2 - 0.12), y * (d / 2 - 0.12), 0.06, 0, Math.PI * 2), ctx.fill();
      break;
    case 'kitchen-counter':
      boxTop(ctx, el, o, el.color);
      ctx.fillStyle = el.accent;
      for (const cx of [-w * 0.3, -w * 0.3 + 0.35]) ctx.beginPath(), ctx.arc(cx, 0, 0.12, 0, Math.PI * 2), ctx.fill();
      ctx.fillStyle = '#c9d6dd';
      ctx.fillRect(w * 0.1, -d * 0.3, 0.6, d * 0.6);
      break;
    case 'bath-set':
      boxTop(ctx, el, o, '#eef1f3');
      // دش
      ctx.fillStyle = el.accent;
      ctx.fillRect(w / 2 - 0.9, -d / 2, 0.9, 0.9);
      // مرحاض
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-w / 2 + 0.35, -d / 2 + 0.45, 0.2, 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9aa';
      ctx.stroke();
      // مغسلة
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-w / 2 + 0.05, d / 2 - 0.5, 0.6, 0.45);
      break;
    default:
      return false;
  }
  if (o.selected || o.issue) outline(ctx, w, d, o);
  return true;
}

export function drawInterior(ctx: Ctx, el: PlanElement, o: DrawOpts): boolean {
  if (el.kind === 'room' && el.room) {
    room(ctx, el, o);
    return true;
  }
  return furniture(ctx, el, o);
}
