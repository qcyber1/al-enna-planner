import { SITE_HOST } from '../lib/brand';

const FONT = "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif";

/**
 * علامتنا على الصور المصدّرة: شارة صغيرة في الزاوية + اسم شفاف جداً في النص
 * (خفيفة وما تخرّب الصورة، بس تحفظ إن الشغل من مخطط العنة حتى لو قصّوا الزاوية)
 */
export function drawWatermark(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dark = false, izba = false) {
  const s = Math.max(0.6, Math.min(w, h) / 900);
  ctx.save();
  // ١) الاسم في النص — شفاف جداً ومايل
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-Math.PI / 9);
  ctx.globalAlpha = dark ? 0.07 : 0.055;
  ctx.fillStyle = dark ? '#ffffff' : '#3b2a1e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const mark = izba ? '🏡 i3enna للعزب • i3enna Izba' : '⛺ مخطط العنة • Al Enna Planner';
  ctx.font = `700 100px ${FONT}`;
  // حجم يناسب ~55% من عرض الصورة عشان ما يطلع برا
  const size = Math.max(14, Math.min(90, (100 * w * 0.55) / ctx.measureText(mark).width));
  ctx.font = `700 ${Math.round(size)}px ${FONT}`;
  ctx.fillText(mark, 0, 0);
  ctx.restore();

  // ٢) شارة الزاوية (تحت يسار)
  ctx.save();
  const text = izba ? `🏡 i3enna للعزب • ${SITE_HOST}` : `⛺ مخطط العنة • ${SITE_HOST}`;
  ctx.font = `600 ${Math.round(17 * s)}px ${FONT}`;
  ctx.direction = 'rtl';
  const tw = ctx.measureText(text).width;
  const pad = 10 * s;
  const bh = 30 * s;
  const bx = x + 14 * s;
  const by = y + h - bh - 14 * s;
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = dark ? 'rgba(20,14,8,0.6)' : 'rgba(255,250,240,0.8)';
  ctx.beginPath();
  ctx.roundRect(bx, by, tw + pad * 2, bh, bh / 2);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = dark ? '#ecc97f' : '#6b4a26';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + pad + tw / 2, by + bh / 2 + 1);
  ctx.restore();
}

/** نسخة من صورة (مثل لقطة 3D) مع العلامة */
export function withWatermark(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d');
  if (!ctx) return src;
  ctx.drawImage(src, 0, 0);
  drawWatermark(ctx, 0, 0, c.width, c.height, true);
  return c;
}
