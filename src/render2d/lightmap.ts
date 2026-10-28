import type { Plan } from '../types/plan';
import { landBounds, landPolygon } from '../lib/geometry';
import { collectEmitters, computeLightGrid, luxColor, type LightGrid } from '../lib/lighting';

const cache = new WeakMap<Plan, { grid: LightGrid; canvas: HTMLCanvasElement }>();

/** يحسب خريطة الإضاءة التقديرية ويحوّلها إلى صورة (مع تخزين مؤقت لكل نسخة من المخطط) */
export function lightMapImage(plan: Plan): { grid: LightGrid; canvas: HTMLCanvasElement } {
  const hit = cache.get(plan);
  if (hit) return hit;
  const b = landBounds(plan.land);
  const pad = 4;
  const area = (b.maxX - b.minX + 2 * pad) * (b.maxY - b.minY + 2 * pad);
  const cell = Math.max(0.25, Math.sqrt(area / 30000));
  const grid = computeLightGrid(b.minX - pad, b.minY - pad, b.maxX + pad, b.maxY + pad, collectEmitters(plan), cell);
  const canvas = document.createElement('canvas');
  canvas.width = grid.cols;
  canvas.height = grid.rows;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(grid.cols, grid.rows);
    for (let i = 0; i < grid.values.length; i++) {
      const [r, g, bl] = luxColor(grid.values[i]);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = bl;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  const res = { grid, canvas };
  cache.set(plan, res);
  return res;
}

export function drawLightMap(ctx: CanvasRenderingContext2D, plan: Plan, alpha = 0.78) {
  const { grid, canvas } = lightMapImage(plan);
  const poly = landPolygon(plan.land);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvas, grid.originX, grid.originY, grid.cols * grid.cell, grid.rows * grid.cell);
  ctx.restore();
}

/** نسبة المساحة المضاءة بشكل كافٍ داخل الأرض */
export function lightCoverage(plan: Plan, minLux = 5): number {
  const { grid } = lightMapImage(plan);
  const poly = landPolygon(plan.land);
  let inside = 0;
  let lit = 0;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const x = grid.originX + (c + 0.5) * grid.cell;
      const y = grid.originY + (r + 0.5) * grid.cell;
      if (!pointIn(x, y, poly)) continue;
      inside++;
      if (grid.values[r * grid.cols + c] >= minLux) lit++;
    }
  }
  return inside ? lit / inside : 0;
}

function pointIn(x: number, y: number, poly: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
