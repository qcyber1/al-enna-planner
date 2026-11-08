// العزبة: أراضي 50×50 (وحدة أو أكثر) وقوالب جاهزة حسب الاستخدام
// التوزيع يحترم ريح الشمال (من الشمال الغربي): المجلس فوق الريح، والحلال تحت الريح (جنوب شرق).
import type { ElementKind, Land, Plan, PlanElement } from '../types/plan';
import { createElement } from './catalog';
import { defaultLand, emptyPlan } from './sample';
import { circlePath } from './angleAssist';
import { validatePlan } from './validation';

export type IzbaUse = 'livestock' | 'rest' | 'farm' | 'mixed';
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

/** صف نخل على طول خط */
function palmRow(x0: number, x1: number, y: number, step = 7): Spec[] {
  const out: Spec[] = [];
  const n = Math.max(1, Math.floor((x1 - x0) / step));
  for (let i = 0; i <= n; i++) out.push(['palm', x0 + ((x1 - x0) * i) / n, y]);
  return out;
}

/** مجموعة المجلس فوق الريح (الشمال الغربي): مجلس، جلسة خارجية، شوي، حمام */
function majlisZone(x: number, y: number, big: boolean): Spec[] {
  return [
    ['majlis-room', x, y, big ? { width: 14, depth: 7 } : {}],
    ['canopy', x + (big ? 13 : 11), y + 1, { name: 'جلسة خارجية', width: 6, depth: 5 }],
    ['majlis-rug', x + (big ? 13 : 11), y + 1, { name: 'جلسة شعبية' }],
    ['fire-pit', x, y + 10],
    ['bbq', x + 7, y + 10, { rotation: 180 }],
    ['toilet', x - 6, y + 10, { name: 'حمام', rotation: 90 }],
  ];
}

/** الخدمات على الضلع الغربي: خزان ماي ومولد */
function services(y: number): Spec[] {
  return [
    ['water-tank', 3, y],
    ['generator', 3.5, y + 5, { rotation: 90 }],
  ];
}

function parking(x: number, D: number, slots = 4): Spec {
  return ['parking', x, D - 4, { width: slots * 2.7, parking: { slots, showCars: true } }];
}

/** منطقة الحلال تحت الريح (الجنوب الشرقي) داخل مستطيل x0..x1 / y0..y1 */
function livestockZone(x0: number, x1: number, y0: number, y1: number, rich: boolean, gateX = 0): Spec[] {
  const out: Spec[] = [];
  const w = x1 - x0;
  // غرفة العامل والعلف بأعلى المنطقة
  out.push(['worker-room', x0 + 3, y0 + 2.5]);
  out.push(['feed-store', x0 + 11, y0 + 3]);
  out.push(['water-tank', x0 + 17, y0 + 2.5, { name: 'خزان ماي الحلال' }]);
  // حظاير الغنم بالأسفل
  const pens = Math.max(1, Math.floor((w + 2) / 14));
  // ما نسد البوابة الرئيسية (منتصف الضلع الأمامي)
  const xs = Array.from({ length: pens }, (_, i) => x1 - 6.5 - i * 14).filter((x) => !gateX || Math.abs(x - gateX) > 6 + 4);
  xs.forEach((x, i) => out.push(['sheep-pen', x, y1 - 4.5, { name: `حظيرة غنم ${xs.length > 1 ? i + 1 : ''}`.trim() }]));
  if (rich) {
    out.push(['camel-pen', x1 - 10.5, y1 - 21, { name: 'حظيرة إبل' }]);
    out.push(['horse-stable', x0 + 8, y1 - 21, { name: 'إسطبل خيل', width: 14 }]);
  }
  return out;
}

function farmZone(x0: number, x1: number, y0: number, y1: number): Spec[] {
  const out: Spec[] = [];
  const w = x1 - x0;
  const h = y1 - y0;
  // صفوف نخل
  for (let y = y0 + 3; y <= y1 - 3 + 1e-6; y += 7) out.push(...palmRow(x0 + 3, x0 + Math.min(w, 22) - 3, y));
  if (w >= 34) {
    out.push(['greenhouse', x0 + w - 6.5, y0 + Math.min(h, 22) / 2, { width: 9, depth: Math.min(20, h - 2) }]);
    // أحواض الخضرة بين النخل والبيت المحمي إذا فيه مكان
    if (w >= 44) {
      out.push(['farm-bed', x0 + 27, y0 + 5]);
      if (h >= 18) out.push(['farm-bed', x0 + 27, y0 + 13]);
    }
  } else if (w >= 26) out.push(['farm-bed', x0 + w - 6, y0 + 5]);
  return out;
}

/** الممر الرئيسي: من البوابة لين قدام المجلس */
function mainPath(W: number, D: number, toX: number, atY: number): PlanElement {
  return createElement('path', { x: W / 2, y: atY }, {
    name: 'الممر الرئيسي',
    points: [
      { x: W / 2, y: D - 0.5 },
      { x: W / 2, y: atY },
      { x: toX, y: atY },
    ],
    path: { material: 'tiles', width: 3, edgeLights: true, edgeLightSpacing: 4 },
  });
}

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
  const land = { ...izbaLand(plots), ...(base ? { northAngle: base.northAngle, surroundings: base.surroundings } : {}) };
  const W = land.width;
  const D = land.depth;
  const big = plots > 1;
  const s: Spec[] = [];
  const ground: PlanElement[] = [];
  switch (use) {
    case 'livestock':
      s.push(['majlis-room', 12, 8, { width: 8, depth: 5 }], ['fire-pit', 12, 17], ['toilet', 3, 17, { rotation: 90 }]);
      s.push(...services(26));
      s.push(parking(W / 2 - 12, D, 3));
      s.push(...livestockZone(big ? W / 2 + 2 : 28, W - 1, big && D > 50 ? 28 : 18, D - 1, big, W / 2));
      ground.push(mainPath(W, D, 12, 12.5));
      if (D > 50) s.push(...farmZone(1, W / 2 - 4, 52, D - 12));
      else if (big) s.push(...farmZone(8, W / 2 - 4, 24, D - 10));
      break;
    case 'rest':
      s.push(...majlisZone(12, 8, big));
      s.push(['pool', big ? 40 : 30, 22, big ? { width: 12, depth: 6 } : {}]);
      s.push(['seating', big ? 40 : 30, 29, { name: 'جلسة المسبح' }]);
      s.push(['kids-area', big ? 62 : 42, 22]);
      s.push(...services(26));
      s.push(parking(W / 2 - 12, D, big ? 5 : 3));
      s.push(...palmRow(4, W - 4, 3.5, big ? 8 : 7).filter(([, x]) => x > 22 && !(big && x < 32)));
      s.push(...palmRow(14, W - 6, D - 12, 8).filter(([, x]) => Math.abs(x - W / 2) > 6 && x > 20));
      if (big) s.push(['volleyball', W - 18, D > 50 ? 60 : 36, { rotation: 0 }]);
      ground.push(mainPath(W, D, 12, 13.5), lawn(12, big ? 34 : 31, 5));
      break;
    case 'farm':
      s.push(['majlis-room', 9, 7, { width: 8, depth: 5 }], ['worker-room', 3.5, 15, { rotation: 90 }]);
      s.push(...services(24));
      s.push(parking(W / 2 - 10, D, 2));
      s.push(...farmZone(16, W - 1, 1, D - 10));
      break;
    case 'mixed':
    default:
      s.push(...majlisZone(12, 8, big));
      s.push(...services(26));
      s.push(parking(W / 2 - 12, D, big ? 5 : 3));
      if (big) {
        s.push(...farmZone(W / 2 + 2, W - 1, 1, D > 50 ? 46 : 24));
        s.push(...livestockZone(W / 2 + 2, W - 1, D > 50 ? 50 : 27, D - 1, D > 50));
        if (D > 50) s.push(['pool', 22, 40, { width: 10, depth: 5 }], ...palmRow(6, 40, 56, 8));
      } else {
        s.push(...palmRow(28, 46, 3.5, 6));
        s.push(['farm-bed', 40, 14]);
        s.push(...livestockZone(26, 49, 24, 49, false));
      }
      ground.push(mainPath(W, D, 12, 13.5));
      break;
  }
  return build(land, s, ground);
}

/**
 * العزبة تحت التطوير: تطلع بس لما تفتح الموقع مرة بـ ?izba=1 (وتنحفظ في المتصفح).
 * ?izba=0 يخفيها. لما نطلقها للكل نخلي IZBA_PUBLIC = true.
 */
export const IZBA_PUBLIC = false;
export function izbaEnabled(): boolean {
  if (IZBA_PUBLIC) return true;
  try {
    const q = new URLSearchParams(window.location.search).get('izba');
    if (q === '1') localStorage.setItem('enna.izba', '1');
    if (q === '0') localStorage.removeItem('enna.izba');
    return localStorage.getItem('enna.izba') === '1';
  } catch {
    return false;
  }
}

/** أفكار «ولّد» للعزبة: الاستخدامات الأربعة على أرض المستخدم */
export function izbaIdeas(base: Land): { title: string; description: string; plan: Plan; issues: number; skipped: string[] }[] {
  const plots = plotsOf(base);
  return IZBA_USES.map((u) => {
    const plan = buildIzba(u.id, plots, base);
    return { title: u.title, description: u.blurb, plan, issues: validatePlan(plan).issues.length, skipped: [] };
  });
}
