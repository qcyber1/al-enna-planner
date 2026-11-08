// «المخطط الاحترافي»: لوحة A3 أفقية مثل مخططات المكاتب الهندسية
// إطار، جدول عنوان، المسقط بالمقاسات، سهم الشمال والريح، مقياس رسم، جدول العناصر والمساحات، وصورة 3D اختيارية.
import type { Plan, PlanElement } from '../types/plan';
import { CATALOG_BY_KIND } from '../lib/catalog';
import { landBounds, polygonArea, polylineLength } from '../lib/geometry';
import { validatePlan } from '../lib/validation';
import { WIND_FROM } from '../lib/wind';
import { FONT, drawElementWorld, drawFence, drawGrid, drawLabels, drawLand, drawMeasurement, type DrawOpts } from './draw';
import { drawWatermark } from './watermark';

export interface SheetInfo {
  project: string;
  design: string;
  owner?: string;
  /** صورة 3D (رندر) تنحط في جدول العنوان */
  photo?: HTMLImageElement | HTMLCanvasElement | null;
  date?: Date;
}

/** المباني (اللي تنحسب في نسبة البناء) */
const BUILDINGS = new Set<string>(['majlis-room', 'worker-room', 'feed-store', 'horse-stable', 'storage', 'sleep-cabin', 'kitchen-cabin', 'toilet', 'outdoor-kitchen']);
/** المسطحات الخضراء */
const GREEN = new Set<string>(['farm-bed', 'greenhouse']);

const A3 = { w: 4200, h: 2970 };
/** تكبير النصوص والخطوط في المسقط عشان تنقرا بعد الطباعة */
const PRINT_SCALE = 2.4; // نسبة A3 (420×297 مم) — 10 بكسل للمليمتر تقريباً

const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('en-US');

export interface SheetStats {
  landArea: number;
  builtArea: number;
  builtPct: number;
  greenArea: number;
  rows: { label: string; count: number; size: string; area: number }[];
  tallBuildings: string[];
}

export function sheetStats(plan: Plan): SheetStats {
  const L = plan.land;
  // الأرض غير المنتظمة: مساحة المضلع الحقيقية
  const landArea = L.shape === 'polygon' && L.polygon?.length ? Math.abs(polygonArea(L.polygon)) : L.width * (L.shape === 'square' ? L.width : L.depth);
  let builtArea = 0;
  let greenArea = 0;
  const tall: string[] = [];
  const groups = new Map<string, { label: string; count: number; sizes: Set<string>; area: number }>();
  const area = (e: PlanElement) => (e.points ? 0 : e.width * e.depth);
  for (const e of plan.elements) {
    const cat = CATALOG_BY_KIND[e.kind];
    if (cat.geometry === 'point') continue;
    if (BUILDINGS.has(e.kind)) {
      builtArea += area(e);
      if (e.height > 4) tall.push(e.name);
    }
    if (GREEN.has(e.kind)) greenArea += area(e);
    if (e.kind === 'path' && e.path) {
      const a = e.path.circle ? Math.PI * e.path.circle.r ** 2 : polylineLength(e.points ?? []) * e.path.width;
      if (e.path.material === 'turf') greenArea += a;
    }
    if (e.kind === 'string-lights') continue;
    const key = e.kind === 'path' ? `path:${e.path?.material}` : e.kind;
    const g = groups.get(key) ?? { label: e.kind === 'path' ? (e.path?.circle ? 'حشيش / حديقة' : 'ممرات') : cat.label, count: 0, sizes: new Set<string>(), area: 0 };
    g.count++;
    if (!e.points) g.sizes.add(`${fmt(e.width)}×${fmt(e.depth)}`);
    g.area += e.kind === 'path' && e.path ? (e.path.circle ? Math.PI * e.path.circle.r ** 2 : polylineLength(e.points ?? []) * e.path.width) : area(e);
    groups.set(key, g);
  }
  const rows = [...groups.values()]
    .sort((a, b) => b.area - a.area)
    .map((g) => ({ label: g.label, count: g.count, size: [...g.sizes].slice(0, 2).join('، ') + (g.sizes.size > 2 ? '…' : ''), area: g.area }));
  return { landArea, builtArea, builtPct: landArea ? (builtArea / landArea) * 100 : 0, greenArea, rows, tallBuildings: tall };
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = '#2b1d12', weight = 600, align: CanvasTextAlign = 'right') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/** سهم شمال كبير مع سهم ريح الشمال */
function compass(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, northAngle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#3b2a1e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  // الشمال
  ctx.save();
  ctx.rotate((-northAngle * Math.PI) / 180);
  ctx.fillStyle = '#3b2a1e';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.85);
  ctx.lineTo(r * 0.22, r * 0.25);
  ctx.lineTo(0, r * 0.08);
  ctx.lineTo(-r * 0.22, r * 0.25);
  ctx.closePath();
  ctx.fill();
  text(ctx, 'N', 0, -r - 34, 44, '#3b2a1e', 800, 'center');
  // الريح: تهب من WIND_FROM باتجاه المركز
  ctx.rotate((WIND_FROM * Math.PI) / 180);
  ctx.strokeStyle = '#2f6fb0';
  ctx.fillStyle = '#2f6fb0';
  ctx.lineWidth = 7;
  ctx.setLineDash([18, 10]);
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.55);
  ctx.lineTo(0, -r * 1.08);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.0);
  ctx.lineTo(14, -r * 1.14);
  ctx.lineTo(-14, -r * 1.14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** يرسم لوحة المخطط الاحترافي (A3 أفقي) */
export function renderPlanSheet(plan: Plan, info: SheetInfo): HTMLCanvasElement {
  const { w: W, h: H } = A3;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.direction = 'rtl';
  const izba = plan.land.site === 'izba';
  const stats = sheetStats(plan);
  const issues = validatePlan(plan);

  // الورقة والإطار المزدوج
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const m = 100;
  ctx.strokeStyle = '#2b1d12';
  ctx.lineWidth = 8;
  ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
  ctx.lineWidth = 2;
  ctx.strokeRect(m + 18, m + 18, W - 2 * m - 36, H - 2 * m - 36);

  // جدول العنوان على اليمين
  const tbW = 1150;
  const top = m + 18;
  const bottom = H - m - 18;
  const tbX0 = W - m - 18 - tbW;
  // ——— منطقة المسقط ———
  const ax = m + 18 + 60;
  const ay = top + 60;
  const aw = tbX0 - ax - 60;
  const ah = bottom - ay - 260;
  const b = landBounds(plan.land);
  const pad = 4;
  const ww = b.maxX - b.minX + pad * 2;
  const wh = b.maxY - b.minY + pad * 2;
  const ppm = Math.min(aw / ww, ah / wh);
  const ox = ax + (aw - ww * ppm) / 2;
  const oy = ay + (ah - wh * ppm) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ax - 50, ay - 50, aw + 100, ah + 100);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ax - 50, ay - 50, aw + 100, ah + 100);
  ctx.translate(ox, oy);
  ctx.scale(ppm, ppm);
  ctx.translate(-b.minX + pad, -b.minY + pad);
  const o: DrawOpts = { ppm: ppm / PRINT_SCALE };
  drawLand(ctx, plan.land, o);
  drawGrid(ctx, plan.land, 1, o);
  const ordered = [...plan.elements.filter((e) => e.kind === 'path'), ...plan.elements.filter((e) => e.kind !== 'path')];
  for (const el of ordered) drawElementWorld(ctx, el, { ...o, showSafety: false });
  drawFence(ctx, plan.land, o);
  for (const mm of plan.measurements) drawMeasurement(ctx, mm, o);
  drawLabels(ctx, plan, { ...o, names: true, dims: true });
  // أبعاد الأرض الخارجية
  dimLine(ctx, { x: b.minX, y: b.maxY + 2.2 }, { x: b.maxX, y: b.maxY + 2.2 }, `${fmt(b.maxX - b.minX)} م`, ppm);
  dimLine(ctx, { x: b.minX - 2.2, y: b.minY }, { x: b.minX - 2.2, y: b.maxY }, `${fmt(b.maxY - b.minY)} م`, ppm, true);
  ctx.restore();
  drawWatermark(ctx, ax, ay, aw, ah, false);

  // الإطار فوق المسقط
  ctx.strokeStyle = '#2b1d12';
  ctx.lineWidth = 8;
  ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
  ctx.lineWidth = 2;
  ctx.strokeRect(m + 18, m + 18, W - 2 * m - 36, H - 2 * m - 36);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(tbX0, top, tbW, bottom - top);

  const tbX = tbX0;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tbX, top);
  ctx.lineTo(tbX, bottom);
  ctx.stroke();
  const R = W - m - 18 - 50; // حافة النص اليمنى
  const hr = (y: number) => {
    ctx.strokeStyle = '#2b1d12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tbX, y);
    ctx.lineTo(W - m - 18, y);
    ctx.stroke();
  };

  // الشعار والاسم
  ctx.fillStyle = '#3b2a1e';
  ctx.fillRect(tbX, top, tbW, 230);
  ctx.fillStyle = '#d4a24c';
  ctx.fillRect(tbX, top + 230, tbW, 8);
  text(ctx, izba ? 'مخطط عزبة' : 'مخطط عنة', R, top + 80, 78, '#f7ecd6', 800);
  text(ctx, 'مخطط العنة | Al Enna Planner', R, top + 170, 38, '#d4a24c', 600);

  let y = top + 300;
  const row = (k: string, v: string, size = 42) => {
    text(ctx, k, R, y, 30, '#7a5c3e', 600);
    text(ctx, fit(ctx, v, tbW - 100, size), R, y + 52, size, '#2b1d12', 700);
    y += 130;
  };
  row('المشروع', info.project);
  row('التصميم', info.design);
  if (info.owner) row('المالك', info.owner);
  const d = info.date ?? new Date();
  const L = plan.land;
  row('الأرض', L.shape === 'polygon' ? `${fmt(stats.landArea, 0)} م²` : `${fmt(L.width)} × ${fmt(L.shape === 'square' ? L.width : L.depth)} م  (${fmt(stats.landArea, 0)} م²)`);
  hr(y - 40);

  // المساحات
  y += 10;
  text(ctx, 'المساحات', R, y, 40, '#3b2a1e', 800);
  y += 70;
  const kv = (k: string, v: string, warn = false) => {
    text(ctx, k, R, y, 34, '#4a3a2a', 600);
    text(ctx, v, tbX + 50, y, 36, warn ? '#b42318' : '#2b1d12', 700, 'left');
    y += 62;
  };
  kv('مساحة المباني', `${fmt(stats.builtArea, 0)} م²`);
  kv('نسبة البناء', `${fmt(stats.builtPct, 1)}%`);
  kv('المسطحات الخضراء', `${fmt(stats.greenArea, 0)} م²`);
  kv('التنبيهات', issues.issues.length ? `${issues.issues.length}` : 'لا يوجد ✓', issues.issues.length > 0);
  hr(y - 20);

  // جدول العناصر
  y += 30;
  text(ctx, 'جدول العناصر', R, y, 40, '#3b2a1e', 800);
  y += 60;
  const cols = { name: R, count: tbX + 470, size: tbX + 300, area: tbX + 50 };
  ctx.fillStyle = '#f3ead8';
  ctx.fillRect(tbX + 20, y - 28, tbW - 40, 56);
  text(ctx, 'العنصر', cols.name, y, 28, '#3b2a1e', 700);
  text(ctx, 'العدد', cols.count, y, 28, '#3b2a1e', 700, 'center');
  text(ctx, 'المقاس (م)', cols.size, y, 28, '#3b2a1e', 700, 'center');
  text(ctx, 'المساحة م²', cols.area, y, 28, '#3b2a1e', 700, 'left');
  y += 58;
  const photoH = info.photo ? 560 : 0;
  const maxY = bottom - 330 - photoH;
  const rows = stats.rows;
  let shown = 0;
  for (const r of rows) {
    if (y > maxY - 50) break;
    text(ctx, fit(ctx, r.label, 380, 30), cols.name, y, 30, '#2b1d12', 600);
    text(ctx, String(r.count), cols.count, y, 30, '#2b1d12', 700, 'center');
    text(ctx, r.size, cols.size, y, 24, '#5b4a3a', 600, 'center');
    text(ctx, fmt(r.area, 0), cols.area, y, 30, '#2b1d12', 600, 'left');
    ctx.strokeStyle = '#eadfca';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tbX + 20, y + 26);
    ctx.lineTo(W - m - 38, y + 26);
    ctx.stroke();
    y += 52;
    shown++;
  }
  if (shown < rows.length) text(ctx, `+ ${rows.length - shown} عناصر ثانية`, R, y, 26, '#7a5c3e', 600);

  // صورة 3D
  if (info.photo) {
    const py = bottom - 330 - photoH + 10;
    const pw = tbW - 80;
    const ph = photoH - 30;
    const src = info.photo;
    const sw = 'naturalWidth' in src ? src.naturalWidth : src.width;
    const sh = 'naturalHeight' in src ? src.naturalHeight : src.height;
    const s = Math.max(pw / sw, ph / sh);
    const cw = pw / s;
    const ch = ph / s;
    ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, tbX + 40, py, pw, ph);
    ctx.strokeStyle = '#2b1d12';
    ctx.lineWidth = 2;
    ctx.strokeRect(tbX + 40, py, pw, ph);
  }

  // التذييل: الملاحظات والتاريخ
  hr(bottom - 320);
  let ny = bottom - 270;
  const notes: string[] = [];
  if (izba) notes.push('اشتراطات البلدية (2024): المجلس وسكن العمال والمخازن بالطابوق، ارتفاع 4 م كحد أقصى، سقف ساندوتش بانل، بدون خرسانة مسلحة — تأكد من لجنة شؤون العزب.');
  if (stats.tallBuildings.length) notes.push(`⚠ ارتفاع أكثر من 4 م: ${stats.tallBuildings.join('، ')}`);
  notes.push('المقاسات تقريبية للتخطيط — تتأكد في الموقع قبل التنفيذ.');
  ctx.save();
  for (const n of notes) {
    wrap(ctx, n, R, ny, tbW - 90, 27, 38, n.startsWith('⚠') ? '#b42318' : '#4a3a2a').forEach(() => (ny += 38));
    ny += 8;
  }
  ctx.restore();
  text(ctx, `التاريخ: ${d.toLocaleDateString('ar-QA')}`, R, bottom - 50, 30, '#2b1d12', 700);
  text(ctx, 'i3enna.qa', tbX + 50, bottom - 50, 30, '#7a5c3e', 700, 'left');


  // البوصلة والريح ومقياس الرسم أسفل المسقط
  const cy = bottom - 130;
  compass(ctx, ax + 120, cy - 10, 70, plan.land.northAngle);
  text(ctx, 'ريح الشمال', ax + 250, cy + 40, 28, '#2f6fb0', 700, 'left');
  const bar = niceBar(aw * 0.25 / ppm);
  const bx = ax + 420;
  const bw = bar * ppm;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#2b1d12';
    ctx.fillRect(bx + (bw / 5) * i, cy, bw / 5, 22);
  }
  ctx.strokeStyle = '#2b1d12';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, cy, bw, 22);
  text(ctx, '0', bx, cy - 26, 26, '#2b1d12', 700, 'center');
  text(ctx, `${bar} م`, bx + bw, cy - 26, 26, '#2b1d12', 700, 'center');
  // مقياس الرسم التقريبي على A3 (الورقة 420 مم = W بكسل)
  const scale = Math.round(1000 / (ppm * (420 / W)));
  text(ctx, `مقياس الرسم تقريباً 1:${niceScale(scale)} (عند الطباعة A3)`, bx, cy + 60, 26, '#4a3a2a', 600, 'left');
  return c;
}

/** يقص النص بنقاط إذا أطول من المساحة */
function fit(ctx: CanvasRenderingContext2D, s: string, maxW: number, size: number, weight = 700): string {
  ctx.font = `${weight} ${size}px ${FONT}`;
  if (ctx.measureText(s).width <= maxW) return s;
  let t = s;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function wrap(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, size: number, lh: number, color: string): string[] {
  ctx.font = `600 ${size}px ${FONT}`;
  const words = s.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => text(ctx, l, x, y + i * lh, size, color, 600));
  return lines;
}

function dimLine(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, label: string, ppm: number, vertical = false) {
  ctx.save();
  ctx.strokeStyle = '#2b1d12';
  ctx.fillStyle = '#2b1d12';
  ctx.lineWidth = 2 / ppm;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  const t = 0.6;
  for (const p of [a, b]) {
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(p.x - t, p.y);
      ctx.lineTo(p.x + t, p.y);
    } else {
      ctx.moveTo(p.x, p.y - t);
      ctx.lineTo(p.x, p.y + t);
    }
    ctx.stroke();
  }
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  ctx.translate(mx, my);
  if (vertical) ctx.rotate(-Math.PI / 2);
  ctx.font = `700 ${34 / ppm}px ${FONT}`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-tw / 2 - 8 / ppm, -24 / ppm, tw + 16 / ppm, 48 / ppm);
  ctx.fillStyle = '#2b1d12';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function niceBar(m: number): number {
  for (const n of [1, 2, 5, 10, 20, 25, 50, 100]) if (n >= m * 0.6) return n;
  return 100;
}
function niceScale(n: number): number {
  for (const s of [100, 125, 150, 200, 250, 300, 400, 500, 750, 1000]) if (s >= n) return s;
  return Math.round(n / 100) * 100;
}
