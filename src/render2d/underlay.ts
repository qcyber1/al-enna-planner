// صورة الكروكي تحت المخطط (شفافة) — تنرسم في طبقة الخلفية فوق رمل الأرض وتحت الشبكة والعناصر
import type { Underlay } from '../types/plan';

const cache = new Map<string, HTMLImageElement>();

export function drawUnderlay(ctx: CanvasRenderingContext2D, u: Underlay, onLoad: () => void) {
  let img = cache.get(u.src);
  if (!img) {
    img = new Image();
    img.onload = onLoad;
    img.src = u.src;
    cache.set(u.src, img);
  }
  if (!img.complete || !img.naturalWidth) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1, u.opacity));
  ctx.drawImage(img, u.x, u.y, img.naturalWidth * u.scale, img.naturalHeight * u.scale);
  ctx.restore();
}
