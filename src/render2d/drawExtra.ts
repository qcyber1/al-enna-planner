// رسم العناصر القطرية الإضافية في المسقط العلوي (إحداثيات محلية، المركز 0،0)
import type { PlanElement } from '../types/plan';
import { shade, withAlpha } from '../lib/color';
import { FONT, type DrawOpts } from './draw';

type Ctx = CanvasRenderingContext2D;
const px = (o: DrawOpts, n: number) => n / o.ppm;

function label(ctx: Ctx, s: string, x: number, y: number, o: DrawOpts, size = 11, color = '#2b1d12') {
  ctx.save();
  ctx.font = `700 ${px(o, size)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function outline(ctx: Ctx, w: number, d: number, o: DrawOpts) {
  if (!o.issue && !o.selected) return;
  ctx.save();
  ctx.strokeStyle = o.issue === 'error' ? '#d62828' : o.issue === 'warning' ? '#e09f1f' : '#1d6fd8';
  ctx.lineWidth = px(o, o.issue ? 3 : 2);
  if (o.issue) ctx.setLineDash([px(o, 7), px(o, 4)]);
  ctx.strokeRect(-w / 2 - px(o, 2), -d / 2 - px(o, 2), w + px(o, 4), d + px(o, 4));
  ctx.restore();
}

function cabin(ctx: Ctx, el: PlanElement, o: DrawOpts, kitchen: boolean) {
  const w = el.width;
  const d = el.depth;
  ctx.fillStyle = 'rgba(60,40,20,0.16)';
  ctx.fillRect(-w / 2 + 0.12, -d / 2 + 0.18, w, d);
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  ctx.strokeStyle = shade(el.color, -0.25);
  ctx.lineWidth = Math.max(px(o, 0.7), 0.02);
  for (let x = -w / 2 + 0.5; x < w / 2; x += 0.5) {
    ctx.beginPath();
    ctx.moveTo(x, -d / 2);
    ctx.lineTo(x, d / 2);
    ctx.stroke();
  }
  ctx.fillStyle = el.accent;
  ctx.fillRect(-w / 2 + 0.4, d / 2 - 0.12, Math.min(0.9, w * 0.25), 0.12);
  ctx.fillStyle = '#9fc3d8';
  ctx.fillRect(w * 0.05, d / 2 - 0.08, Math.min(1.2, w * 0.3), 0.08);
  if (kitchen) {
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(w / 2 - 0.6, -d / 4, Math.min(0.25, d * 0.12), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#cfd6da';
    ctx.fillRect(w / 2 - 0.9, -d / 2 + 0.25, 0.6, 0.4);
  }
  ctx.strokeStyle = shade(el.color, -0.5);
  ctx.lineWidth = Math.max(px(o, 1.2), 0.03);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  label(ctx, kitchen ? 'مطبخ' : 'رقدة', 0, 0, o, 11, shade(el.accent, -0.2));
  outline(ctx, w, d, o);
}

function firePit(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  const r = Math.min(w, d) / 2;
  // جلسة أرضية دائرية
  ctx.fillStyle = el.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, d / 2, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 0, w / 2 - Math.min(0.7, r * 0.35), d / 2 - Math.min(0.7, r * 0.35), 0, 0, Math.PI * 2);
  ctx.fill('evenodd');
  ctx.fillStyle = '#dccaa6';
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2 - Math.min(0.7, r * 0.35), d / 2 - Math.min(0.7, r * 0.35), 0, 0, Math.PI * 2);
  ctx.fill();
  // الموقد
  const fr = Math.min(0.55, r * 0.28);
  ctx.fillStyle = el.accent;
  ctx.beginPath();
  ctx.arc(0, 0, fr, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, fr * (o.night ? 2.6 : 0.9));
  g.addColorStop(0, '#ffd27a');
  g.addColorStop(0.5, '#ff7a1a');
  g.addColorStop(1, withAlpha('#ff7a1a', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, fr * (o.night ? 2.6 : 0.9), 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, w, d, o);
}

function prayer(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  // صفوف السجاد (متجهة لأعلى العنصر = القبلة)
  const rowD = 1.2;
  const colW = 0.8;
  ctx.strokeStyle = withAlpha('#f6e7c8', 0.6);
  ctx.lineWidth = Math.max(px(o, 0.8), 0.02);
  for (let y = -d / 2 + 0.2; y + rowD <= d / 2 + 0.01; y += rowD) {
    for (let x = -w / 2 + 0.1; x + colW <= w / 2 + 0.01; x += colW) {
      ctx.beginPath();
      ctx.moveTo(x + 0.05, y + rowD - 0.05);
      ctx.lineTo(x + 0.05, y + 0.35);
      ctx.quadraticCurveTo(x + colW / 2, y + 0.02, x + colW - 0.05, y + 0.35);
      ctx.lineTo(x + colW - 0.05, y + rowD - 0.05);
      ctx.stroke();
    }
  }
  // المحراب والسهم
  ctx.fillStyle = el.accent;
  ctx.beginPath();
  ctx.moveTo(-0.5, -d / 2);
  ctx.quadraticCurveTo(0, -d / 2 - 0.9, 0.5, -d / 2);
  ctx.closePath();
  ctx.fill();
  label(ctx, 'القبلة', 0, -d / 2 - 1.2, o, 10, shade(el.accent, -0.35));
  outline(ctx, w, d, o);
}

function screen(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  ctx.fillStyle = el.accent;
  ctx.fillRect(-w * 0.3, -d / 2, w * 0.6, d);
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -0.08, w, 0.16);
  // اتجاه العرض للأمام
  ctx.fillStyle = withAlpha('#7fb3ff', 0.18);
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0.08);
  ctx.lineTo(w / 2, 0.08);
  ctx.lineTo(w * 1.1, Math.max(4, w * 1.6));
  ctx.lineTo(-w * 1.1, Math.max(4, w * 1.6));
  ctx.closePath();
  ctx.fill();
  outline(ctx, w, d, o);
}

function kids(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  ctx.fillStyle = '#5aa36a';
  ctx.fillRect(-w / 2, -d / 2, w, d);
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2 + 0.4, -d / 2 + 0.4, 1.4, 1.4);
  ctx.fillStyle = el.accent;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 1.8, -d / 2 + 0.7);
  ctx.lineTo(-w / 2 + 1.8 + Math.min(2.5, w * 0.4), -d / 2 + 1.1);
  ctx.lineTo(-w / 2 + 1.8 + Math.min(2.5, w * 0.4), -d / 2 + 1.5);
  ctx.lineTo(-w / 2 + 1.8, -d / 2 + 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#444';
  ctx.lineWidth = Math.max(px(o, 1.5), 0.05);
  ctx.strokeRect(w / 2 - 2.6, d / 2 - 1.8, 2.2, 1.2);
  ctx.fillStyle = '#e05a47';
  ctx.fillRect(w / 2 - 2.2, d / 2 - 1.3, 0.4, 0.2);
  ctx.fillRect(w / 2 - 1.2, d / 2 - 1.3, 0.4, 0.2);
  ctx.strokeStyle = shade('#5aa36a', -0.3);
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  label(ctx, 'ألعاب', 0, d * 0.05, o, 11, '#fff');
  outline(ctx, w, d, o);
}

function partition(ctx: Ctx, el: PlanElement, o: DrawOpts) {
  const w = el.width;
  const d = el.depth;
  ctx.fillStyle = el.color;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  ctx.fillStyle = el.accent;
  const n = Math.max(1, Math.round(w / 2));
  for (let i = 0; i <= n; i++) ctx.fillRect(-w / 2 + (w / n) * i - 0.06, -d / 2 - 0.04, 0.12, d + 0.08);
  outline(ctx, w, d, o);
}

export function drawExtra(ctx: Ctx, el: PlanElement, o: DrawOpts): boolean {
  switch (el.kind) {
    case 'sleep-cabin':
      cabin(ctx, el, o, false);
      return true;
    case 'kitchen-cabin':
      cabin(ctx, el, o, true);
      return true;
    case 'fire-pit':
      firePit(ctx, el, o);
      return true;
    case 'prayer-area':
      prayer(ctx, el, o);
      return true;
    case 'screen':
      screen(ctx, el, o);
      return true;
    case 'kids-area':
      kids(ctx, el, o);
      return true;
    case 'partition':
      partition(ctx, el, o);
      return true;
  }
  return false;
}
