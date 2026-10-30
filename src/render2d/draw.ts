// رسم المسقط العلوي — دوال مشتركة بين محرر Konva وتصدير الصور.
// جميع الإحداثيات بالمتر؛ ppm = عدد البكسلات لكل متر على الشاشة (لحساب سماكة الخطوط وحجم النص).

import type { Land, Measurement, Plan, PlanElement, Vec2 } from '../types/plan';
import { shade, withAlpha, luminance } from '../lib/color';
import {
  DEG,
  boundsOf,
  dist,
  entranceInfo,
  formatMeters,
  landEdges,
  landPolygon,
  lerp,
  outlinePolygon,
  polylineLength,
  polylineOutline,
  rotate,
  add,
  scale,
  sub,
  norm,
} from '../lib/geometry';
import { LIGHT_HEX, floodTarget, pathEdgeLights, stringBulbs } from '../lib/lighting';
import { isPolyline, isTentKind, CATALOG_BY_KIND } from '../lib/catalog';
import { tentEntranceZone } from '../lib/validation';
import { drawExtra } from './drawExtra';
import { drawSurroundings } from './surroundings';

export const FONT = "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif";

export interface DrawOpts {
  ppm: number;
  selected?: boolean;
  issue?: 'error' | 'warning' | null;
  night?: boolean;
  showSafety?: boolean;
}

type Ctx = CanvasRenderingContext2D;

const px = (o: DrawOpts, n: number) => n / o.ppm;

export const GROUND_COLORS: Record<Land['ground'], string> = {
  sand: '#ead8b0',
  soil: '#c8a57a',
  flat: '#ddd3c0',
};

function poly(ctx: Ctx, pts: Vec2[], close = true) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (close) ctx.closePath();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function text(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  o: DrawOpts,
  size = 12,
  color = '#2b1d12',
  weight = 600,
  halo = 'rgba(255,255,255,0.85)',
) {
  ctx.save();
  ctx.font = `${weight} ${px(o, size)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try {
    ctx.direction = 'rtl';
  } catch {
    /* بعض المتصفحات لا تدعم الخاصية */
  }
  if (halo) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = px(o, 3.2);
    ctx.strokeStyle = halo;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function measureText(ctx: Ctx, s: string, o: DrawOpts, size = 12, weight = 600): number {
  ctx.save();
  ctx.font = `${weight} ${px(o, size)}px ${FONT}`;
  const w = ctx.measureText(s).width;
  ctx.restore();
  return w;
}

function issueOutline(ctx: Ctx, w: number, d: number, o: DrawOpts) {
  if (!o.issue && !o.selected) return;
  ctx.save();
  if (o.issue) {
    ctx.strokeStyle = o.issue === 'error' ? '#d62828' : '#e09f1f';
    ctx.lineWidth = px(o, 3);
    ctx.setLineDash([px(o, 7), px(o, 4)]);
    ctx.strokeRect(-w / 2 - px(o, 3), -d / 2 - px(o, 3), w + px(o, 6), d + px(o, 6));
  }
  if (o.selected) {
    ctx.setLineDash([]);
    ctx.strokeStyle = '#1d6fd8';
    ctx.lineWidth = px(o, 2);
    ctx.strokeRect(-w / 2 - px(o, 1), -d / 2 - px(o, 1), w + px(o, 2), d + px(o, 2));
  }
  ctx.restore();
}

function shadow(ctx: Ctx, w: number, d: number, alpha = 0.16) {
  ctx.save();
  ctx.fillStyle = `rgba(60,40,20,${alpha})`;
  ctx.fillRect(-w / 2 + 0.12, -d / 2 + 0.18, w, d);
  ctx.restore();
}

// ——— الخيام ———

function drawSaduBand(ctx: Ctx, w: number, d: number, band: number, accent: string, o: DrawOpts) {
  ctx.save();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.rect(-w / 2, -d / 2, w, d);
  ctx.rect(-w / 2 + band, -d / 2 + band, w - 2 * band, d - 2 * band);
  ctx.fill('evenodd');
  // مثلثات السدو
  ctx.strokeStyle = 'rgba(255,240,215,0.85)';
  ctx.lineWidth = Math.max(px(o, 0.8), band * 0.12);
  const step = band * 1.6;
  const zig = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number) => {
    const L = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.floor(L / step));
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const off = (i % 2 ? 0.28 : -0.28) * band;
      const x = ax + (bx - ax) * t + nx * off;
      const y = ay + (by - ay) * t + ny * off;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  };
  const h = band / 2;
  zig(-w / 2 + h, -d / 2 + h, w / 2 - h, -d / 2 + h, 0, 1);
  zig(-w / 2 + h, d / 2 - h, w / 2 - h, d / 2 - h, 0, 1);
  zig(-w / 2 + h, -d / 2 + h, -w / 2 + h, d / 2 - h, 1, 0);
  zig(w / 2 - h, -d / 2 + h, w / 2 - h, d / 2 - h, 1, 0);
  ctx.restore();
}

function hipFaces(w: number, d: number): { pts: Vec2[]; tone: number }[] {
  if (w >= d) {
    const r1 = { x: -w / 2 + d / 2, y: 0 };
    const r2 = { x: w / 2 - d / 2, y: 0 };
    return [
      { pts: [{ x: -w / 2, y: -d / 2 }, { x: w / 2, y: -d / 2 }, r2, r1], tone: 0.12 },
      { pts: [{ x: w / 2, y: d / 2 }, { x: -w / 2, y: d / 2 }, r1, r2], tone: -0.08 },
      { pts: [{ x: -w / 2, y: -d / 2 }, r1, { x: -w / 2, y: d / 2 }], tone: 0.04 },
      { pts: [{ x: w / 2, y: -d / 2 }, { x: w / 2, y: d / 2 }, r2], tone: -0.02 },
    ];
  }
  const r1 = { x: 0, y: -d / 2 + w / 2 };
  const r2 = { x: 0, y: d / 2 - w / 2 };
  return [
    { pts: [{ x: -w / 2, y: -d / 2 }, { x: w / 2, y: -d / 2 }, r1], tone: 0.12 },
    { pts: [{ x: w / 2, y: d / 2 }, { x: -w / 2, y: d / 2 }, r2], tone: -0.08 },
    { pts: [{ x: -w / 2, y: -d / 2 }, r1, r2, { x: -w / 2, y: d / 2 }], tone: 0.04 },
    { pts: [{ x: w / 2, y: -d / 2 }, { x: w / 2, y: d / 2 }, r2, r1], tone: -0.02 },
  ];
}

function drawTentEntrance(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const t = el.tent;
  if (!t) return;
  const w = el.width;
  const d = el.depth;
  const side = t.entranceSide;
  const along = side === 'front' || side === 'back' ? w : d;
  const ew = Math.min(t.entranceWidth, along);
  const off = Math.max(-along / 2 + ew / 2, Math.min(along / 2 - ew / 2, t.entranceOffset));
  ctx.save();
  // نحول إلى إطار المدخل: x على طول الضلع و y للخارج
  switch (side) {
    case 'front':
      ctx.translate(off, d / 2);
      break;
    case 'back':
      ctx.translate(off, -d / 2);
      ctx.rotate(Math.PI);
      break;
    case 'left':
      ctx.translate(-w / 2, off);
      ctx.rotate(Math.PI / 2);
      break;
    case 'right':
      ctx.translate(w / 2, off);
      ctx.rotate(-Math.PI / 2);
      break;
  }
  const flap = Math.min(0.5, ew * 0.3);
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(-ew / 2, -0.18, ew, 0.22);
  ctx.strokeStyle = shade(el.color, -0.35);
  ctx.lineWidth = Math.max(px(o, 1.4), 0.06);
  ctx.beginPath();
  ctx.moveTo(-ew / 2, 0);
  ctx.lineTo(-ew / 2 - flap * 0.4, flap);
  ctx.moveTo(ew / 2, 0);
  ctx.lineTo(ew / 2 + flap * 0.4, flap);
  ctx.stroke();
  // سهم الدخول
  const a = Math.min(0.9, ew * 0.45);
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(0, 0.25);
  ctx.lineTo(-a / 2, 0.25 + a * 0.7);
  ctx.lineTo(a / 2, 0.25 + a * 0.7);
  ctx.closePath();
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.restore();
}

function drawTent(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  const t = el.tent;
  const style = t?.style ?? 'majlis';
  shadow(ctx, w, d);
  const base = el.color;
  if (style === 'bedouin') {
    ctx.fillStyle = base;
    ctx.fillRect(-w / 2, -d / 2, w, d);
    // خطوط النسيج
    ctx.strokeStyle = withAlpha(luminance(base) > 0.5 ? '#000000' : '#ffffff', 0.18);
    ctx.lineWidth = Math.max(px(o, 0.8), 0.04);
    for (let y = -d / 2 + 0.6; y < d / 2; y += 0.6) {
      ctx.beginPath();
      ctx.moveTo(-w / 2, y);
      ctx.lineTo(w / 2, y);
      ctx.stroke();
    }
    ctx.fillStyle = shade(base, 0.25);
    const n = Math.max(1, Math.round(w / 3));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      ctx.beginPath();
      ctx.arc(x, 0, Math.max(px(o, 2.5), 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = el.accent;
    ctx.lineWidth = Math.max(px(o, 2), 0.12);
    ctx.strokeRect(-w / 2 + 0.06, -d / 2 + 0.06, w - 0.12, d - 0.12);
  } else {
    const faces =
      style === 'pyramid'
        ? [
            { pts: [{ x: -w / 2, y: -d / 2 }, { x: w / 2, y: -d / 2 }, { x: 0, y: 0 }], tone: 0.12 },
            { pts: [{ x: w / 2, y: d / 2 }, { x: -w / 2, y: d / 2 }, { x: 0, y: 0 }], tone: -0.08 },
            { pts: [{ x: -w / 2, y: -d / 2 }, { x: 0, y: 0 }, { x: -w / 2, y: d / 2 }], tone: 0.04 },
            { pts: [{ x: w / 2, y: -d / 2 }, { x: w / 2, y: d / 2 }, { x: 0, y: 0 }], tone: -0.02 },
          ]
        : hipFaces(w, d);
    for (const f of faces) {
      poly(ctx, f.pts);
      ctx.fillStyle = shade(base, f.tone);
      ctx.fill();
    }
    ctx.strokeStyle = shade(base, -0.25);
    ctx.lineWidth = Math.max(px(o, 1), 0.03);
    for (const f of faces) {
      poly(ctx, f.pts);
      ctx.stroke();
    }
    const band = Math.min(0.32, Math.min(w, d) * 0.07);
    drawSaduBand(ctx, w, d, band, el.accent, o);
  }
  ctx.strokeStyle = shade(base, -0.45);
  ctx.lineWidth = Math.max(px(o, 1.2), 0.03);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  drawTentEntrance(ctx, el, o);
  issueOutline(ctx, w, d, o);
}

function drawCanopy(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  shadow(ctx, w, d, 0.12);
  ctx.save();
  ctx.globalAlpha = 0.82;
  for (const f of hipFaces(w, d)) {
    poly(ctx, f.pts);
    ctx.fillStyle = shade(el.color, f.tone);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = el.accent;
  ctx.lineWidth = Math.max(px(o, 1.5), 0.05);
  ctx.setLineDash([0.3, 0.15]);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  ctx.setLineDash([]);
  ctx.fillStyle = '#4a3424';
  const r = Math.max(px(o, 2.5), 0.07);
  const nx = Math.max(1, Math.round(w / 3.5));
  const ny = Math.max(1, Math.round(d / 3.5));
  for (let i = 0; i <= nx; i++) {
    for (const y of [-d / 2, d / 2]) {
      ctx.beginPath();
      ctx.arc(-w / 2 + (w / nx) * i, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let j = 1; j < ny; j++) {
    for (const x of [-w / 2, w / 2]) {
      ctx.beginPath();
      ctx.arc(x, -d / 2 + (d / ny) * j, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  issueOutline(ctx, w, d, o);
}

function drawRug(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  const b = Math.min(0.25, Math.min(w, d) * 0.08);
  ctx.strokeStyle = shade(el.color, 0.45);
  ctx.lineWidth = Math.max(px(o, 1), b * 0.25);
  ctx.strokeRect(-w / 2 + b, -d / 2 + b, w - 2 * b, d - 2 * b);
  // معينات السدو
  ctx.fillStyle = withAlpha('#f6e7c8', 0.55);
  const step = Math.max(0.5, Math.min(w, d) / 5);
  for (let x = -w / 2 + b * 2 + step / 2; x < w / 2 - b * 2; x += step) {
    for (let y = -d / 2 + b * 2 + step / 2; y < d / 2 - b * 2; y += step) {
      ctx.beginPath();
      ctx.moveTo(x, y - step * 0.3);
      ctx.lineTo(x + step * 0.22, y);
      ctx.lineTo(x, y + step * 0.3);
      ctx.lineTo(x - step * 0.22, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  // المساند والمراكي
  const c = Math.min(0.7, Math.min(w, d) * 0.18);
  ctx.fillStyle = el.accent;
  ctx.strokeStyle = shade(el.accent, -0.3);
  ctx.lineWidth = Math.max(px(o, 0.8), 0.02);
  const cushion = (x: number, y: number, cw: number, ch: number) => {
    roundRect(ctx, x, y, cw, ch, Math.min(cw, ch) * 0.3);
    ctx.fill();
    ctx.stroke();
  };
  cushion(-w / 2 + 0.05, -d / 2 + 0.05, w - 0.1, c);
  cushion(-w / 2 + 0.05, -d / 2 + c + 0.1, c, d - c - 0.6);
  cushion(w / 2 - c - 0.05, -d / 2 + c + 0.1, c, d - c - 0.6);
  // صينية القهوة
  ctx.fillStyle = '#c9a24a';
  ctx.beginPath();
  ctx.arc(0, d * 0.1, Math.min(0.35, Math.min(w, d) * 0.1), 0, Math.PI * 2);
  ctx.fill();
  issueOutline(ctx, w, d, o);
}

function drawCourt(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  const c = el.court;
  const surface = c?.surface ?? 'sand';
  ctx.fillStyle = surface === 'sand' ? '#efdcaa' : '#4f9a3a';
  ctx.fillRect(-w / 2, -d / 2, w, d);
  if (surface === 'turf') {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let x = -w / 2; x < w / 2; x += 2) ctx.fillRect(x, -d / 2, 1, d);
  } else {
    ctx.fillStyle = 'rgba(160,120,60,0.08)';
    for (let i = 0; i < 60; i++) {
      const x = -w / 2 + ((i * 7.31) % w);
      const y = -d / 2 + ((i * 3.77) % d);
      ctx.fillRect(x, y, 0.25, 0.08);
    }
  }
  const lw = 0.05;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(lw, px(o, 1.2));
  ctx.strokeRect(-w / 2 + lw / 2, -d / 2 + lw / 2, w - lw, d - lw);
  ctx.beginPath();
  ctx.moveTo(0, -d / 2);
  ctx.lineTo(0, d / 2);
  if (c?.attackLines) {
    const a = Math.min(3, w / 6);
    ctx.moveTo(-a, -d / 2);
    ctx.lineTo(-a, d / 2);
    ctx.moveTo(a, -d / 2);
    ctx.lineTo(a, d / 2);
  }
  ctx.stroke();
  // الشبكة والأعمدة
  ctx.strokeStyle = '#1f1f1f';
  ctx.lineWidth = Math.max(0.06, px(o, 2.2));
  ctx.beginPath();
  ctx.moveTo(0, -d / 2 - 1);
  ctx.lineTo(0, d / 2 + 1);
  ctx.stroke();
  ctx.fillStyle = '#333';
  for (const y of [-d / 2 - 1, d / 2 + 1]) {
    ctx.beginPath();
    ctx.arc(0, y, Math.max(0.1, px(o, 3)), 0, Math.PI * 2);
    ctx.fill();
  }
  issueOutline(ctx, w, d, o);
}

export function drawCourtZone(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const m = el.court?.safetyMargin ?? 0;
  if (m <= 0) return;
  const w = el.width + 2 * m;
  const d = el.depth + 2 * m;
  ctx.save();
  ctx.fillStyle = 'rgba(230,140,40,0.10)';
  ctx.fillRect(-w / 2, -d / 2, w, d);
  ctx.strokeStyle = 'rgba(200,110,20,0.85)';
  ctx.lineWidth = px(o, 1.5);
  ctx.setLineDash([px(o, 8), px(o, 5)]);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  ctx.restore();
}

function drawToilet(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  shadow(ctx, w, d);
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  ctx.strokeStyle = shade(el.color, -0.4);
  ctx.lineWidth = Math.max(px(o, 1), 0.03);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  ctx.fillStyle = el.accent;
  ctx.fillRect(-w * 0.32, d / 2 - 0.12, w * 0.64, 0.12);
  ctx.strokeRect(-w / 2 + 0.1, -d / 2 + 0.1, w - 0.2, d - 0.2);
  text(ctx, 'WC', 0, -0.05, o, 10, el.accent, 700, '');
  issueOutline(ctx, w, d, o);
}

function drawSink(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  shadow(ctx, w, d, 0.1);
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  ctx.fillStyle = el.accent;
  ctx.fillRect(-w / 2, -d / 2, w, Math.min(0.08, d * 0.2));
  const n = w >= 1 ? 2 : 1;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#8aa1ad';
  ctx.lineWidth = Math.max(px(o, 1), 0.02);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w / n) * (i + 0.5);
    ctx.beginPath();
    ctx.ellipse(x, 0.04, Math.min(0.2, w / n / 2.8), Math.min(0.16, d / 3), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  issueOutline(ctx, w, d, o);
}

function drawKitchen(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  shadow(ctx, w, d);
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  ctx.fillStyle = el.accent;
  ctx.fillRect(-w / 2, -d / 2, w, 0.1);
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = Math.max(px(o, 1.2), 0.03);
  const r = Math.min(0.18, d * 0.18);
  for (const [x, y] of [
    [-w / 2 + 0.4, -0.15],
    [-w / 2 + 0.85, -0.15],
    [-w / 2 + 0.4, 0.25],
    [-w / 2 + 0.85, 0.25],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#b8c7cf';
  roundRect(ctx, w / 2 - 1.0, -d * 0.25, 0.6, d * 0.5, 0.06);
  ctx.fill();
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  issueOutline(ctx, w, d, o);
}

function drawStorage(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  shadow(ctx, w, d);
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  ctx.strokeStyle = shade(el.color, -0.25);
  ctx.lineWidth = Math.max(px(o, 0.8), 0.02);
  for (let x = -w / 2 + 0.2; x < w / 2; x += 0.2) {
    ctx.beginPath();
    ctx.moveTo(x, -d / 2);
    ctx.lineTo(x, d / 2);
    ctx.stroke();
  }
  ctx.fillStyle = el.accent;
  ctx.fillRect(-w * 0.3, d / 2 - 0.1, w * 0.6, 0.1);
  ctx.strokeStyle = shade(el.color, -0.5);
  ctx.lineWidth = Math.max(px(o, 1.2), 0.03);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  issueOutline(ctx, w, d, o);
}

function drawCarTop(ctx: Ctx, cx: number, cy: number, cw: number, cl: number, colorHex: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(ctx, -cw / 2 + 0.08, -cl / 2 + 0.1, cw, cl, 0.35);
  ctx.fill();
  ctx.fillStyle = colorHex;
  roundRect(ctx, -cw / 2, -cl / 2, cw, cl, 0.35);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,40,55,0.75)';
  roundRect(ctx, -cw / 2 + 0.15, -cl / 2 + cl * 0.22, cw - 0.3, cl * 0.18, 0.1);
  ctx.fill();
  roundRect(ctx, -cw / 2 + 0.15, cl / 2 - cl * 0.3, cw - 0.3, cl * 0.14, 0.1);
  ctx.fill();
  ctx.restore();
}

const CAR_COLORS = ['#f5f5f2', '#2a2a2a', '#9aa3ab', '#7a2121', '#d9cfbf', '#1f3a5f'];

function drawParking(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  const slots = Math.max(1, el.parking?.slots ?? 1);
  const sw = w / slots;
  ctx.strokeStyle = el.accent;
  ctx.lineWidth = Math.max(0.08, px(o, 1.2));
  ctx.beginPath();
  for (let i = 0; i <= slots; i++) {
    const x = -w / 2 + sw * i;
    ctx.moveTo(x, -d / 2);
    ctx.lineTo(x, d / 2 - 0.4);
  }
  ctx.moveTo(-w / 2, -d / 2);
  ctx.lineTo(w / 2, -d / 2);
  ctx.stroke();
  for (let i = 0; i < slots; i++) {
    const cx = -w / 2 + sw * (i + 0.5);
    if (el.parking?.showCars && sw > 1.6 && d > 3) {
      drawCarTop(ctx, cx, -0.1, Math.min(1.9, sw - 0.5), Math.min(4.6, d - 0.7), CAR_COLORS[i % CAR_COLORS.length]);
    } else {
      text(ctx, `${i + 1}`, cx, 0, o, 11, '#5b4a35', 700, '');
    }
  }
  issueOutline(ctx, w, d, o);
}

function drawWaterTank(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  ctx.fillStyle = 'rgba(60,40,20,0.15)';
  ctx.beginPath();
  ctx.ellipse(0.12, 0.18, w / 2, d / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = el.color;
  ctx.strokeStyle = el.accent;
  ctx.lineWidth = Math.max(px(o, 1.4), 0.04);
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, d / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.18, d * 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = el.accent;
  ctx.fill();
  issueOutline(ctx, w, d, o);
}

function drawGenerator(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  shadow(ctx, w, d);
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  ctx.strokeStyle = el.accent;
  ctx.lineWidth = Math.max(px(o, 0.8), 0.02);
  for (let x = -w / 2 + 0.15; x < -w / 2 + w * 0.45; x += 0.1) {
    ctx.beginPath();
    ctx.moveTo(x, -d * 0.35);
    ctx.lineTo(x, d * 0.35);
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(px(o, 1.2), 0.03);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  text(ctx, '⚡', w * 0.2, 0, o, 13, '#1d1d1d', 700, '');
  issueOutline(ctx, w, d, o);
}

function drawBBQ(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  shadow(ctx, w, d, 0.1);
  // بلاط/أرضية المنطقة
  ctx.fillStyle = '#cdbb9a';
  ctx.fillRect(-w / 2, -d / 2, w, d);
  // المنقلة
  const gw = Math.min(1.4, w * 0.45);
  const gd = Math.min(0.6, d * 0.4);
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2 + 0.2, -gd / 2, gw, gd);
  ctx.strokeStyle = '#d0661f';
  ctx.lineWidth = Math.max(px(o, 0.9), 0.02);
  for (let x = -w / 2 + 0.3; x < -w / 2 + 0.2 + gw - 0.05; x += 0.1) {
    ctx.beginPath();
    ctx.moveTo(x, -gd / 2 + 0.05);
    ctx.lineTo(x, gd / 2 - 0.05);
    ctx.stroke();
  }
  // طاولة التحضير
  ctx.fillStyle = el.accent;
  roundRect(ctx, w / 2 - Math.min(1.2, w * 0.4) - 0.2, -d * 0.3, Math.min(1.2, w * 0.4), d * 0.6, 0.06);
  ctx.fill();
  ctx.strokeStyle = shade('#cdbb9a', -0.35);
  ctx.lineWidth = Math.max(px(o, 1), 0.03);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  issueOutline(ctx, w, d, o);
}

function drawTableSet(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  const seats = Math.max(0, el.furniture?.seats ?? 6);
  const chair = Math.min(0.48, Math.min(w, d) * 0.2);
  const rx = w / 2 - chair / 2 - 0.02;
  const ry = d / 2 - chair / 2 - 0.02;
  ctx.fillStyle = el.accent;
  ctx.strokeStyle = shade(el.accent, -0.35);
  ctx.lineWidth = Math.max(px(o, 0.8), 0.02);
  for (let i = 0; i < seats; i++) {
    const a = (i / seats) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2);
    roundRect(ctx, -chair / 2, -chair / 2, chair, chair, chair * 0.2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(60,40,20,0.15)';
  ctx.beginPath();
  ctx.ellipse(0.06, 0.08, w * 0.3, d * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = el.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.3, d * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(el.color, -0.3);
  ctx.stroke();
  issueOutline(ctx, w, d, o);
}

function drawSeating(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  const s = Math.min(0.85, Math.min(w, d) * 0.3);
  ctx.fillStyle = 'rgba(60,40,20,0.12)';
  ctx.fillRect(-w / 2 + 0.1, -d / 2 + 0.12, w, d);
  ctx.fillStyle = el.color;
  ctx.strokeStyle = shade(el.color, -0.35);
  ctx.lineWidth = Math.max(px(o, 1), 0.03);
  const seg = (x: number, y: number, sw: number, sh: number) => {
    roundRect(ctx, x, y, sw, sh, 0.12);
    ctx.fill();
    ctx.stroke();
  };
  seg(-w / 2, -d / 2, w, s);
  seg(-w / 2, -d / 2 + s, s, d - s);
  seg(w / 2 - s, -d / 2 + s, s, d - s);
  ctx.fillStyle = el.accent;
  const n = Math.max(2, Math.round(w / 0.9));
  for (let i = 0; i < n; i++) {
    roundRect(ctx, -w / 2 + (w / n) * i + 0.08, -d / 2 + 0.06, w / n - 0.16, s * 0.35, 0.06);
    ctx.fill();
  }
  ctx.fillStyle = '#8a6440';
  roundRect(ctx, -w * 0.18, -d / 2 + s + (d - s) * 0.25, w * 0.36, (d - s) * 0.4, 0.08);
  ctx.fill();
  issueOutline(ctx, w, d, o);
}

// ——— الإنارة (عناصر نقطية) ———

function glow(ctx: Ctx, r: number, color: string, alpha = 0.55) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawLightPoint(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const L = el.light;
  const on = !!L?.on;
  const lc = LIGHT_HEX[L?.color ?? 'warm'];
  const size = Math.max(el.width, px(o, 9));
  if (on && o.night) glow(ctx, size * 2.2, lc, 0.6);
  switch (el.kind) {
    case 'light-pole': {
      if (o.selected && L) {
        const r = Math.min(30, L.mountHeight * Math.tan((Math.min(170, L.beam) / 2) * DEG));
        ctx.save();
        ctx.strokeStyle = withAlpha('#d4a24c', 0.9);
        ctx.fillStyle = withAlpha('#ffd27a', 0.12);
        ctx.setLineDash([px(o, 5), px(o, 4)]);
        ctx.lineWidth = px(o, 1.2);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = el.color;
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = on ? lc : '#777';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'flood-light': {
      if (L) {
        const reach = dist({ x: el.x, y: el.y }, floodTarget(el));
        const half = (Math.min(160, L.beam) / 2) * DEG;
        ctx.save();
        const g = ctx.createLinearGradient(0, 0, 0, reach);
        g.addColorStop(0, withAlpha(on ? lc : '#999999', o.selected ? 0.45 : 0.28));
        g.addColorStop(1, withAlpha(on ? lc : '#999999', 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.sin(half) * reach * 1.05, Math.cos(half) * reach * 1.05);
        ctx.lineTo(-Math.sin(half) * reach * 1.05, Math.cos(half) * reach * 1.05);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = withAlpha('#c08a1c', 0.8);
        ctx.lineWidth = px(o, 1);
        ctx.setLineDash([px(o, 4), px(o, 4)]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, reach);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = el.color;
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = on ? lc : '#777';
      ctx.fillRect(-size * 0.35, 0, size * 0.7, size * 0.35);
      break;
    }
    case 'ground-light': {
      ctx.fillStyle = el.color;
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = on ? lc : '#777';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'entrance-light': {
      ctx.fillStyle = el.color;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.fillStyle = on ? lc : '#777';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'lantern': {
      ctx.fillStyle = el.color;
      ctx.beginPath();
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(size / 2, 0);
      ctx.lineTo(0, size / 2);
      ctx.lineTo(-size / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = on ? lc : '#777';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  if (o.selected || o.issue) {
    ctx.save();
    ctx.strokeStyle = o.issue === 'error' ? '#d62828' : o.issue === 'warning' ? '#e09f1f' : '#1d6fd8';
    ctx.lineWidth = px(o, 2);
    ctx.beginPath();
    ctx.arc(0, 0, size / 2 + px(o, 4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** رسم العنصر المستطيل أو النقطي في إحداثياته المحلية (المركز = 0،0 بدون دوران) */
export function drawLocalElement(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  if (isTentKind(el.kind)) return drawTent(ctx, el, o);
  switch (el.kind) {
    case 'canopy':
      return drawCanopy(ctx, el, o);
    case 'majlis-rug':
      return drawRug(ctx, el, o);
    case 'volleyball':
      return drawCourt(ctx, el, o);
    case 'toilet':
      return drawToilet(ctx, el, o);
    case 'sink':
      return drawSink(ctx, el, o);
    case 'outdoor-kitchen':
      return drawKitchen(ctx, el, o);
    case 'storage':
      return drawStorage(ctx, el, o);
    case 'parking':
      return drawParking(ctx, el, o);
    case 'water-tank':
      return drawWaterTank(ctx, el, o);
    case 'generator':
      return drawGenerator(ctx, el, o);
    case 'bbq':
      return drawBBQ(ctx, el, o);
    case 'table-set':
      return drawTableSet(ctx, el, o);
    case 'seating':
      return drawSeating(ctx, el, o);
    case 'light-pole':
    case 'flood-light':
    case 'ground-light':
    case 'entrance-light':
    case 'lantern':
      return drawLightPoint(ctx, el, o);
    default:
      if (drawExtra(ctx, el, o)) return;
      ctx.fillStyle = el.color;
      ctx.fillRect(-el.width / 2, -el.depth / 2, el.width, el.depth);
  }
}

// ——— الممرات والسلاسل (إحداثيات عالمية) ———

const PATH_FILL: Record<string, string> = {
  turf: '#4f9a35',
  'wood-turf': '#55a03a',
  tiles: '#d9cfc0',
  sand: '#e2c995',
  stone: '#bfb3a0',
};

export function drawPath(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const pts = el.points ?? [];
  const p = el.path;
  if (pts.length < 2 || !p) return;
  const outline = outlinePolygon(pts, p.width);
  ctx.save();
  // ظل خفيف
  ctx.save();
  ctx.translate(0.06, 0.1);
  poly(ctx, outline);
  ctx.fillStyle = 'rgba(60,40,20,0.12)';
  ctx.fill();
  ctx.restore();
  poly(ctx, outline);
  ctx.fillStyle = PATH_FILL[p.material] ?? '#4f9a35';
  ctx.fill();
  ctx.save();
  poly(ctx, outline);
  ctx.clip();
  switch (p.material) {
    case 'turf':
    case 'wood-turf': {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = p.width * 0.33;
      ctx.lineJoin = 'miter';
      poly(ctx, pts, false);
      ctx.stroke();
      if (p.material === 'wood-turf') {
        // مفاصل الأخشاب كل 3 م
        ctx.strokeStyle = 'rgba(90,60,30,0.35)';
        ctx.lineWidth = Math.max(px(o, 0.8), 0.02);
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const L = dist(a, b);
          const dir = norm(sub(b, a));
          const n = { x: -dir.y, y: dir.x };
          for (let s = 3; s < L; s += 3) {
            const c = add(a, scale(dir, s));
            ctx.beginPath();
            ctx.moveTo(c.x + n.x * p.width, c.y + n.y * p.width);
            ctx.lineTo(c.x - n.x * p.width, c.y - n.y * p.width);
            ctx.stroke();
          }
        }
      }
      break;
    }
    case 'tiles': {
      ctx.strokeStyle = 'rgba(120,105,85,0.45)';
      ctx.lineWidth = Math.max(px(o, 0.8), 0.015);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const L = dist(a, b);
        const dir = norm(sub(b, a));
        const n = { x: -dir.y, y: dir.x };
        for (let s = 0; s <= L; s += 0.6) {
          const c = add(a, scale(dir, s));
          ctx.beginPath();
          ctx.moveTo(c.x + n.x * p.width, c.y + n.y * p.width);
          ctx.lineTo(c.x - n.x * p.width, c.y - n.y * p.width);
          ctx.stroke();
        }
        for (let k = -p.width / 2; k <= p.width / 2; k += 0.6) {
          ctx.beginPath();
          ctx.moveTo(a.x + n.x * k - dir.x, a.y + n.y * k - dir.y);
          ctx.lineTo(b.x + n.x * k + dir.x, b.y + n.y * k + dir.y);
          ctx.stroke();
        }
      }
      break;
    }
    case 'stone': {
      ctx.fillStyle = 'rgba(110,100,85,0.45)';
      let seed = 7;
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const L = dist(a, b);
        const dir = norm(sub(b, a));
        const n = { x: -dir.y, y: dir.x };
        for (let s = 0.3; s < L; s += 0.55) {
          for (let k = -p.width / 2 + 0.3; k < p.width / 2; k += 0.55) {
            const c = add(add(a, scale(dir, s + (rnd() - 0.5) * 0.15)), scale(n, k + (rnd() - 0.5) * 0.15));
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, 0.22 + rnd() * 0.06, 0.17 + rnd() * 0.05, rnd() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      break;
    }
    case 'sand': {
      ctx.fillStyle = 'rgba(150,110,60,0.12)';
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const L = dist(a, b);
        for (let s = 0; s < L; s += 0.35) {
          const c = lerp(a, b, s / L);
          ctx.beginPath();
          ctx.arc(c.x + ((s * 13) % 1) - 0.5, c.y + ((s * 7) % 1) - 0.5, 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
  }
  ctx.restore();
  // الحواف
  poly(ctx, outline);
  ctx.strokeStyle = p.material === 'wood-turf' ? '#7a5534' : shade(PATH_FILL[p.material] ?? '#4f9a35', -0.3);
  ctx.lineWidth = p.material === 'wood-turf' ? Math.max(0.08, px(o, 1.5)) : Math.max(px(o, 1), 0.02);
  ctx.stroke();
  if (o.issue || o.selected) {
    poly(ctx, outline);
    ctx.strokeStyle = o.issue === 'error' ? '#d62828' : o.issue === 'warning' ? '#e09f1f' : '#1d6fd8';
    ctx.lineWidth = px(o, 2.5);
    ctx.setLineDash(o.issue ? [px(o, 7), px(o, 4)] : []);
    ctx.stroke();
  }
  // إنارة الجوانب
  if (p.edgeLights) {
    const lights = pathEdgeLights(el);
    for (const lp of lights) {
      ctx.save();
      ctx.translate(lp.x, lp.y);
      if (o.night) glow(ctx, 0.9, LIGHT_HEX.warm, 0.5);
      ctx.fillStyle = '#ffcf6a';
      ctx.strokeStyle = '#5a4020';
      ctx.lineWidth = px(o, 1);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.08, px(o, 2.5)), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

export function drawStringLights(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const pts = el.points ?? [];
  if (pts.length < 2) return;
  const lc = LIGHT_HEX[el.light?.color ?? 'warm'];
  const on = !!el.light?.on;
  ctx.save();
  poly(ctx, pts, false);
  ctx.strokeStyle = o.selected ? '#1d6fd8' : o.issue ? '#e09f1f' : 'rgba(40,30,20,0.7)';
  ctx.lineWidth = o.selected ? px(o, 2.4) : px(o, 1.4);
  ctx.setLineDash([px(o, 6), px(o, 3)]);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const b of stringBulbs(el)) {
    ctx.save();
    ctx.translate(b.p.x, b.p.y);
    if (on && o.night) glow(ctx, 0.6, lc, 0.45);
    ctx.fillStyle = on ? lc : '#9a9a9a';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.06, px(o, 2.2)), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (el.string?.autoPoles) {
    ctx.fillStyle = '#3a2a1c';
    for (const p of pts) ctx.fillRect(p.x - 0.09, p.y - 0.09, 0.18, 0.18);
  }
  ctx.restore();
}

export function drawPolylineElement(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  if (el.kind === 'path') drawPath(ctx, el, o);
  else if (el.kind === 'string-lights') drawStringLights(ctx, el, o);
}

/** رسم أي عنصر في الإحداثيات العالمية (للتصدير) */
export function drawElementWorld(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  if (isPolyline(el.kind)) {
    drawPolylineElement(ctx, el, o);
    return;
  }
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.rotate(el.rotation * DEG);
  if (el.kind === 'volleyball' && o.showSafety !== false) drawCourtZone(ctx, el, o);
  drawLocalElement(ctx, el, o);
  ctx.restore();
}

// ——— الأرض والسياج والشبكة ———

export function drawLand(ctx: Ctx, land: Land, _o?: DrawOpts) {
  const pts = landPolygon(land);
  const b = boundsOf(pts);
  ctx.save();
  // الصحراء المحيطة
  ctx.fillStyle = '#e3cfa6';
  ctx.fillRect(b.minX - 200, b.minY - 200, b.maxX - b.minX + 400, b.maxY - b.minY + 400);
  drawSurroundings(ctx, land, _o ?? { ppm: 10 });
  poly(ctx, pts);
  ctx.fillStyle = GROUND_COLORS[land.ground];
  ctx.fill();
  // نسيج خفيف للأرض
  ctx.save();
  poly(ctx, pts);
  ctx.clip();
  ctx.fillStyle = land.ground === 'flat' ? 'rgba(120,100,80,0.05)' : 'rgba(150,110,60,0.07)';
  for (let y = b.minY; y < b.maxY; y += 1.3) {
    for (let x = b.minX + ((y * 0.7) % 1.1); x < b.maxX; x += 1.7) {
      ctx.beginPath();
      ctx.ellipse(x, y, 0.5, 0.12, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.restore();
}

export function drawFence(ctx: Ctx, land: Land, o: DrawOpts) {
  const edges = landEdges(land);
  const ent = entranceInfo(land);
  const color = land.fence.enabled ? shade(land.fence.color, -0.35) : 'rgba(90,70,50,0.5)';
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'butt';
  ctx.lineWidth = land.fence.enabled ? Math.max(0.12, px(o, 2.5)) : px(o, 1.5);
  if (!land.fence.enabled) ctx.setLineDash([px(o, 8), px(o, 6)]);
  edges.forEach((e, i) => {
    ctx.beginPath();
    if (i === ent.edge) {
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(ent.a.x, ent.a.y);
      ctx.moveTo(ent.b.x, ent.b.y);
      ctx.lineTo(e.b.x, e.b.y);
    } else {
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);
  if (land.fence.enabled) {
    ctx.fillStyle = shade(land.fence.color, -0.5);
    const s = Math.max(0.16, px(o, 3));
    for (const e of edges) {
      const n = Math.max(1, Math.round(e.length / 2.5));
      for (let i = 0; i <= n; i++) {
        const p = lerp(e.a, e.b, i / n);
        const inGap =
          dist(p, ent.center) < ent.width / 2 - 0.05 && Math.abs((p.x - ent.center.x) * ent.inward.x + (p.y - ent.center.y) * ent.inward.y) < 0.2;
        if (inGap) continue;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
  }
  // بوابة المدخل
  ctx.fillStyle = '#7a4a24';
  const gp = Math.max(0.3, px(o, 5));
  for (const p of [ent.a, ent.b]) ctx.fillRect(p.x - gp / 2, p.y - gp / 2, gp, gp);
  const arrowBase = add(ent.center, scale(ent.inward, -1.6));
  const tip = add(ent.center, scale(ent.inward, 0.4));
  ctx.strokeStyle = '#a0522d';
  ctx.lineWidth = Math.max(0.12, px(o, 2.5));
  ctx.beginPath();
  ctx.moveTo(arrowBase.x, arrowBase.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  const left = add(tip, add(scale(ent.inward, -0.6), scale(ent.dir, 0.45)));
  const right = add(tip, add(scale(ent.inward, -0.6), scale(ent.dir, -0.45)));
  ctx.fillStyle = '#a0522d';
  ctx.beginPath();
  ctx.moveTo(tip.x + ent.inward.x * 0.2, tip.y + ent.inward.y * 0.2);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fill();
  const lbl = add(ent.center, scale(ent.inward, -2.6));
  text(ctx, 'المدخل الرئيسي', lbl.x, lbl.y, o, 12, '#6b3a1c', 700);
  ctx.restore();
}

export function drawGrid(ctx: Ctx, land: Land, step: number, o: DrawOpts) {
  const b = boundsOf(landPolygon(land));
  const pad = 6;
  const x0 = Math.floor((b.minX - pad) / 1) * 1;
  const y0 = Math.floor((b.minY - pad) / 1) * 1;
  const x1 = Math.ceil(b.maxX + pad);
  const y1 = Math.ceil(b.maxY + pad);
  ctx.save();
  if (step * o.ppm >= 6) {
    ctx.strokeStyle = 'rgba(110,80,40,0.10)';
    ctx.lineWidth = px(o, 1);
    ctx.beginPath();
    for (let x = x0; x <= x1 + 1e-6; x += step) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
    }
    for (let y = y0; y <= y1 + 1e-6; y += step) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();
  }
  const major = o.ppm < 6 ? 10 : 5;
  ctx.strokeStyle = 'rgba(110,80,40,0.22)';
  ctx.lineWidth = px(o, 1);
  ctx.beginPath();
  for (let x = Math.ceil(x0 / major) * major; x <= x1; x += major) {
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
  }
  for (let y = Math.ceil(y0 / major) * major; y <= y1; y += major) {
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
  }
  ctx.stroke();
  // أرقام المسطرة بالمتر
  for (let x = Math.ceil(b.minX / major) * major; x <= b.maxX + 1e-6; x += major) {
    text(ctx, `${Math.round(x - b.minX)}`, x, b.minY - px(o, 14), o, 10, '#7a5a35', 600);
  }
  for (let y = Math.ceil(b.minY / major) * major; y <= b.maxY + 1e-6; y += major) {
    text(ctx, `${Math.round(y - b.minY)}`, b.minX - px(o, 16), y, o, 10, '#7a5a35', 600);
  }
  ctx.restore();
}

// ——— القياسات والتسميات ———

export function drawDimensionLine(
  ctx: Ctx,
  a: Vec2,
  b: Vec2,
  label: string,
  o: DrawOpts,
  color = '#5b2c83',
  dashed = false,
) {
  const L = dist(a, b);
  if (L < 1e-3) return;
  const dir = norm(sub(b, a));
  const n = { x: -dir.y, y: dir.x };
  const t = px(o, 6);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = px(o, 1.6);
  if (dashed) ctx.setLineDash([px(o, 5), px(o, 4)]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  for (const p of [a, b]) {
    ctx.moveTo(p.x + n.x * t, p.y + n.y * t);
    ctx.lineTo(p.x - n.x * t, p.y - n.y * t);
  }
  ctx.stroke();
  const m = lerp(a, b, 0.5);
  const tw = measureText(ctx, label, o, 11, 700) + px(o, 10);
  if (L * o.ppm > 14) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRect(ctx, m.x - tw / 2, m.y - px(o, 9), tw, px(o, 18), px(o, 5));
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = px(o, 1);
    ctx.stroke();
    text(ctx, label, m.x, m.y + px(o, 0.5), o, 11, color, 700, '');
  }
  ctx.restore();
}

export function drawMeasurement(ctx: Ctx, m: Measurement, o: DrawOpts) {
  drawDimensionLine(ctx, m.a, m.b, formatMeters(dist(m.a, m.b)), o, o.selected ? '#1d6fd8' : '#5b2c83');
}

export interface LabelOpts extends DrawOpts {
  names: boolean;
  dims: boolean;
  issues?: Map<string, { severity: 'error' | 'warning' }[]>;
}

/** أسماء العناصر وأبعادها — تُرسم أفقياً دائماً لسهولة القراءة */
export function drawLabels(ctx: Ctx, plan: Plan, o: LabelOpts) {
  for (const el of plan.elements) {
    const cat = CATALOG_BY_KIND[el.kind];
    if (cat.geometry === 'point') continue;
    let cx = el.x;
    let cy = el.y;
    let dims = `${fmt(el.width)} × ${fmt(el.depth)} م`;
    let minScreen = Math.min(el.width, el.depth) * o.ppm;
    if (cat.geometry === 'polyline') {
      const pts = el.points ?? [];
      if (pts.length < 2) continue;
      let best = 1;
      for (let i = 1; i < pts.length; i++) if (dist(pts[i - 1], pts[i]) > dist(pts[best - 1], pts[best])) best = i;
      const m = lerp(pts[best - 1], pts[best], 0.5);
      cx = m.x;
      cy = m.y;
      const L = polylineLength(pts);
      if (el.kind === 'path' && el.path) {
        dims = `${fmt(L)} × ${fmt(el.path.width)} م = ${fmt(L * el.path.width, 1)} م²`;
      } else {
        dims = `${fmt(L)} م`;
      }
      minScreen = 40;
      if (el.kind === 'string-lights') {
        cy -= px(o, 12);
      }
    }
    if (minScreen < 22) continue;
    const showName = o.names && minScreen > 34;
    const lines: { s: string; size: number; color: string; weight: number }[] = [];
    if (showName) lines.push({ s: el.name, size: 12, color: '#2b1d12', weight: 700 });
    if (o.dims && el.kind !== 'string-lights') lines.push({ s: dims, size: 10.5, color: '#5b3a1e', weight: 600 });
    const lh = px(o, 15);
    const start = cy - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => text(ctx, l.s, cx, start + i * lh, o, l.size, l.color, l.weight));
    const iss = o.issues?.get(el.id);
    if (iss && iss.length) {
      const err = iss.some((i) => i.severity === 'error');
      const b = cat.geometry === 'polyline' ? { x: cx, y: cy - px(o, 22) } : { x: el.x, y: el.y - px(o, 26) - (lines.length * lh) / 2 };
      ctx.save();
      ctx.fillStyle = err ? '#d62828' : '#e09f1f';
      ctx.beginPath();
      ctx.arc(b.x, b.y, px(o, 9), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      text(ctx, '!', b.x, b.y + px(o, 0.5), o, 13, '#ffffff', 800, '');
    }
  }
}

function fmt(n: number, d = 2) {
  return (Math.round(n * 10 ** d) / 10 ** d).toString();
}

export function drawTentEntranceZones(ctx: Ctx, plan: Plan) {
  ctx.save();
  ctx.fillStyle = 'rgba(29,111,216,0.08)';
  for (const el of plan.elements) {
    if (!el.tent) continue;
    const z = tentEntranceZone(el);
    if (!z) continue;
    poly(ctx, z);
    ctx.fill();
  }
  ctx.restore();
}

/** سهم الشمال (للتصدير) */
export function drawNorthArrow(ctx: Ctx, x: number, y: number, size: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3b2a1e';
  ctx.lineWidth = size * 0.04;
  ctx.stroke();
  ctx.rotate(angle * DEG);
  ctx.fillStyle = '#b23a2a';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.5);
  ctx.lineTo(size * 0.17, size * 0.05);
  ctx.lineTo(-size * 0.17, size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3b2a1e';
  ctx.beginPath();
  ctx.moveTo(0, size * 0.42);
  ctx.lineTo(size * 0.17, size * 0.05);
  ctx.lineTo(-size * 0.17, size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3b2a1e';
  ctx.font = `700 ${size * 0.3}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ش', 0, -size * 0.75);
  ctx.restore();
}

export function outlineOf(el: PlanElement): Vec2[] {
  if (el.kind === 'path' && el.points && el.path) {
    const { left, right } = polylineOutline(el.points, el.path.width);
    return [...left, ...right.reverse()];
  }
  return [];
}

export { rotate };
