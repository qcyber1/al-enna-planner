// مولّد تصاميم العنة: يأخذ متطلبات المستخدم ويولّد عدة توزيعات مختلفة تلقائياً
import type { ElementKind, Land, Plan, PlanElement, Vec2 } from '../types/plan';
import { createElement, qiblaRotation } from './catalog';
import {
  add,
  convexIntersect,
  courtSafetyPolygon,
  dist,
  dot,
  entranceInfo,
  landPolygon,
  localToWorld,
  polygonInside,
  rectCorners,
  round,
  scale,
  segmentRects,
} from './geometry';
import { aimRotation } from './sample';
import { validatePlan } from './validation';

export interface GenInput {
  /** عدد الخيام الكلي (الأولى هي المجلس الرئيسي) */
  tents: number;
  sleepCabins: number;
  kitchenCabins: number;
  toilets: number;
  sinks: number;
  court: boolean;
  firePit: boolean;
  parking: number;
  prayer: boolean;
  kids: boolean;
  screen: boolean;
  bbq: boolean;
}

export const DEFAULT_GEN: GenInput = {
  tents: 3,
  sleepCabins: 1,
  kitchenCabins: 1,
  toilets: 2,
  sinks: 2,
  court: true,
  firePit: true,
  parking: 3,
  prayer: true,
  kids: false,
  screen: false,
  bbq: true,
};

export interface GenResult {
  title: string;
  description: string;
  plan: Plan;
  skipped: string[];
  issues: number;
}

type Anchor = { u: number; v: number };
type Group = 'majlis' | 'tents' | 'sleep' | 'kitchen' | 'toilets' | 'sinks' | 'court' | 'fire' | 'parking' | 'prayer' | 'kids' | 'screen' | 'bbq';

interface Strategy {
  title: string;
  description: string;
  anchors: Record<Group, Anchor>;
  /** نقطة الساحة التي تتجه لها مداخل الخيام */
  yard: Anchor;
  partition?: boolean;
}

// u: من -1 (يمين المدخل) إلى 1، v: من 0 (المدخل) إلى 1 (صدر العنة)
const STRATEGIES: Strategy[] = [
  {
    title: 'المجلس في الصدر',
    description: 'التوزيع الكلاسيكي: المجلس في صدر العنة مقابل المدخل، والخيام على الجوانب',
    yard: { u: 0, v: 0.5 },
    anchors: {
      majlis: { u: 0, v: 0.86 },
      tents: { u: -0.8, v: 0.6 },
      sleep: { u: -0.85, v: 0.9 },
      kitchen: { u: 0.85, v: 0.9 },
      toilets: { u: 0.88, v: 0.15 },
      sinks: { u: 0.75, v: 0.12 },
      court: { u: 0.55, v: 0.5 },
      fire: { u: -0.3, v: 0.55 },
      parking: { u: -0.65, v: 0.08 },
      prayer: { u: -0.4, v: 0.3 },
      kids: { u: 0.4, v: 0.25 },
      screen: { u: -0.3, v: 0.4 },
      bbq: { u: 0.7, v: 0.75 },
    },
  },
  {
    title: 'المجلس في الوسط',
    description: 'المجلس في منتصف العنة والخدمات موزعة على الأطراف، والملعب في الخلف',
    yard: { u: 0, v: 0.3 },
    anchors: {
      majlis: { u: 0, v: 0.5 },
      tents: { u: 0.8, v: 0.5 },
      sleep: { u: -0.85, v: 0.6 },
      kitchen: { u: 0.85, v: 0.88 },
      toilets: { u: -0.88, v: 0.15 },
      sinks: { u: -0.75, v: 0.12 },
      court: { u: 0, v: 0.88 },
      fire: { u: 0.35, v: 0.25 },
      parking: { u: 0.65, v: 0.08 },
      prayer: { u: -0.5, v: 0.85 },
      kids: { u: -0.45, v: 0.3 },
      screen: { u: 0.2, v: 0.25 },
      bbq: { u: 0.6, v: 0.3 },
    },
  },
  {
    title: 'الملعب قريب من المدخل',
    description: 'الملعب في الواجهة للشباب، والمجلس والخيام في الخلف بعيداً عن الحركة',
    yard: { u: -0.2, v: 0.65 },
    anchors: {
      majlis: { u: -0.35, v: 0.86 },
      tents: { u: 0.6, v: 0.85 },
      sleep: { u: 0.85, v: 0.6 },
      kitchen: { u: -0.88, v: 0.6 },
      toilets: { u: -0.88, v: 0.3 },
      sinks: { u: -0.75, v: 0.3 },
      court: { u: 0.4, v: 0.3 },
      fire: { u: -0.2, v: 0.62 },
      parking: { u: -0.65, v: 0.08 },
      prayer: { u: 0.5, v: 0.65 },
      kids: { u: -0.6, v: 0.45 },
      screen: { u: -0.1, v: 0.55 },
      bbq: { u: -0.75, v: 0.75 },
    },
  },
  {
    title: 'حرف U حول الضو',
    description: 'المجلس والخيام على شكل حرف U حول ساحة فيها الضو — جلسة سمر متكاملة',
    yard: { u: 0, v: 0.55 },
    anchors: {
      majlis: { u: 0, v: 0.88 },
      tents: { u: -0.85, v: 0.7 },
      sleep: { u: 0.85, v: 0.75 },
      kitchen: { u: 0.85, v: 0.4 },
      toilets: { u: 0.88, v: 0.12 },
      sinks: { u: 0.72, v: 0.12 },
      court: { u: -0.5, v: 0.25 },
      fire: { u: 0, v: 0.55 },
      parking: { u: 0.35, v: 0.08 },
      prayer: { u: -0.85, v: 0.4 },
      kids: { u: 0.45, v: 0.3 },
      screen: { u: 0, v: 0.42 },
      bbq: { u: 0.55, v: 0.6 },
    },
  },
  {
    title: 'مجلسين مع ساتر',
    description: 'مجلس رئيسي ومجلس للعائلة يفصل بينهما ساتر، والخدمات في زاوية مستقلة',
    yard: { u: 0, v: 0.45 },
    partition: true,
    anchors: {
      majlis: { u: -0.45, v: 0.85 },
      tents: { u: 0.5, v: 0.85 },
      sleep: { u: 0.85, v: 0.55 },
      kitchen: { u: 0.85, v: 0.3 },
      toilets: { u: 0.88, v: 0.1 },
      sinks: { u: 0.74, v: 0.1 },
      court: { u: -0.5, v: 0.35 },
      fire: { u: -0.45, v: 0.62 },
      parking: { u: 0.3, v: 0.08 },
      prayer: { u: 0.45, v: 0.6 },
      kids: { u: 0.45, v: 0.4 },
      screen: { u: -0.2, v: 0.6 },
      bbq: { u: 0.2, v: 0.55 },
    },
  },
];

interface Frame {
  E: Vec2;
  n: Vec2; // للداخل
  t: Vec2; // على طول ضلع المدخل
  uMid: number;
  uHalf: number;
  depth: number;
}

function frameOf(land: Land): Frame {
  const ent = entranceInfo(land);
  const poly = landPolygon(land);
  let uMin = Infinity;
  let uMax = -Infinity;
  let depth = 0;
  for (const p of poly) {
    const d = { x: p.x - ent.center.x, y: p.y - ent.center.y };
    uMin = Math.min(uMin, dot(d, ent.dir));
    uMax = Math.max(uMax, dot(d, ent.dir));
    depth = Math.max(depth, dot(d, ent.inward));
  }
  return { E: ent.center, n: ent.inward, t: ent.dir, uMid: (uMin + uMax) / 2, uHalf: (uMax - uMin) / 2, depth };
}

function at(f: Frame, a: Anchor): Vec2 {
  return add(add(f.E, scale(f.t, f.uMid + a.u * f.uHalf)), scale(f.n, a.v * f.depth));
}

/** تدوير العنصر بحيث يتجه مدخله نحو نقطة (مع التقريب لمحاور الأرض) */
function faceToward(from: Vec2, to: Vec2, f: Frame): number {
  const r = aimRotation(from, to);
  const base = aimRotation({ x: 0, y: 0 }, f.n) % 90;
  return ((Math.round((r - base) / 90) * 90 + base) % 360 + 360) % 360;
}

interface Placer {
  land: Vec2[];
  occupied: Vec2[][];
  els: PlanElement[];
}

function footprint(el: PlanElement, clearance: number): Vec2[] {
  if (el.kind === 'volleyball') {
    const m = (el.court?.safetyMargin ?? 0) + clearance * 0.3;
    return rectCorners(el.x, el.y, el.width + 2 * m, el.depth + 2 * m, el.rotation);
  }
  return rectCorners(el.x, el.y, el.width + 2 * clearance, el.depth + 2 * clearance, el.rotation);
}

function fits(P: Placer, el: PlanElement, clearance: number, inset: number): boolean {
  const fp = footprint(el, clearance);
  const body = el.kind === 'volleyball' ? courtSafetyPolygon(el) : rectCorners(el.x, el.y, el.width + 2 * inset, el.depth + 2 * inset, el.rotation);
  if (!polygonInside(body, P.land)) return false;
  for (const o of P.occupied) if (convexIntersect(fp, o, 0.01)) return false;
  return true;
}

/** يبحث عن أقرب مكان فارغ حول النقطة المفضلة (بحث حلزوني) */
function placeNear(P: Placer, el: PlanElement, want: Vec2, clearance = 1.2, maxR = 80): boolean {
  const step = 0.75;
  for (let r = 0; r <= maxR; r += step) {
    const n = r === 0 ? 1 : Math.max(8, Math.round((2 * Math.PI * r) / step));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      el.x = round(want.x + Math.cos(a) * r, 2);
      el.y = round(want.y + Math.sin(a) * r, 2);
      if (fits(P, el, clearance, 0.4)) {
        P.occupied.push(el.kind === 'volleyball' ? courtSafetyPolygon(el) : rectCorners(el.x, el.y, el.width, el.depth, el.rotation));
        P.els.push(el);
        return true;
      }
    }
  }
  return false;
}

function tentEntrance(el: PlanElement): Vec2 {
  return localToWorld(el, { x: el.tent?.entranceOffset ?? 0, y: el.depth / 2 + 0.05 });
}

function build(land: Land, input: GenInput, s: Strategy): GenResult {
  const f = frameOf(land);
  const big = Math.min(f.uHalf * 2, f.depth);
  const P: Placer = { land: landPolygon(land), occupied: [], els: [] };
  const skipped: string[] = [];
  const yard = at(f, s.yard);
  const mk = (kind: ElementKind, over: Partial<PlanElement> = {}) => createElement(kind, { x: 0, y: 0 }, over);
  const put = (el: PlanElement, g: Group, faceYard = false, clearance = 1.2) => {
    const want = at(f, s.anchors[g]);
    if (faceYard) el.rotation = faceToward(want, yard, f);
    else if (el.rotation === 0) el.rotation = faceToward(want, add(want, scale(f.n, -1)), f);
    if (!placeNear(P, el, want, clearance)) skipped.push(el.name);
    return el;
  };

  // حجز منطقة المدخل
  P.occupied.push(rectCorners(f.E.x + f.n.x * 2, f.E.y + f.n.y * 2, entranceInfo(land).width + 1, 4, aimRotation({ x: 0, y: 0 }, f.t) + 90));

  // 1) المجلس الرئيسي
  const mW = big >= 40 ? 12 : big >= 30 ? 10 : 8;
  const mD = big >= 40 ? 7 : big >= 30 ? 6.5 : 5.5;
  const majlis = mk('main-tent', { name: 'المجلس الرئيسي', width: mW, depth: mD });
  if (input.tents >= 1) {
    const want = at(f, s.anchors.majlis);
    majlis.rotation = faceToward(want, s.yard.v < s.anchors.majlis.v ? add(want, scale(f.n, -1)) : yard, f);
    if (!placeNear(P, majlis, want, 1.5)) skipped.push(majlis.name);
  }
  const hasMajlis = P.els.includes(majlis);

  // 2) الممر الرئيسي من المدخل إلى المجلس + حجزه
  let pathPts: Vec2[] = [];
  if (hasMajlis) {
    const M = tentEntrance(majlis);
    const rel = { x: M.x - f.E.x, y: M.y - f.E.y };
    const uM = dot(rel, f.t);
    const vM = dot(rel, f.n);
    const E0 = f.E;
    if (Math.abs(uM) < 0.6 || vM < 4) pathPts = [E0, add(E0, scale(f.n, Math.max(1, vM)))];
    else {
      const turnV = Math.max(2.5, vM - 3);
      const A = add(E0, scale(f.n, turnV));
      const B = add(A, scale(f.t, uM));
      pathPts = [E0, A, B, add(B, scale(f.n, vM - turnV))];
    }
    for (const r of segmentRects(pathPts, 3.4)) P.occupied.push(r);
  }

  // 3) الملعب
  if (input.court) {
    const court = mk('volleyball', { name: 'ملعب الطائرة' });
    const want = at(f, s.anchors.court);
    court.rotation = faceToward(want, add(want, scale(f.n, -1)), f);
    // جرّب الاتجاهين
    if (!placeNear(P, court, want, 0.3, 30)) {
      court.rotation = (court.rotation + 90) % 360;
      if (!placeNear(P, court, want, 0.3)) skipped.push('ملعب الطائرة (المساحة لا تكفي)');
    }
  }

  // 4) الخيام الإضافية
  for (let i = 1; i < input.tents; i++) {
    const family = s.partition && i === 1;
    const el = family
      ? mk('main-tent', { name: 'مجلس العائلة', width: Math.max(6, mW - 3), depth: Math.max(5, mD - 1), accent: '#2f5d3a' })
      : mk('small-tent', { name: `خيمة ${i}`, width: big >= 30 ? 4.5 : 3.5, depth: big >= 30 ? 4 : 3.5 });
    const want = family ? at(f, s.anchors.tents) : at(f, { u: s.anchors.tents.u, v: s.anchors.tents.v - ((i - 1) % 4) * 0.12 });
    el.rotation = faceToward(want, yard, f);
    if (!placeNear(P, el, want, 1.5)) skipped.push(el.name);
  }

  // 5) الساتر بين المجلسين
  if (s.partition && input.tents >= 2) {
    const a = at(f, { u: 0.02, v: 0.82 });
    const part = mk('partition', { name: 'ساتر', width: Math.min(10, f.depth * 0.3), rotation: (aimRotation({ x: 0, y: 0 }, f.t) + 90) % 360 });
    if (!placeNear(P, part, a, 0.6, 8)) skipped.push('الساتر');
  }

  // 6) الكبائن والخدمات
  for (let i = 0; i < input.sleepCabins; i++) put(mk('sleep-cabin', { name: `رقدة ${i + 1}` }), 'sleep', true);
  for (let i = 0; i < input.kitchenCabins; i++) put(mk('kitchen-cabin', { name: `مطبخ ${i + 1}` }), 'kitchen', true);
  for (let i = 0; i < input.toilets; i++) put(mk('toilet', { name: `حمام ${i + 1}` }), 'toilets', true, 0.35);
  for (let i = 0; i < input.sinks; i++) put(mk('sink', { name: `مغسلة ${i + 1}` }), 'sinks', true, 0.4);

  // 7) الجلسات والإضافات
  if (input.firePit) put(mk('fire-pit', { name: 'الضو' }), 'fire', false, 1.5);
  if (input.bbq) put(mk('bbq', { name: 'منطقة الشواء' }), 'bbq', true, 1);
  if (input.screen) {
    const sc = mk('screen', { name: 'شاشة المباريات' });
    const want = at(f, s.anchors.screen);
    sc.rotation = faceToward(want, hasMajlis ? { x: majlis.x, y: majlis.y } : yard, f);
    if (!placeNear(P, sc, want, 1.5)) skipped.push(sc.name);
  }
  if (input.prayer) {
    const pr = mk('prayer-area', { name: 'المصلّى', rotation: qiblaRotation(land.northAngle) });
    if (!placeNear(P, pr, at(f, s.anchors.prayer), 1)) skipped.push(pr.name);
  }
  if (input.kids) put(mk('kids-area', { name: 'ألعاب الأطفال' }), 'kids', true, 1.2);
  if (input.parking > 0) {
    const slots = Math.min(12, input.parking);
    put(mk('parking', { name: 'المواقف', width: round(slots * 2.7, 2), parking: { slots, showCars: true } }), 'parking', false, 0.8);
  }

  const els = [...P.els];

  // 8) الممر والإنارة
  if (pathPts.length >= 2) {
    els.push(
      createElement('path', pathPts[0], {
        name: 'الممر الرئيسي',
        points: pathPts.map((p) => ({ x: round(p.x, 2), y: round(p.y, 2) })),
        path: { material: 'turf', width: 2.4, edgeLights: true, edgeLightSpacing: 3 },
      }),
    );
  }
  const ent = entranceInfo(land);
  for (const s2 of [-1, 1]) {
    const p = add(add(ent.center, scale(ent.dir, s2 * (ent.width / 2 + 0.4))), scale(ent.inward, 0.5));
    els.push(createElement('entrance-light', p, { name: 'إنارة المدخل' }));
  }
  if (hasMajlis) {
    // سلسلة ليتات أمام المجلس بين عمودين
    const L = localToWorld(majlis, { x: -majlis.width / 2 - 0.6, y: majlis.depth / 2 + 1.5 });
    const R = localToWorld(majlis, { x: majlis.width / 2 + 0.6, y: majlis.depth / 2 + 1.5 });
    const poles: Vec2[] = [];
    for (const p of [L, R]) {
      const pole = createElement('light-pole', p, { name: 'عمود إنارة' });
      if (fits(P, pole, 0.2, 0)) {
        P.occupied.push(rectCorners(pole.x, pole.y, pole.width, pole.depth, 0));
        els.push(pole);
        poles.push(p);
      }
    }
    if (poles.length === 2) {
      els.push(
        createElement('string-lights', poles[0], {
          name: 'ليتات أمام المجلس',
          points: poles.map((p) => ({ x: round(p.x, 2), y: round(p.y, 2) })),
          height: 3.6,
          light: { on: true, intensity: 100, watts: 1, color: 'warm', mountHeight: 3.6, tilt: 90, beam: 360 },
        }),
      );
    }
  }
  // أعمدة على طول الممر
  if (pathPts.length >= 2) {
    let k = 0;
    for (let i = 1; i < pathPts.length; i++) {
      const a = pathPts[i - 1];
      const b = pathPts[i];
      const L = dist(a, b);
      const dir = { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
      const nrm = { x: -dir.y, y: dir.x };
      for (let s3 = 6; s3 < L - 3; s3 += 10) {
        const p = add(add(a, scale(dir, s3)), scale(nrm, (k++ % 2 ? 1 : -1) * 2.3));
        const pole = createElement('light-pole', p, { name: 'عمود إنارة' });
        if (fits(P, pole, 0.3, 0)) {
          P.occupied.push(rectCorners(pole.x, pole.y, pole.width, pole.depth, 0));
          els.push(pole);
        }
      }
    }
  }
  // كشافات الملعب
  const court = els.find((e) => e.kind === 'volleyball');
  if (court?.court) {
    const m = court.court.safetyMargin + 0.4;
    for (const [lx, ly] of [
      [-court.width / 2 + 2, -(court.depth / 2 + m)],
      [court.width / 2 - 2, -(court.depth / 2 + m)],
      [-court.width / 2 + 2, court.depth / 2 + m],
      [court.width / 2 - 2, court.depth / 2 + m],
    ]) {
      const p = localToWorld(court, { x: lx, y: ly });
      const fl = createElement('flood-light', p, { name: 'كشاف الملعب', rotation: aimRotation(p, { x: court.x, y: court.y }) });
      if (fits(P, fl, 0.1, 0)) {
        P.occupied.push(rectCorners(fl.x, fl.y, fl.width, fl.depth, 0));
        els.push(fl);
      }
    }
  }

  const plan: Plan = { land: JSON.parse(JSON.stringify(land)) as Land, elements: els, measurements: [] };
  return { title: s.title, description: s.description, plan, skipped, issues: validatePlan(plan).issues.length };
}

/** يولّد عدة أفكار توزيع مختلفة لنفس المتطلبات */
export function generateDesigns(land: Land, input: GenInput): GenResult[] {
  return STRATEGIES.map((s) => build(land, input, s));
}
