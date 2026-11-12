import { isCourtKind } from './catalog';
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
  if (isCourtKind(e.kind)) r += 1e5;
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
  // الحلال هو اللي ينتقل، مو المجلس
  if (issue.code === 'livestock-wind') return els.find((e) => e.id === issue.elementIds[0]) ?? els[0];
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

interface Cand {
  el: PlanElement;
  patch: Partial<PlanElement>;
  moved: number;
  score: number;
  cost: number;
}

/** يدوّر لعنصر واحد أقرب مكان سليم (ومع دوران 90° إذا يساعد) */
function searchFor(plan: Plan, el: PlanElement, weight: number, maxRadius: number, costLimit: number): Cand | null {
  const others = plan.elements.filter((e) => e.id !== el.id);
  const ob = others.map((o) => ({ o, b: elementBounds(o) }));
  const M = 7;
  const variants: Partial<PlanElement>[] = [{}];
  if (!el.points && !el.tent && el.kind !== 'volleyball' && Math.abs(el.width - el.depth) > 0.3) variants.push({ rotation: (el.rotation + 90) % 360 });
  let best: Cand | null = null;
  for (const v of variants) {
    const base = { ...el, ...v };
    const eb = elementBounds(base);
    const rotCost = v.rotation !== undefined ? 3 : 0;
    const at = (dx: number, dy: number): Plan => {
      const near = ob.filter(({ b }) => b.minX < eb.maxX + dx + M && b.maxX > eb.minX + dx - M && b.minY < eb.maxY + dy + M && b.maxY > eb.minY + dy - M).map(({ o }) => o);
      return { ...plan, elements: [...near, { ...base, ...shift(base, dx, dy) }] };
    };
    const consider = (dx: number, dy: number) => {
      const sc = score(at(dx, dy), el.id);
      const moved = Math.hypot(dx, dy);
      const cost = (moved + rotCost) * weight + sc * 100;
      if (!best || cost < best.cost) best = { el, patch: { ...v, ...shift(base, dx, dy) }, moved, score: sc, cost };
      return sc;
    };
    if (v.rotation !== undefined && consider(0, 0) === 0) continue;
    let budget = 1800;
    const rings: number[] = [];
    for (let d = 0.5; d <= Math.min(8, maxRadius); d += 0.5) rings.push(d);
    for (let d = 9; d <= maxRadius; d += 1) rings.push(d);
    for (const d of rings) {
      // ما في داعي نكمل إذا أي مكان أبعد بيكون أسوأ من أحسن نتيجة عندنا
      const b = best as Cand | null;
      if (budget <= 0 || (b && b.score === 0 && (d + rotCost) * weight >= b.cost) || (d + rotCost) * weight > costLimit) break;
      const n = Math.max(8, Math.round((2 * Math.PI * d) / 0.5));
      let found = false;
      for (let k = 0; k < n && budget > 0; k++, budget--) {
        const t = (k / n) * Math.PI * 2;
        if (consider(Math.round(Math.cos(t) * d * 2) / 2, Math.round(Math.sin(t) * d * 2) / 2) === 0) found = true;
      }
      if (found) break;
    }
  }
  return best;
}

/**
 * أفضل تصليح: يجرّب يحرك أي عنصر من اللي في التنبيه (ويدوّره 90° إذا يفيد)،
 * ويختار أقل تحريك — الخيام والملعب «أثقل» من القطع الصغيرة، والعنصر المختار أخف.
 */
export function fixIssue(plan: Plan, issue: Issue, maxRadius = 25, preferId?: string): FixResult | null {
  const pick = pickMover(plan, issue, preferId);
  if (!pick) return null;
  const movers = issue.elementIds
    .map((id) => plan.elements.find((e) => e.id === id))
    .filter((e): e is PlanElement => !!e && !e.locked && !e.points);
  if (!movers.length) movers.push(pick);
  const before = score(plan, pick.id) + movers.reduce((a, m) => a + (m === pick ? 0 : score(plan, m.id)), 0);
  if (before === 0) return null;
  let best: Cand | null = null;
  for (const m of movers.sort((a, b) => (a.id === pick.id ? -1 : b.id === pick.id ? 1 : 0))) {
    // «ثقل» التحريك: الكبير أثقل، والملعب أثقل، واللي المستخدم مختاره (غالباً توه حاطه) أخف بوايد
    let w = 1 + Math.min(2, (m.width * m.depth) / 50);
    if (isCourtKind(m.kind)) w += 2;
    if (m.id === preferId) w *= 0.4;
    if (issue.code === 'tent-entrance-blocked' && m.id === issue.elementIds[0]) w *= 3; // نحرك اللي يسد المدخل مو الخيمة
    if (issue.code === 'livestock-wind' && m.id === issue.elementIds[1]) w *= 4; // نحرك الحلال مو المجلس
    const c = searchFor(plan, m, w, maxRadius, best ? best.cost : Infinity);
    if (c && (!best || c.cost < best.cost)) best = c;
  }
  if (!best || best.score >= score(plan, best.el.id)) return null;
  return { id: best.el.id, name: best.el.name, patch: best.patch, moved: best.moved };
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
