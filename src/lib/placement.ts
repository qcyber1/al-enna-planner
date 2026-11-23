// مكان فاضي للعناصر الجديدة (بدون تداخل وداخل الأرض) — يستخدمها «أضف حلالك» و«صمّم مجلسك» و«وصّف عزبتك»
import type { Plan, PlanElement, Vec2 } from '../types/plan';
import { createElement } from './catalog';
import { landBounds, rotate } from './geometry';
import { WIND_FROM } from './wind';

export type Box = { minX: number; minY: number; maxX: number; maxY: number };
const half = (e: { width: number; depth: number; rotation: number }) => {
  const r = (e.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { hx: (e.width * c + e.depth * s) / 2, hy: (e.width * s + e.depth * c) / 2 };
};
/** أقرب نقطة (بخطوات نص متر بشكل حلزوني) ما يتداخل فيها العنصر مع غيره وداخل حدود الأرض */
export function freeSpot(el: PlanElement, others: PlanElement[], land: Box): { x: number; y: number } {
  const me = half(el);
  const boxes = others.filter((o) => !o.points).map((o) => ({ ...half(o), x: o.x, y: o.y }));
  const ok = (x: number, y: number) =>
    x - me.hx >= land.minX && x + me.hx <= land.maxX && y - me.hy >= land.minY && y + me.hy <= land.maxY &&
    boxes.every((o) => Math.abs(x - o.x) >= me.hx + o.hx + 0.5 || Math.abs(y - o.y) >= me.hy + o.hy + 0.5);
  if (!Number.isFinite(land.minX) || ok(el.x, el.y)) return { x: el.x, y: el.y };
  for (let r = 1; r <= 120; r++) {
    for (let i = -r; i <= r; i++) {
      for (const [dx, dy] of [[i, -r], [i, r], [-r, i], [r, i]]) {
        const x = el.x + dx * 0.5;
        const y = el.y + dy * 0.5;
        if (ok(x, y)) return { x, y };
      }
    }
  }
  return { x: el.x, y: el.y };
}

/**
 * يحط مجموعة عناصر (حولها (0،0) = الزاوية العلوية اليسار) في أقرب مكان فاضي.
 * side: 'downwind' للحلال (تحت ريح الشمال)، 'upwind' للمجلس (فوق الريح بعيد عن الحلال)
 */
export function placeGroup(plan: Plan, g: { els: PlanElement[]; width: number; depth: number }, side: 'downwind' | 'upwind' | null = null, start?: Vec2): PlanElement[] {
  const b = landBounds(plan.land);
  let p = start ?? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  if (side) {
    const brg = ((WIND_FROM + (side === 'downwind' ? 180 : 0)) * Math.PI) / 180;
    const v = rotate({ x: Math.sin(brg), y: -Math.cos(brg) }, plan.land.northAngle);
    const cx0 = (b.minX + b.maxX) / 2;
    const cy0 = (b.minY + b.maxY) / 2;
    p = { x: cx0 + v.x * Math.max(0, (b.maxX - b.minX) / 2 - g.width / 2 - 2), y: cy0 + v.y * Math.max(0, (b.maxY - b.minY) / 2 - g.depth / 2 - 2) };
  }
  const probe = createElement('room', { x: Math.round(p.x), y: Math.round(p.y) }, { width: g.width, depth: g.depth });
  const spot = freeSpot(probe, plan.elements, b);
  const ox = Math.round((spot.x - g.width / 2) * 2) / 2;
  const oy = Math.round((spot.y - g.depth / 2) * 2) / 2;
  return g.els.map((e) => ({ ...e, x: e.x + ox, y: e.y + oy }));
}
