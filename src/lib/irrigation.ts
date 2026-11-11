// شبكة الري بالتنقيط للعزبة: من الخزان لكل نخلة وشجرة وحوض زراعة وحشيش
// خط رئيسي (أقصر شبكة توصل الكل) + خطوط فرعية + نقاطات/رشاشات ← المضخة، وقت الري، والمحابس (الزونات)
// أرقام تقريبية لصيف قطر للتخطيط فقط.
import type { Plan, PlanElement, Vec2 } from '../types/plan';

export const IRR = {
  /** نقاطات لكل نخلة (4 × 8 لتر/ساعة) */
  palmDrippers: 4,
  treeDrippers: 2,
  dripperLph: 8,
  /** خط تنقيط كل نص متر في الأحواض، وكل متر في البيت المحمي */
  bedRowGap: 0.5,
  greenhouseRowGap: 1,
  /** نقاط على خط التنقيط كل 30 سم، كل وحدة 2 لتر/ساعة */
  tapeSpacing: 0.3,
  tapeLph: 2,
  /** حلقة حول النخلة/الشجرة (م) */
  palmRing: 4,
  treeRing: 2.5,
  /** رشاش حشيش يغطي ~12 م² ويصرف ~600 لتر/ساعة */
  sprinklerM2: 12,
  sprinklerLph: 600,
  /** أقصى تدفق للزون الواحد (لتر/ساعة) — أكثر من كذا نقسم بمحابس */
  zoneMaxLph: 3000,
  /** ماي يومي بالصيف (لتر) */
  palmL: 200,
  treeL: 60,
  plantL_m2: 6,
  turfL_m2: 8,
} as const;

export interface Irrigation {
  hasTank: boolean;
  palms: number;
  trees: number;
  bedM2: number;
  turfM2: number;
  mainM: number;
  lateralM: number;
  drippers: number;
  sprinklers: number;
  flowLph: number;
  dailyL: number;
  zones: number;
  minutesPerDay: number;
  pumpHp: number;
}

const center = (e: PlanElement): Vec2 => ({ x: e.x, y: e.y });
const d = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/** طول أقصر شبكة توصل كل النقاط (Prim) */
export function mstLength(pts: Vec2[]): number {
  if (pts.length < 2) return 0;
  const inTree = new Array(pts.length).fill(false);
  const best = new Array(pts.length).fill(Infinity);
  best[0] = 0;
  let total = 0;
  for (let k = 0; k < pts.length; k++) {
    let u = -1;
    for (let i = 0; i < pts.length; i++) if (!inTree[i] && (u < 0 || best[i] < best[u])) u = i;
    inTree[u] = true;
    total += best[u];
    for (let v = 0; v < pts.length; v++) if (!inTree[v]) best[v] = Math.min(best[v], d(pts[u], pts[v]));
  }
  return total;
}

export function izbaIrrigation(plan: Plan): Irrigation {
  const els = plan.elements;
  const tanks = els.filter((e) => e.kind === 'water-tank');
  const palms = els.filter((e) => e.kind === 'palm');
  const trees = els.filter((e) => e.kind === 'tree');
  const beds = els.filter((e) => e.kind === 'farm-bed');
  const houses = els.filter((e) => e.kind === 'greenhouse');
  const turf = els.filter((e) => e.kind === 'path' && e.path?.material === 'turf');

  const bedM2 = [...beds, ...houses].reduce((t, e) => t + e.width * e.depth, 0);
  const turfM2 = turf.reduce((t, e) => {
    const c = e.path?.circle;
    if (c?.filled) return t + Math.PI * c.r * c.r;
    // ممر حشيش: الطول × العرض
    const pts = e.points ?? [];
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += d(pts[i - 1], pts[i]);
    return t + len * (e.path?.width ?? 1);
  }, 0);

  // خطوط التنقيط داخل الأحواض والبيوت المحمية (بطول الضلع الأطول)
  const tape = (e: PlanElement, gap: number) => Math.floor(Math.min(e.width, e.depth) / gap) * Math.max(e.width, e.depth);
  const tapeM = beds.reduce((t, e) => t + tape(e, IRR.bedRowGap), 0) + houses.reduce((t, e) => t + tape(e, IRR.greenhouseRowGap), 0);
  const lateralM = Math.round(tapeM + palms.length * IRR.palmRing + trees.length * IRR.treeRing);

  // الخط الرئيسي: من الخزان لكل الأهداف (+15% للالتفاف)
  const targets = [...palms, ...trees, ...beds, ...houses, ...turf].map(center);
  const src = tanks[0] ? center(tanks[0]) : targets[0];
  const mainM = targets.length ? Math.round(mstLength([src, ...targets]) * 1.15) : 0;

  const drippers = palms.length * IRR.palmDrippers + trees.length * IRR.treeDrippers;
  const tapeEmitters = Math.round(tapeM / IRR.tapeSpacing);
  const sprinklers = Math.ceil(turfM2 / IRR.sprinklerM2);
  const flowLph = drippers * IRR.dripperLph + tapeEmitters * IRR.tapeLph + sprinklers * IRR.sprinklerLph;
  const dailyL = Math.round(palms.length * IRR.palmL + trees.length * IRR.treeL + bedM2 * IRR.plantL_m2 + turfM2 * IRR.turfL_m2);
  const zones = flowLph ? Math.max(1, Math.ceil(flowLph / IRR.zoneMaxLph)) : 0;
  // وقت الري: كل زون يشتغل لحاله
  const minutesPerDay = flowLph ? Math.round((dailyL / (flowLph / zones)) * 60) : 0;
  // المضخة: تدفق زون واحد على ضغط ~2.5 بار، كفاءة 50%
  const zoneQ = flowLph / Math.max(1, zones) / 3600 / 1000; // م³/ث
  const kw = (zoneQ * 2.5e5) / 0.5 / 1000;
  const hp = kw / 0.746;
  const pumpHp = flowLph ? ([0.5, 0.75, 1, 1.5, 2, 3, 5].find((h) => h >= hp * 1.3) ?? 5) : 0;

  return { hasTank: tanks.length > 0, palms: palms.length, trees: trees.length, bedM2: Math.round(bedM2), turfM2: Math.round(turfM2), mainM, lateralM, drippers: drippers + tapeEmitters, sprinklers, flowLph: Math.round(flowLph), dailyL, zones, minutesPerDay, pumpHp };
}
