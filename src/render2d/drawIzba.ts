// رسم عناصر العزبة في المسقط العلوي (إحداثيات محلية، المركز 0،0)
import type { PlanElement } from '../types/plan';
import { shade, withAlpha } from '../lib/color';
import type { DrawOpts } from './draw';
import { outline } from './drawExtra';

type Ctx = CanvasRenderingContext2D;
const px = (o: DrawOpts, n: number) => n / o.ppm;
const lw = (o: DrawOpts, n: number) => Math.max(px(o, n), 0.02);

function shadow(ctx: Ctx, w: number, d: number) {
  ctx.fillStyle = 'rgba(60,40,20,0.14)';
  ctx.fillRect(-w / 2 + 0.15, -d / 2 + 0.2, w, d);
}

/** سياج مواسير/شبك حول حوش */
function fenceRect(ctx: Ctx, w: number, d: number, color: string, o: DrawOpts, postEvery = 2.5) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw(o, 2);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  ctx.fillStyle = shade(color, -0.3);
  const r = Math.max(px(o, 2), 0.06);
  const post = (x: number, y: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let x = -w / 2; x <= w / 2 + 1e-6; x += w / Math.max(1, Math.round(w / postEvery))) {
    post(x, -d / 2);
    post(x, d / 2);
  }
  for (let y = -d / 2; y <= d / 2 + 1e-6; y += d / Math.max(1, Math.round(d / postEvery))) {
    post(-w / 2, y);
    post(w / 2, y);
  }
}

/** بوابة الحوش (فتحة بالسياج من قدام) */
function gate(ctx: Ctx, w: number, d: number, o: DrawOpts) {
  const gw = Math.min(2.4, w * 0.25);
  ctx.save();
  ctx.strokeStyle = '#ead8b0';
  ctx.lineWidth = lw(o, 4);
  ctx.beginPath();
  ctx.moveTo(-gw / 2, d / 2);
  ctx.lineTo(gw / 2, d / 2);
  ctx.stroke();
  ctx.strokeStyle = '#6b6b6b';
  ctx.lineWidth = lw(o, 1.5);
  ctx.beginPath();
  ctx.moveTo(-gw / 2, d / 2);
  ctx.lineTo(-gw / 2 + gw * 0.7, d / 2 + gw * 0.45);
  ctx.stroke();
  ctx.restore();
}

/** سقف صاج مموج (خطوط) */
function corrugated(ctx: Ctx, x: number, y: number, w: number, d: number, color: string, o: DrawOpts) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, d);
  ctx.strokeStyle = shade(color, -0.18);
  ctx.lineWidth = lw(o, 0.6);
  for (let xx = x + 0.4; xx < x + w; xx += 0.4) {
    ctx.beginPath();
    ctx.moveTo(xx, y);
    ctx.lineTo(xx, y + d);
    ctx.stroke();
  }
  ctx.strokeStyle = shade(color, -0.4);
  ctx.lineWidth = lw(o, 1.2);
  ctx.strokeRect(x, y, w, d);
}

function hay(ctx: Ctx, x: number, y: number, s: number) {
  ctx.fillStyle = '#d9b84e';
  ctx.fillRect(x - s / 2, y - s * 0.35, s, s * 0.7);
  ctx.strokeStyle = '#a8862c';
  ctx.lineWidth = s * 0.06;
  ctx.strokeRect(x - s / 2, y - s * 0.35, s, s * 0.7);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.2, y - s * 0.35);
  ctx.lineTo(x - s * 0.2, y + s * 0.35);
  ctx.moveTo(x + s * 0.2, y - s * 0.35);
  ctx.lineTo(x + s * 0.2, y + s * 0.35);
  ctx.stroke();
}

function animalDots(ctx: Ctx, w: number, d: number, n: number, size: number, color: string, seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * (w - size * 3);
    const y = (rnd() - 0.2) * (d - size * 3) * 0.7;
    const a = rnd() * Math.PI;
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.55, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * size * 1.1, y + Math.sin(a) * size * 1.1, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pen(ctx: Ctx, el: PlanElement, o: DrawOpts, animal: { size: number; color: string; per: number }) {
  const w = el.width;
  const d = el.depth;
  // أرضية الحوش
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  // مظلة بالجهة الخلفية (ثلث الحوش)
  const sd = Math.min(d * 0.4, 5);
  ctx.fillStyle = 'rgba(40,30,20,0.12)';
  ctx.fillRect(-w / 2 + 0.2, -d / 2 + 0.3, w - 0.2, sd);
  corrugated(ctx, -w / 2, -d / 2, w, sd, el.roof ?? '#d6d3cc', o);
  // معلف قدام المظلة
  ctx.fillStyle = '#9aa3a8';
  ctx.fillRect(-w * 0.35, -d / 2 + sd + 0.2, w * 0.7, 0.45);
  const n = Math.max(2, Math.min(18, Math.round((w * (d - sd)) / animal.per)));
  animalDots(ctx, w, d - sd, n, animal.size, animal.color, Math.round(w * 7 + d * 13));
  fenceRect(ctx, w, d, el.accent, o);
  gate(ctx, w, d, o);
  outline(ctx, w, d, o);
}

function stable(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  shadow(ctx, w, d);
  corrugated(ctx, -w / 2, -d / 2, w, d, el.roof ?? shade(el.color, 0.05), o);
  const n = Math.max(1, Math.round(w / 3.5));
  const bw = w / n;
  ctx.strokeStyle = el.accent;
  ctx.lineWidth = lw(o, 1.4);
  for (let i = 1; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + bw * i, -d / 2);
    ctx.lineTo(-w / 2 + bw * i, d / 2 - 1.2);
    ctx.stroke();
  }
  // الممر قدام البوكسات
  ctx.fillStyle = withAlpha('#c8b38c', 0.9);
  ctx.fillRect(-w / 2, d / 2 - 1.2, w, 1.2);
  ctx.fillStyle = el.accent;
  for (let i = 0; i < n; i++) ctx.fillRect(-w / 2 + bw * i + bw * 0.3, d / 2 - 1.3, bw * 0.4, 0.14);
  ctx.strokeStyle = shade(el.accent, -0.3);
  ctx.lineWidth = lw(o, 1.6);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  outline(ctx, w, d, o);
}

function animalShade(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  ctx.globalAlpha = 0.85;
  corrugated(ctx, -w / 2, -d / 2, w, d, el.roof ?? el.color, o);
  ctx.globalAlpha = 1;
  ctx.fillStyle = el.accent;
  const n = Math.max(1, Math.round(w / 4));
  for (let i = 0; i <= n; i++)
    for (const y of [-d / 2 + 0.15, d / 2 - 0.15]) ctx.fillRect(-w / 2 + (w / n) * i - 0.1, y - 0.1, 0.2, 0.2);
  outline(ctx, w, d, o);
}

function feedStore(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  shadow(ctx, w, d);
  corrugated(ctx, -w / 2, -d / 2, w, d, el.roof ?? el.color, o);
  const s = Math.min(1.1, w / 5, d / 3);
  for (let i = 0; i < 3; i++) hay(ctx, -w / 2 + s * 0.8 + i * s * 1.15, d / 2 - s * 0.6, s);
  outline(ctx, w, d, o);
}

function trough(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  ctx.fillStyle = el.accent;
  ctx.fillRect(-w / 2 + 0.08, -d / 2 + 0.08, w - 0.16, d - 0.16);
  ctx.strokeStyle = shade(el.color, -0.35);
  ctx.lineWidth = lw(o, 1);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  outline(ctx, w, d, o);
}

function room(ctx: Ctx, el: PlanElement, o: DrawOpts, majlis: boolean) {
  const w = el.width;
  const d = el.depth;
  shadow(ctx, w, d);
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  if (majlis) {
    // سجاد وجلسة على الأطراف من داخل
    ctx.fillStyle = withAlpha(el.accent, 0.35);
    ctx.fillRect(-w / 2 + 0.4, -d / 2 + 0.4, w - 0.8, d - 0.8);
    ctx.fillStyle = shade(el.accent, 0.15);
    const t = 0.7;
    ctx.fillRect(-w / 2 + 0.4, -d / 2 + 0.4, w - 0.8, t);
    ctx.fillRect(-w / 2 + 0.4, -d / 2 + 0.4, t, d - 0.8);
    ctx.fillRect(w / 2 - 0.4 - t, -d / 2 + 0.4, t, d - 0.8);
  }
  ctx.strokeStyle = el.roof ?? shade(el.color, -0.45);
  ctx.lineWidth = el.roof ? Math.max(0.25, lw(o, 3)) : lw(o, 2.4);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  // الباب
  const dw = Math.min(1.2, w * 0.25);
  ctx.strokeStyle = '#ead8b0';
  ctx.lineWidth = lw(o, 3);
  ctx.beginPath();
  ctx.moveTo(-dw / 2, d / 2);
  ctx.lineTo(dw / 2, d / 2);
  ctx.stroke();
  ctx.strokeStyle = el.accent;
  ctx.lineWidth = lw(o, 1);
  ctx.beginPath();
  ctx.arc(-dw / 2, d / 2, dw, -Math.PI / 2, 0);
  ctx.stroke();
  // مكيف
  ctx.fillStyle = '#e4e4e4';
  ctx.fillRect(w / 2 - 1, -d / 2 - 0.35, 0.8, 0.35);
  outline(ctx, w, d, o);
}

function palm(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const r = Math.min(el.width, el.depth) / 2;
  ctx.fillStyle = 'rgba(40,50,20,0.16)';
  ctx.beginPath();
  ctx.arc(0.3, 0.4, r * 0.95, 0, Math.PI * 2);
  ctx.fill();
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    ctx.save();
    ctx.rotate(a);
    ctx.fillStyle = i % 2 ? el.color : shade(el.color, 0.12);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.18, r, 0);
    ctx.quadraticCurveTo(r * 0.5, r * 0.18, 0, 0);
    ctx.fill();
    ctx.strokeStyle = shade(el.color, -0.3);
    ctx.lineWidth = lw(o, 0.6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 0.95, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = el.accent;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(r * 0.12, 0.2), 0, Math.PI * 2);
  ctx.fill();
  if (o.selected || o.issue) outline(ctx, el.width, el.depth, o);
}

function tree(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const r = Math.min(el.width, el.depth) / 2;
  ctx.fillStyle = 'rgba(40,50,20,0.16)';
  ctx.beginPath();
  ctx.arc(0.35, 0.45, r, 0, Math.PI * 2);
  ctx.fill();
  const blobs = 7;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? el.color : shade(el.color, 0.1);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = shade(el.color, 0.18);
  ctx.beginPath();
  ctx.arc(-r * 0.15, -r * 0.15, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  if (o.selected || o.issue) outline(ctx, el.width, el.depth, o);
}

function farmBed(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  ctx.fillStyle = shade(el.color, 0.25);
  ctx.fillRect(-w / 2, -d / 2, w, d);
  // سقف لعدد الصفوف والنبتات عشان الأحواض الضخمة ما تثقّل الرسم
  const rows = Math.min(40, Math.max(1, Math.floor(d / 1.2)));
  const rh = d / rows;
  const step = Math.max(0.6, w / 80);
  for (let i = 0; i < rows; i++) {
    const y = -d / 2 + rh * i;
    ctx.fillStyle = el.color;
    ctx.fillRect(-w / 2 + 0.2, y + rh * 0.15, w - 0.4, rh * 0.6);
    ctx.fillStyle = el.accent;
    for (let x = -w / 2 + 0.5; x < w / 2 - 0.2; x += step) {
      ctx.beginPath();
      ctx.arc(x, y + rh * 0.45, Math.min(0.22, rh * 0.22), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = shade(el.color, -0.3);
  ctx.lineWidth = lw(o, 1);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  outline(ctx, w, d, o);
}

function greenhouse(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  shadow(ctx, w, d);
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, shade(el.color, -0.08));
  g.addColorStop(0.5, '#ffffff');
  g.addColorStop(1, shade(el.color, -0.08));
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  // الأقواس كل 2 م
  ctx.strokeStyle = el.accent;
  ctx.lineWidth = lw(o, 1);
  for (let y = -d / 2; y <= d / 2 + 1e-6; y += d / Math.max(1, Math.round(d / 2))) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, y);
    ctx.lineTo(w / 2, y);
    ctx.stroke();
  }
  ctx.setLineDash([px(o, 4), px(o, 3)]);
  ctx.beginPath();
  ctx.moveTo(0, -d / 2);
  ctx.lineTo(0, d / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = shade(el.accent, -0.3);
  ctx.lineWidth = lw(o, 1.6);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  outline(ctx, w, d, o);
}

function pool(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  const m = Math.min(1, w * 0.12, d * 0.15);
  ctx.fillStyle = el.accent;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  const g = ctx.createLinearGradient(0, -d / 2, 0, d / 2);
  g.addColorStop(0, shade(el.color, 0.25));
  g.addColorStop(1, shade(el.color, -0.15));
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2 + m, -d / 2 + m, w - 2 * m, d - 2 * m);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = lw(o, 1);
  for (let i = 0; i < 4; i++) {
    const y = -d / 2 + m + ((d - 2 * m) * (i + 0.6)) / 4.4;
    ctx.beginPath();
    for (let x = -w / 2 + m + 0.2; x < w / 2 - m - 0.2; x += 0.5) {
      const yy = y + Math.sin(x * 2 + i) * 0.08;
      if (x === -w / 2 + m + 0.2) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = shade(el.accent, -0.35);
  ctx.lineWidth = lw(o, 1.2);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  outline(ctx, w, d, o);
}

export function drawIzba(ctx: Ctx, el: PlanElement, o: DrawOpts): boolean {
  switch (el.kind) {
    case 'sheep-pen':
      pen(ctx, el, o, { size: 0.42, color: '#f4efe4', per: 6 });
      return true;
    case 'camel-pen':
      pen(ctx, el, o, { size: 0.9, color: '#b8875a', per: 30 });
      return true;
    case 'horse-stable':
      stable(ctx, el, o);
      return true;
    case 'animal-shade':
      animalShade(ctx, el, o);
      return true;
    case 'feed-store':
      feedStore(ctx, el, o);
      return true;
    case 'trough':
      trough(ctx, el, o);
      return true;
    case 'worker-room':
      room(ctx, el, o, false);
      return true;
    case 'majlis-room':
      room(ctx, el, o, true);
      return true;
    case 'palm':
      palm(ctx, el, o);
      return true;
    case 'tree':
      tree(ctx, el, o);
      return true;
    case 'farm-bed':
      farmBed(ctx, el, o);
      return true;
    case 'greenhouse':
      greenhouse(ctx, el, o);
      return true;
    case 'pool':
      pool(ctx, el, o);
      return true;
  }
  return false;
}
