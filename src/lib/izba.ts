// العزبة: أراضي 50×50 (وحدة أو أكثر) وقوالب جاهزة حسب الاستخدام
// التوزيع يحترم ريح الشمال (من الشمال الغربي): المجلس فوق الريح، والحلال تحت الريح (جنوب شرق).
import type { ElementKind, Land, Plan, PlanElement } from '../types/plan';
import { createElement } from './catalog';
import { defaultLand, emptyPlan } from './sample';
import { circlePath } from './angleAssist';
import { validatePlan } from './validation';
import { izbaAccess } from './license';

export type IzbaUse = 'livestock' | 'rest' | 'farm' | 'mixed' | 'horses' | 'camels' | 'family';
export type IzbaPlots = 1 | 2 | 4;

export const IZBA_PLOT = 50;

export const IZBA_PLOT_OPTIONS: { n: IzbaPlots; label: string; size: string }[] = [
  { n: 1, label: 'أرض وحدة', size: '50 × 50' },
  { n: 2, label: 'أرضين', size: '100 × 50' },
  { n: 4, label: '4 أراضي', size: '100 × 100' },
];

export const IZBA_USES: { id: IzbaUse; icon: string; title: string; blurb: string }[] = [
  { id: 'mixed', icon: '🏡', title: 'عزبة متكاملة', blurb: 'مجلس وحلال وزراعة — الأكثر انتشاراً' },
  { id: 'livestock', icon: '🐑', title: 'عزبة حلال', blurb: 'حظاير غنم وإبل، مظلات، علف وغرفة عامل' },
  { id: 'rest', icon: '🏊', title: 'استراحة', blurb: 'مجلس، مسبح، حديقة ونخل، جلسات وشوي' },
  { id: 'farm', icon: '🌴', title: 'زراعة', blurb: 'نخل، أحواض خضرة، بيت محمي وخزان ماي' },
  { id: 'horses', icon: '🐎', title: 'عزبة خيل', blurb: 'إسطبلات، ميدان رمل للتمرين، علف وغرفة سايس' },
  { id: 'camels', icon: '🐪', title: 'عزبة هجن وإبل', blurb: 'حظاير إبل، مضمار تمرين، مشارب وعلف' },
  { id: 'family', icon: '👨‍👩‍👧', title: 'استراحة عائلية', blurb: 'مجلس رجال ومجلس نساء منفصل، مسبح وألعاب أطفال' },
];

export function isIzba(land: Pick<Land, 'site'> | undefined): boolean {
  return land?.site === 'izba';
}

export function izbaLand(plots: IzbaPlots = 1): Land {
  const l = defaultLand();
  const width = plots === 1 ? IZBA_PLOT : IZBA_PLOT * 2;
  const depth = plots === 4 ? IZBA_PLOT * 2 : IZBA_PLOT;
  return {
    ...l,
    site: 'izba',
    shape: width === depth ? 'square' : 'rectangle',
    width,
    depth,
    ground: 'soil',
    entrance: { edge: 2, offset: width / 2, width: 6 },
    fence: { enabled: true, type: 'block', height: 2.5, color: '#e3d6bd' },
  };
}

type Spec = [ElementKind, number, number, Partial<PlanElement>?];

/** حديقة حشيش دائرية */
function lawn(x: number, y: number, r: number): PlanElement {
  const g = circlePath({ x, y }, r, true, 2);
  const el = createElement('path', g.points[0], { points: g.points, name: 'حديقة' });
  el.path = { ...el.path!, material: 'turf', width: g.width, circle: { r, filled: true } };
  return el;
}

function build(land: Land, specs: Spec[], extra: PlanElement[] = []): Plan {
  const plan = emptyPlan(land);
  // الأرضيات (الممرات والحشيش) تحت باقي العناصر
  plan.elements = [...extra, ...specs.map(([k, x, y, o]) => createElement(k, { x, y }, o ?? {}))];
  return plan;
}

/** عدد أراضي 50×50 التقريبي لأرض موجودة */
export function plotsOf(land: Pick<Land, 'width' | 'depth'>): IzbaPlots {
  const big = Math.max(land.width, land.depth) >= 90;
  const both = Math.min(land.width, land.depth) >= 90;
  return both ? 4 : big ? 2 : 1;
}

/** قالب عزبة جاهز حسب الاستخدام وعدد الأراضي (ويحافظ على اتجاه الشمال لو عطيناه أرض المستخدم) */
export function buildIzba(use: IzbaUse, plots: IzbaPlots = 1, base?: Land): Plan {
  // أرض المستخدم (مستطيلة) نحافظ على مقاسها، وإلا مقاس الأراضي القياسي
  const rect = base && base.shape !== 'polygon' && base.width >= 30 && (base.shape === 'square' ? base.width : base.depth) >= 30;
  const std = izbaLand(plots);
  const W = rect ? base.width : std.width;
  const D = rect ? (base.shape === 'square' ? base.width : base.depth) : std.depth;
  const northAngle = base?.northAngle ?? 0;
  // التوزيع مصمم والشمال فوق؛ لو شمال الأرض بجهة ثانية ندوّر التوزيع بأقرب ربع دورة
  const k = ((Math.round(northAngle / 90) % 4) + 4) % 4;
  const [lw, ld] = k % 2 ? [D, W] : [W, D];
  const [specs, ground] = perimeterLayout(use, lw, ld);
  const plan = build({ ...std, width: W, depth: D, shape: W === D ? 'square' : 'rectangle', northAngle, surroundings: base?.surroundings, fence: rect ? base.fence : std.fence }, specs, ground);
  if (k) {
    const turn = (p: { x: number; y: number }) => {
      // دوران مع عقارب الساعة k مرات داخل الأرض
      let { x, y } = p;
      let w = lw;
      let d = ld;
      for (let i = 0; i < k; i++) {
        [x, y] = [d - y, x];
        [w, d] = [d, w];
      }
      return { x, y };
    };
    plan.elements = plan.elements.map((e) => {
      const c = turn(e);
      return { ...e, x: c.x, y: c.y, rotation: (e.rotation + 90 * k) % 360, ...(e.points ? { points: e.points.map(turn) } : {}) };
    });
  }
  // البوابة: التوزيع يفترض البوابة بالضلع الجنوبي (الأمامي قبل الدوران)
  const edge = (2 + k) % 4;
  const edgeLen = edge % 2 ? D : W;
  plan.land.entrance = { edge, offset: edgeLen / 2, width: 6 };
  return plan;
}

/**
 * التوزيع على السور (مثل صور مجمعات العزب من القمر الصناعي):
 * - المجلس والمباني على السور الغربي (فوق الريح)
 * - الحظاير والمظلات على السور الشرقي (تحت الريح)
 * - صف شجر على السور الشمالي (مصد ريح وغبار)
 * - الحوش مفتوح في النص، والمواقف جنب البوابة
 */
function perimeterLayout(use: IzbaUse, W: number, D: number): [Spec[], PlanElement[]] {
  const s: Spec[] = [];
  const ground: PlanElement[] = [];
  const big = W > 60;
  const tall = D > 60;
  const red = '#b8423a';
  const blue = '#2f5f9e';
  const livestock = use === 'livestock' || use === 'mixed';
  const farm = use === 'farm' || use === 'mixed';
  const family = use === 'family';
  const rest = use === 'rest' || family;
  const horses = use === 'horses';
  const camels = use === 'camels';

  // 1) صف شجر على السور الشمالي، مع فتحات للنخل
  for (let x = 4, i = 0; x <= W - 4 + 1e-6; x += big ? 7 : 6, i++) s.push([i % 2 && farm ? 'palm' : 'tree', x, 2.6]);

  // 2) المجلس على السور الغربي، بابه للحوش (شرق)
  const mw = rest || big ? 16 : 12;
  const my = 8 + mw / 2;
  s.push(['majlis-room', 4.5, my, { width: mw, depth: 7, rotation: 270, roof: rest ? undefined : red }]);
  s.push(['toilet', 2.2, my + mw / 2 + 2, { rotation: 270, name: 'حمام' }]);
  s.push(['worker-room', 3, my + mw / 2 + 6, { rotation: 270, roof: red }]);
  const yardX = 12;
  // جلسة خارجية قدام المجلس + ضو وشوي
  s.push(['canopy', yardX + 5, my - mw / 4 - 1, { name: 'جلسة خارجية', width: 6, depth: 5 }]);
  s.push(['majlis-rug', yardX + 5, my - mw / 4 - 1, { name: 'جلسة شعبية' }]);
  s.push(['fire-pit', yardX + 5, my + mw / 4 + 3]);
  s.push(['bbq', yardX + 12, my + mw / 4 + 3, { rotation: 180 }]);

  // 3) الخدمات بالزاوية الأمامية اليسار
  s.push(['water-tank', 3, D - 9]);
  s.push(['generator', 3.5, D - 4, { rotation: 90 }]);
  s.push(['parking', 11, D - 4, { width: (big ? 5 : 3) * 2.7, parking: { slots: big ? 5 : 3, showCars: true } }]);

  // 4) الحلال على السور الشرقي (ظهر المظلة على السور)
  if (livestock) {
    const x = W - 4.5;
    const top = tall ? D / 2 + 4 : 15;
    s.push(['feed-store', W - 2.5, top + 1, { rotation: 90, roof: blue }]);
    s.push(['trough', W - 9, top + 1, { rotation: 90, name: 'مشرب' }]);
    const yMax = big ? D - 17 : D - 0.5;
    // صف حظاير على السور، وصف ثاني قدامه في الأراضي الكبيرة
    const cols = big ? [x, x - 9] : [x];
    let n = 0;
    for (const cx of cols)
      for (let y = top + 11.5; y + 6 <= yMax && n < 8; y += 12.5) {
        n++;
        s.push(['sheep-pen', cx, y, { rotation: 90, name: `حظيرة غنم ${n}`, roof: blue }]);
      }
    if (big) {
      // إبل وخيل على السور الجنوبي جهة الشرق، بعيد عن البوابة
      s.push(['camel-pen', W - 12, D - 8, { name: 'حظيرة إبل', roof: blue }]);
      if (use === 'livestock') s.push(['horse-stable', W - 32, D - 3, { name: 'إسطبل خيل', roof: red, rotation: 180 }]);
    }
  }

  // 4ب) الخيل: إسطبلات على السور الشرقي + علف ومشرب
  if (horses) {
    s.push(['feed-store', W - 2.5, 7, { rotation: 90, roof: blue }]);
    s.push(['trough', W - 9, 7, { rotation: 90, name: 'مشرب الخيل' }]);
    const cols = big ? [W - 3, W - 12] : [W - 3];
    let n = 0;
    for (const cx of cols)
      for (let y = 19; y + 7 <= D - (big ? 12 : 1); y += 16) {
        n++;
        s.push(['horse-stable', cx, y, { rotation: 90, name: `إسطبل ${n}`, roof: red }]);
      }
  }
  // 4ج) الهجن: حظاير إبل على السور الشرقي
  if (camels) {
    s.push(['feed-store', W - 2.5, 7, { rotation: 90, roof: blue }]);
    s.push(['trough', W - 9, 7, { rotation: 90, name: 'مشرب' }]);
    const cols = big ? [W - 8.5, W - 25] : [W - 8.5];
    let n = 0;
    for (const cx of cols)
      for (let y = 22; y + 10 <= D - (tall ? 1 : 0); y += 22) {
        n++;
        s.push(['camel-pen', cx, y, { rotation: 90, name: `حظيرة إبل ${n}`, roof: blue }]);
      }
  }
  // 4د) العائلية: مجلس النساء على السور الشرقي، بعيد عن مجلس الرجال، مع حمام وجلسة خاصة
  if (family) {
    const fw = big ? 14 : 12;
    const fy = 8 + fw / 2;
    s.push(['majlis-room', W - 4.5, fy, { width: fw, depth: 7, rotation: 90, name: 'مجلس النساء' }]);
    s.push(['toilet', W - 2.2, fy + fw / 2 + 2, { rotation: 90, name: 'حمام النساء' }]);
    s.push(['canopy', W - 16, fy - fw / 4 - 1, { name: 'جلسة النساء', width: 6, depth: 5 }]);
  }

  // 5) وسط الحوش حسب الاستخدام
  const cx0 = yardX + 18;
  const cx1 = livestock ? W - 16 : horses ? W - (big ? 17 : 8) : camels ? W - (big ? 35 : 18) : family ? W - 20 : W - 4;
  const mid = (cx0 + cx1) / 2;
  if (rest) {
    s.push(['pool', mid, D / 2 - 2, big ? { width: 12, depth: 6 } : {}]);
    s.push(['seating', mid, D / 2 + 5, { name: 'جلسة المسبح' }]);
    s.push(['kids-area', cx1 - 4, 12]);
    ground.push(lawn(mid - (big ? 14 : 0), D - 16, big ? 7 : 5));
    if (!family) for (let y = 12; y <= D - 12; y += 8) s.push(['palm', W - 3, y]);
    if (big && !family) s.push(['volleyball', cx1 - 12, tall ? D - 20 : D / 2]);
  }
  if (farm) {
    const fx0 = cx0;
    const fx1 = Math.min(cx1, fx0 + (big ? 50 : 14));
    const fy1 = livestock && !tall ? D / 2 - 3 : tall ? D / 2 - 6 : D - 30;
    for (let y = 9; y <= fy1 + 1e-6; y += 7) for (let x = fx0 + 2; x <= fx1 - 2 + 1e-6; x += 7) s.push(['palm', x, y]);
    if (big && !livestock) s.push(['greenhouse', fx1 + 8, 16, { width: 9, depth: 20 }]);
    if (use === 'farm') {
      s.push(['farm-bed', cx0 + 6, D - 16]);
      s.push(['farm-bed', cx0 + 6, D - 24]);
    }
  }

  // ميدان الخيل / مضمار الهجن: أرضية رمل في وسط الحوش
  if (horses || camels) {
    // الخيل: الميدان بين الممر الرئيسي والإسطبلات (قطره 16 م أو أكثر — مناسب للترويض)
    const hx0 = W / 2 + 2;
    const hx1 = W - (big ? 15 : 5);
    const span = horses ? Math.min(hx1 - hx0, D - 24) : Math.min(cx1 - cx0, D - 24);
    const r = Math.max(6, Math.min(horses ? 12 : 18, span / 2 - 0.5));
    const c = horses ? { x: (hx0 + hx1) / 2, y: D / 2 + 3 } : { x: (cx0 + cx1) / 2, y: D / 2 + 3 };
    const g = horses ? circlePath(c, r, true, 2) : circlePath(c, r, false, 3);
    const el = createElement('path', g.points[0], { points: g.points, name: horses ? 'ميدان الخيل' : 'مضمار تمرين الهجن' });
    el.path = { ...el.path!, material: 'sand', width: g.width, circle: { r, filled: horses } };
    ground.push(el);
  }

  // 6) الممر الرئيسي: من البوابة لين باب المجلس
  ground.push(
    createElement('path', { x: W / 2, y: my }, {
      name: 'الممر الرئيسي',
      points: [
        { x: W / 2, y: D - 1.3 },
        { x: W / 2, y: my + 0.5 },
        { x: 9.5, y: my + 0.5 },
      ],
      path: { material: 'tiles', width: 2.5, edgeLights: true, edgeLightSpacing: 4 },
    }),
  );
  return [s, ground];
}

/** العزبة منتج مستقل: مفتوحة لصاحب ترخيصها (أو تجربتها المجانية) — انظر lib/license.ts */
export function izbaEnabled(): boolean {
  return izbaAccess() === 'full';
}

/** أفكار «ولّد» للعزبة: الاستخدامات الأربعة على أرض المستخدم */
export function izbaIdeas(base: Land): { title: string; description: string; plan: Plan; issues: number; skipped: string[] }[] {
  const plots = plotsOf(base);
  // «وريني 4 أفكار»: الاستخدامات الأساسية (الخيل والهجن والعائلية من شاشة البداية)
  return IZBA_USES.filter((u) => ['mixed', 'livestock', 'rest', 'farm'].includes(u.id)).map((u) => {
    const plan = buildIzba(u.id, plots, base);
    return { title: u.title, description: u.blurb, plan, issues: validatePlan(plan).issues.length, skipped: [] };
  });
}
