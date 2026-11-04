import type { Plan, PlanElement } from '../types/plan';
import { validatePlan, type Issue } from './validation';
import { CATALOG_BY_KIND } from './catalog';
import { elementBounds } from './geometry';

export interface FixResult {
  id: string;
  name: string;
  patch: Partial<PlanElement>;
  moved: number;
}

const area = (e: PlanElement) => (e.points ? 1e6 : e.width * e.depth);
const rank = (e: PlanElement) => {
  // نحرك الأسهل: الأصغر، ومو الملعب ولا الخيام ولا الممرات
  const c = CATALOG_BY_KIND[e.kind]?.collision;
  let r = area(e);
  if (e.kind === 'volleyball') r += 1e5;
  if (e.tent) r += 5e4;
  if (c === 'path' || e.points) r += 1e6;
  return r;
};

/** أي عنصر نحرك عشان نحل التنبيه */
export function pickMover(plan: Plan, issue: Issue, preferId?: string): PlanElement | null {
  const els = issue.elementIds.map((id) => plan.elements.find((e) => e.id === id)).filter((e): e is PlanElement => !!e && !e.locked);
  if (!els.length) return null;
  // العنصر اللي المستخدم مختاره (غالباً اللي حطه توه) نحركه هو، إلا إذا كان ممر
  const pref = preferId ? els.find((e) => e.id === preferId && !e.points) : undefined;
  if (pref) return pref;
  if (issue.code === 'tent-entrance-blocked') return els.find((e) => e.id === issue.elementIds[1]) ?? null;
  if (issue.code === 'court-clearance') return els.find((e) => e.id === issue.elementIds[0]) ?? els[0];
  if (els.length === 1) return els[0];
  return [...els].sort((a, b) => rank(a) - rank(b))[0];
}

const shift = (e: PlanElement, dx: number, dy: number): Partial<PlanElement> =>
  e.points ? { points: e.points.map((p) => ({ x: Math.round((p.x + dx) * 1000) / 1000, y: Math.round((p.y + dy) * 1000) / 1000 })) } : { x: Math.round((e.x + dx) * 1000) / 1000, y: Math.round((e.y + dy) * 1000) / 1000 };

/** درجة سوء وضع العنصر: الأخطاء أثقل من التنبيهات */
function score(plan: Plan, id: string): number {
  let s = 0;
  for (const i of validatePlan(plan).issues) if (i.elementIds.includes(id)) s += i.severity === 'error' ? 10 : 1;
  return s;
}

/** يدوّر أقرب مكان (بخطوات نص متر بشكل حلزوني) ما فيه أي تنبيه للعنصر */
export function fixIssue(plan: Plan, issue: Issue, maxRadius = 25, preferId?: string): FixResult | null {
  const el = pickMover(plan, issue, preferId);
  if (!el) return null;
  const others = plan.elements.filter((e) => e.id !== el.id);
  const ob = others.map((o) => ({ o, b: elementBounds(o) }));
  const eb = elementBounds(el);
  // نفحص بس العناصر القريبة من المكان المقترح (أسرع بوايد) — 7 م تكفي لمنطقة أمان الملعب ومداخل الخيام
  const M = 7;
  const at = (dx: number, dy: number): Plan => {
    const near = ob.filter(({ b }) => b.minX < eb.maxX + dx + M && b.maxX > eb.minX + dx - M && b.minY < eb.maxY + dy + M && b.maxY > eb.minY + dy - M).map(({ o }) => o);
    return { ...plan, elements: [...near, { ...el, ...shift(el, dx, dy) }] };
  };
  const base = score(at(0, 0), el.id);
  if (base === 0) return null;
  let best = { s: base, dx: 0, dy: 0 };
  // حلقات حول المكان الحالي: نص متر قريب، وبعدين متر
  let budget = 2500;
  const rings: number[] = [];
  for (let d = 0.5; d <= Math.min(8, maxRadius); d += 0.5) rings.push(d);
  for (let d = 9; d <= maxRadius; d += 1) rings.push(d);
  for (const d of rings) {
    if (budget <= 0) break;
    const n = Math.max(8, Math.round((2 * Math.PI * d) / 0.5));
    let ringBest: { s: number; dx: number; dy: number } | null = null;
    for (let k = 0; k < n && budget > 0; k++, budget--) {
      const t = (k / n) * Math.PI * 2;
      const dx = Math.round(Math.cos(t) * d * 2) / 2;
      const dy = Math.round(Math.sin(t) * d * 2) / 2;
      const s = score(at(dx, dy), el.id);
      if (s < best.s) best = { s, dx, dy };
      if (s === 0 && (!ringBest || Math.hypot(dx, dy) < Math.hypot(ringBest.dx, ringBest.dy))) ringBest = { s, dx, dy };
    }
    if (ringBest) return { id: el.id, name: el.name, patch: shift(el, ringBest.dx, ringBest.dy), moved: Math.hypot(ringBest.dx, ringBest.dy) };
  }
  if (best.s < base) return { id: el.id, name: el.name, patch: shift(el, best.dx, best.dy), moved: Math.hypot(best.dx, best.dy) };
  return null;
}

/** يصلح كل اللي يقدر عليه، واحد ورا الثاني */
export function fixAll(plan: Plan): { plan: Plan; fixed: number; left: number } {
  let p = plan;
  let fixed = 0;
  const tried = new Set<string>();
  for (let pass = 0; pass < 30; pass++) {
    const issue = validatePlan(p).issues.find((i) => !tried.has(i.elementIds.join('|') + i.code));
    if (!issue) break;
    const f = fixIssue(p, issue);
    tried.add(issue.elementIds.join('|') + issue.code);
    if (!f) continue;
    p = { ...p, elements: p.elements.map((e) => (e.id === f.id ? { ...e, ...f.patch } : e)) };
    fixed++;
  }
  return { plan: p, fixed, left: validatePlan(p).issues.length };
}
