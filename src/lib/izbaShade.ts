// «☀️ وين الظل؟»: ظل الحلال وقت الصيف — كل حظيرة فيها ظل يكفي كم راس، وإصلاح بضغطة (مظلة بالمقاس الناقص)
// القاعدة التقريبية لصيف قطر: الغنم ~1.2 م² ظل للراس، والإبل ~4 م² للراس. الحظيرة فيها مظلة خلفية (40% من العمق، 5 م بالكثير)
import type { Plan, PlanElement } from '../types/plan';
import { RATES } from './izbaInsights';
import { createElement } from './catalog';
import { closedArea, localToWorld } from './geometry';

export const SHADE_PER_HEAD = { sheep: 1.2, camel: 4 } as const;

export interface PenShade {
  id: string;
  name: string;
  kind: 'sheep' | 'camel';
  heads: number;
  shadeM2: number;
  shadedHeads: number;
  ok: boolean;
  /** كم م² ظل ناقص */
  missingM2: number;
}

/** الظل المدمج في الحظيرة (المظلة الخلفية) — نفس رسمة المجسم */
const builtIn = (e: PlanElement) => Math.max(0, e.width - 0.2) * Math.min(e.depth * 0.4, 5);

/** تقاطع تقريبي بين مستطيلين (بالصناديق المحيطة — كفاية للتخطيط) */
function overlap(a: PlanElement, b: PlanElement): number {
  const box = (e: PlanElement) => {
    const r = (e.rotation * Math.PI) / 180;
    const hx = (Math.abs(Math.cos(r)) * e.width + Math.abs(Math.sin(r)) * e.depth) / 2;
    const hy = (Math.abs(Math.sin(r)) * e.width + Math.abs(Math.cos(r)) * e.depth) / 2;
    return { x0: e.x - hx, x1: e.x + hx, y0: e.y - hy, y1: e.y + hy };
  };
  const p = box(a);
  const q = box(b);
  return Math.max(0, Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0)) * Math.max(0, Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0));
}

export function penShade(plan: Plan): PenShade[] {
  const shades = plan.elements.filter((e) => e.kind === 'animal-shade');
  const out: PenShade[] = [];
  for (const e of plan.elements) {
    if (e.kind !== 'sheep-pen' && e.kind !== 'camel-pen') continue;
    const kind = e.kind === 'sheep-pen' ? 'sheep' : 'camel';
    const heads = Math.floor((e.width * e.depth) / (kind === 'sheep' ? RATES.sheepM2 : RATES.camelM2));
    const shadeM2 = builtIn(e) + shades.reduce((t, s) => t + overlap(e, s), 0);
    const shadedHeads = Math.floor(shadeM2 / SHADE_PER_HEAD[kind]);
    const need = heads * SHADE_PER_HEAD[kind];
    out.push({ id: e.id, name: e.name, kind, heads, shadeM2: Math.round(shadeM2), shadedHeads: Math.min(heads, shadedHeads), ok: shadedHeads >= heads, missingM2: Math.max(0, Math.round(need - shadeM2)) });
  }
  // الحوش المرسوم بالشبك: ما فيه ظل إلا المظلات اللي داخله
  for (const e of plan.elements) {
    if (e.kind !== 'pen-fence') continue;
    const area = closedArea(e.points);
    if (!area) continue;
    const heads = Math.floor(area / RATES.sheepM2);
    const pts = e.points ?? [];
    const inside = shades.filter((s) => pointInPoly(s.x, s.y, pts));
    const shadeM2 = inside.reduce((t, s) => t + s.width * s.depth, 0);
    const shadedHeads = Math.floor(shadeM2 / SHADE_PER_HEAD.sheep);
    out.push({ id: e.id, name: e.name, kind: 'sheep', heads, shadeM2: Math.round(shadeM2), shadedHeads: Math.min(heads, shadedHeads), ok: shadedHeads >= heads, missingM2: Math.max(0, Math.round(heads * SHADE_PER_HEAD.sheep - shadeM2)) });
  }
  return out;
}

function pointInPoly(x: number, y: number, p: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if (p[i].y > y !== p[j].y > y && x < ((p[j].x - p[i].x) * (y - p[i].y)) / (p[j].y - p[i].y) + p[i].x) inside = !inside;
  }
  return inside;
}

/** مظلة حلال بالمقاس الناقص داخل الحظيرة (قدام المظلة الخلفية) */
export function shadeFix(plan: Plan, penId: string): PlanElement | null {
  const pen = plan.elements.find((e) => e.id === penId);
  const info = penShade(plan).find((p) => p.id === penId);
  if (!pen || !info || info.ok || pen.kind === 'pen-fence') return null;
  const w = Math.max(2, pen.width - 0.6);
  const sd = Math.min(pen.depth * 0.4, 5);
  const free = Math.max(1, pen.depth - sd - 0.6);
  const d = Math.min(free, Math.max(2, Math.ceil((info.missingM2 / w) * 2) / 2));
  const c = localToWorld(pen, { x: 0, y: -pen.depth / 2 + sd + d / 2 + 0.1 });
  return createElement('animal-shade', { x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100 }, { width: Math.round(w * 2) / 2, depth: d, rotation: pen.rotation, name: `مظلة ${pen.name}`.slice(0, 60) });
}
