// رسم ما يحيط بالعنة (بحر، طعوس، حزم) في المسقط العلوي
import type { Land } from '../types/plan';
import { add, landEdges, lerp, scale } from '../lib/geometry';
import { FONT, type DrawOpts } from './draw';

export function drawSurroundings(ctx: CanvasRenderingContext2D, land: Land, o: DrawOpts) {
  const kinds = land.surroundings;
  if (!kinds?.some((k) => k && k !== 'open')) return;
  const edges = landEdges(land);
  edges.forEach((e, i) => {
    const kind = kinds[i] ?? 'open';
    if (kind === 'open') return;
    const out = scale(e.inward, -1);
    const gap = kind === 'sea' ? 6 : 4;
    const depth = kind === 'sea' ? 40 : 14;
    const ext = 30;
    const a0 = add(add(e.a, scale(e.dir, -ext)), scale(out, gap));
    const b0 = add(add(e.b, scale(e.dir, ext)), scale(out, gap));
    const a1 = add(a0, scale(out, depth));
    const b1 = add(b0, scale(out, depth));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a0.x, a0.y);
    ctx.lineTo(b0.x, b0.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.lineTo(a1.x, a1.y);
    ctx.closePath();
    if (kind === 'sea') {
      const g = ctx.createLinearGradient(a0.x, a0.y, a1.x, a1.y);
      g.addColorStop(0, '#7fc7cf');
      g.addColorStop(0.25, '#3f9bb0');
      g.addColorStop(1, '#1f5f80');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = Math.max(0.08, 1.2 / o.ppm);
      for (let d = 1.5; d < depth; d += 3) {
        ctx.beginPath();
        const n = 24;
        for (let k = 0; k <= n; k++) {
          const p = add(lerp(a0, b0, k / n), scale(out, d + Math.sin(k * 1.3 + d) * 0.4));
          if (k) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        }
        ctx.stroke();
      }
    } else if (kind === 'dunes') {
      ctx.fillStyle = '#e6c58a';
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = 'rgba(160,110,50,0.35)';
      ctx.lineWidth = Math.max(0.1, 1.5 / o.ppm);
      for (let k = 0; k < 9; k++) {
        const c = add(lerp(a0, b0, (k + 0.5) / 9), scale(out, depth * (0.35 + ((k * 37) % 5) / 12)));
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 6, 3, Math.atan2(e.dir.y, e.dir.x), Math.PI * 0.9, Math.PI * 2.1);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#b9a07c';
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = 'rgba(95,75,50,0.35)';
      for (let k = 0; k < 40; k++) {
        const c = add(lerp(a0, b0, ((k * 0.618) % 1)), scale(out, ((k * 0.377) % 1) * depth));
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 1.4 + (k % 3), 0.8 + (k % 2), k, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    // التسمية
    const mid = add(lerp(e.a, e.b, 0.5), scale(out, gap + Math.min(depth, 14) / 2));
    const lbl = kind === 'sea' ? '🌊 بحر' : kind === 'dunes' ? 'طعوس' : 'حزم';
    ctx.save();
    ctx.font = `700 ${14 / o.ppm}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = kind === 'sea' ? '#ffffff' : '#5b3a1e';
    ctx.fillText(lbl, mid.x, mid.y);
    ctx.restore();
  });
}
