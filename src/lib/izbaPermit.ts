// «📋 قبل الرخصة»: قياسات من المخطط تاخذها للمكتب الهندسي (مساحة المباني ونسبتها، أقرب مبنى وأقرب حظيرة للسور)
// ما نحط أرقام «مسموح / ممنوع» من عندنا — الاشتراطات تتحدث وتختلف حسب المنطقة، والمكتب الهندسي يعتمدها
import type { Plan, PlanElement, Vec2 } from '../types/plan';
import { landArea, landPolygon, rectCorners } from './geometry';

const BUILD = new Set(['room', 'majlis-room', 'worker-room', 'feed-store', 'horse-stable', 'storage', 'sleep-cabin', 'kitchen-cabin', 'toilet']);
const PENS = new Set(['sheep-pen', 'camel-pen', 'horse-stable', 'animal-shade']);

function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** أقرب مسافة من العنصر لحدود الأرض (م) */
export function distToBoundary(el: PlanElement, poly: Vec2[]): number {
  const cs = rectCorners(el.x, el.y, el.width, el.depth, el.rotation);
  let m = Infinity;
  for (const c of cs) for (let i = 0; i < poly.length; i++) m = Math.min(m, segDist(c, poly[i], poly[(i + 1) % poly.length]));
  return Math.round(m * 10) / 10;
}

export interface PermitFacts {
  builtArea: number;
  builtPct: number;
  buildings: number;
  closestBuilding: { name: string; m: number } | null;
  closestPen: { name: string; m: number } | null;
}

export function permitFacts(plan: Plan): PermitFacts {
  const poly = landPolygon(plan.land);
  const blds = plan.elements.filter((e) => BUILD.has(e.kind));
  const built = blds.reduce((t, e) => t + e.width * e.depth, 0);
  const near = (els: PlanElement[]) => els.map((e) => ({ name: e.name, m: distToBoundary(e, poly) })).sort((a, b) => a.m - b.m)[0] ?? null;
  // المباني الملاصقة لبعض (غرف مبنى واحد) تنحسب مبنى واحد تقريباً
  const groups: PlanElement[][] = [];
  for (const e of blds) {
    const g = groups.find((gr) => gr.some((o) => Math.abs(o.x - e.x) <= (o.width + e.width) / 2 + 0.3 && Math.abs(o.y - e.y) <= (o.depth + e.depth) / 2 + 0.3));
    if (g) g.push(e);
    else groups.push([e]);
  }
  return {
    builtArea: Math.round(built),
    builtPct: Math.round((built / Math.max(1, landArea(plan.land))) * 1000) / 10,
    buildings: groups.length,
    closestBuilding: near(blds.filter((e) => !PENS.has(e.kind))),
    closestPen: near(plan.elements.filter((e) => PENS.has(e.kind))),
  };
}

export const PERMIT_DOCS = [
  'سند ملكية الأرض أو عقد الانتفاع',
  'مخطط مساحي للأرض (الحدود والمساحة)',
  'مخططات هندسية معتمدة من مكتب هندسي مسجّل',
  'تقديم الطلب على نظام رخص البناء الإلكتروني (وزارة البلدية)',
  'موافقات الجهات (الكهرباء والماء والدفاع المدني) حسب المطلوب',
];
