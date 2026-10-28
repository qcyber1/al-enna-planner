import type { Plan } from '../types/plan';
import { landBounds } from '../lib/geometry';
import { computeSummary } from '../lib/quantities';
import { validatePlan } from '../lib/validation';
import {
  FONT,
  drawElementWorld,
  drawFence,
  drawGrid,
  drawLabels,
  drawLand,
  drawMeasurement,
  drawNorthArrow,
  type DrawOpts,
} from './draw';
import { drawLightMap } from './lightmap';
import { LUX_STOPS } from '../lib/lighting';
import { isPolyline } from '../lib/catalog';

export interface PlanImageOptions {
  width?: number;
  title?: string;
  subtitle?: string;
  grid?: boolean;
  night?: boolean;
  lightMap?: boolean;
  footer?: boolean;
  dims?: boolean;
  names?: boolean;
  measurements?: boolean;
}

function fmt(n: number, d = 1) {
  return (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('en-US');
}

/** يرسم المسقط العلوي كاملاً في Canvas مستقل (للتصدير والمقارنة والصور المصغرة) */
export function renderPlanCanvas(plan: Plan, opts: PlanImageOptions = {}): HTMLCanvasElement {
  const W = Math.round(opts.width ?? 1800);
  const header = opts.title ? Math.round(W * 0.075) : 0;
  const footer = opts.footer === false ? 0 : Math.round(W * 0.11);
  const b = landBounds(plan.land);
  const margin = 5;
  const worldW = b.maxX - b.minX + margin * 2;
  const worldH = b.maxY - b.minY + margin * 2;
  const ppm = W / worldW;
  const mapH = Math.round(worldH * ppm);
  const H = header + mapH + footer;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#f7f0e2';
  ctx.fillRect(0, 0, W, H);

  // الخريطة
  ctx.save();
  ctx.translate(0, header);
  ctx.beginPath();
  ctx.rect(0, 0, W, mapH);
  ctx.clip();
  ctx.scale(ppm, ppm);
  ctx.translate(-b.minX + margin, -b.minY + margin);
  const o: DrawOpts = { ppm, night: opts.night };
  drawLand(ctx, plan.land, o);
  if (opts.grid !== false) drawGrid(ctx, plan.land, 1, o);
  if (opts.lightMap) drawLightMap(ctx, plan);
  const validation = validatePlan(plan);
  const issueOf = (id: string) => {
    const l = validation.byElement.get(id);
    if (!l?.length) return null;
    return l.some((i) => i.severity === 'error') ? 'error' : 'warning';
  };
  // الممرات أولاً ثم بقية العناصر
  const ordered = [
    ...plan.elements.filter((e) => e.kind === 'path'),
    ...plan.elements.filter((e) => e.kind !== 'path' && e.kind !== 'string-lights'),
    ...plan.elements.filter((e) => e.kind === 'string-lights'),
  ];
  for (const el of ordered) {
    drawElementWorld(ctx, el, { ...o, issue: issueOf(el.id), showSafety: true });
    void isPolyline;
  }
  drawFence(ctx, plan.land, o);
  if (opts.measurements !== false) for (const m of plan.measurements) drawMeasurement(ctx, m, o);
  drawLabels(ctx, plan, { ...o, names: opts.names !== false, dims: opts.dims !== false });
  ctx.restore();

  // الترويسة
  if (header) {
    ctx.fillStyle = '#3b2a1e';
    ctx.fillRect(0, 0, W, header);
    ctx.fillStyle = '#d4a24c';
    ctx.fillRect(0, header - 4, W, 4);
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f7ecd6';
    ctx.font = `700 ${header * 0.36}px ${FONT}`;
    ctx.fillText(opts.title ?? '', W - header * 0.35, header * (opts.subtitle ? 0.38 : 0.5));
    if (opts.subtitle) {
      ctx.font = `500 ${header * 0.22}px ${FONT}`;
      ctx.fillStyle = '#e1cfa9';
      ctx.fillText(opts.subtitle, W - header * 0.35, header * 0.74);
    }
    ctx.textAlign = 'left';
    ctx.font = `600 ${header * 0.24}px ${FONT}`;
    ctx.fillStyle = '#d4a24c';
    ctx.fillText('مخطط العنة | Al Enna Planner', header * 0.35, header * 0.5);
  }

  // سهم الشمال
  const na = Math.max(46, W * 0.045);
  drawNorthArrow(ctx, W - na * 1.0, header + na * 1.0, na, plan.land.northAngle);

  // التذييل: مقياس الرسم وملخص سريع
  if (footer) {
    const y0 = header + mapH;
    ctx.fillStyle = '#efe4cc';
    ctx.fillRect(0, y0, W, footer);
    ctx.fillStyle = '#d4a24c';
    ctx.fillRect(0, y0, W, 3);
    // مقياس الرسم
    const barM = niceBar(W * 0.18 / ppm);
    const barPx = barM * ppm;
    const bx = footer * 0.4;
    const by = y0 + footer * 0.62;
    ctx.fillStyle = '#3b2a1e';
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#f7f0e2' : '#3b2a1e';
      ctx.fillRect(bx + (barPx / 4) * i, by, barPx / 4, footer * 0.08);
    }
    ctx.strokeStyle = '#3b2a1e';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, barPx, footer * 0.08);
    ctx.fillStyle = '#3b2a1e';
    ctx.font = `600 ${footer * 0.16}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`0`, bx, by - 6);
    ctx.textAlign = 'right';
    ctx.fillText(`${barM} م`, bx + barPx, by - 6);

    const s = computeSummary(plan);
    const items = [
      `الأرض ${fmt(plan.land.width)} × ${fmt(plan.land.shape === 'square' ? plan.land.width : plan.land.depth)} م (${fmt(s.landArea, 0)} م²)`,
      `الخيام ${s.tentCount} — ${fmt(s.tentArea, 0)} م²`,
      `الممرات ${fmt(s.pathLength)} م — ${fmt(s.pathArea)} م²`,
      `الإنارة: ${s.lights.poles} عمود، ${s.lights.floods} كشاف، ${s.lights.strings} سلسلة`,
      `حمامات ${s.toilets} — مغاسل ${s.sinks}`,
      `مساحة فارغة ${fmt(s.freePct, 0)}%`,
    ];
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${footer * 0.15}px ${FONT}`;
    const colW = (W - bx - barPx - footer * 0.6) / 3;
    items.forEach((it, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      ctx.fillStyle = '#3b2a1e';
      ctx.fillText(it, W - footer * 0.35 - col * colW, y0 + footer * (0.32 + row * 0.36));
    });
    if (validation.issues.length) {
      ctx.textAlign = 'left';
      ctx.fillStyle = validation.errorCount ? '#b42318' : '#b7791f';
      ctx.font = `700 ${footer * 0.14}px ${FONT}`;
      ctx.fillText(`⚠ ${validation.issues.length} تنبيه`, bx, y0 + footer * 0.3);
    }
  }

  if (opts.lightMap) {
    // مفتاح خريطة الإضاءة
    const lx = 24;
    const ly = header + 24;
    const sw = 28;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillRect(lx - 10, ly - 10, 180, LUX_STOPS.length * (sw + 6) + 14);
    ctx.font = `600 16px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    LUX_STOPS.forEach((st, i) => {
      ctx.fillStyle = `rgb(${st.color.join(',')})`;
      ctx.fillRect(lx, ly + i * (sw + 6), sw, sw);
      ctx.fillStyle = '#3b2a1e';
      ctx.fillText(st.label, lx + sw + 10, ly + i * (sw + 6) + sw / 2);
    });
  }
  return canvas;
}

function niceBar(m: number): number {
  const opts = [1, 2, 5, 10, 20, 25, 50, 100];
  let best = opts[0];
  for (const o of opts) if (o <= m) best = o;
  return best;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('تعذر إنشاء الصورة'))), type, quality);
  });
}

export function planThumbnail(plan: Plan, width = 520): string {
  const c = renderPlanCanvas(plan, { width, footer: false, grid: false, dims: false, names: false, measurements: false });
  return c.toDataURL('image/jpeg', 0.82);
}

export function dateLabel(): string {
  try {
    return new Date().toLocaleDateString('ar-QA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
