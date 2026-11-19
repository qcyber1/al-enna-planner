// أدوات سريعة للعزبة: «أضف حلالك» (حظاير بالمقاس الصح حسب العدد) و«صمّم مجلسك» (مجلس بالمقاس اللي تبيه + حمام ومطبخ)
// كلها ترجع عناصر حول (0،0) = الزاوية العلوية اليسار، والمكان الفاضي يتحدد بعدين
import type { Opening, PlanElement } from '../types/plan';
import { createElement, makeRoom, ROOM_TYPE_LABELS } from './catalog';
import { RATES } from './izbaInsights';

const half = (n: number) => Math.round(n * 2) / 2;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export interface HerdInput {
  sheep: number;
  camels: number;
  horses: number;
  /** نحط مخزن علف ومعلف لكل حظيرة */
  feed: boolean;
  /** غرفة عامل لو الحلال كثير */
  worker: boolean;
  /** العزبة فيها أصلاً مخزن علف / غرفة عامل — ما نكررها */
  hasFeedStore?: boolean;
  hasWorker?: boolean;
}

export interface Group {
  els: PlanElement[];
  width: number;
  depth: number;
}

/** مقاس حوش بمساحة معينة ونسبة طول/عرض */
function penSize(area: number, ratio: number, min: number) {
  const d = clamp(half(Math.sqrt(area / ratio)), min, 30);
  const w = clamp(Math.ceil((area / d) * 2) / 2, min, 60);
  return { w, d };
}

/** الحظاير حسب العدد: غنم ~2 م² للراس، إبل ~12 م²، خيل بوكس 3.6 م — صف وحد مع مسافة 2 م */
export function herdGroup(h: HerdInput): Group {
  const els: PlanElement[] = [];
  let x = 0;
  let maxD = 0;
  const GAP = 2;
  const put = (el: PlanElement, w: number, d: number) => {
    el.x = x + w / 2;
    el.y = d / 2;
    els.push(el);
    x += w + GAP;
    maxD = Math.max(maxD, d);
  };
  const trough = (pen: PlanElement, w: number, d: number, label: string) => {
    if (!h.feed) return;
    const t = createElement('trough', { x: pen.x, y: pen.y + d / 2 - 0.9 }, { width: clamp(half(w * 0.4), 1.5, 6), name: `معلف ${label}` });
    els.push(t);
  };
  const sheep = Math.max(0, Math.round(h.sheep));
  const camels = Math.max(0, Math.round(h.camels));
  const horses = Math.max(0, Math.round(h.horses));
  if (sheep) {
    const { w, d } = penSize(Math.max(24, sheep * RATES.sheepM2), 1.5, 4);
    const pen = createElement('sheep-pen', { x: 0, y: 0 }, { width: w, depth: d, name: `حظيرة غنم (${sheep} راس)` });
    put(pen, w, d);
    trough(pen, w, d, 'الغنم');
  }
  if (camels) {
    const { w, d } = penSize(Math.max(60, camels * RATES.camelM2), 1.33, 6);
    const pen = createElement('camel-pen', { x: 0, y: 0 }, { width: w, depth: d, name: `حظيرة إبل (${camels})` });
    put(pen, w, d);
    trough(pen, w, d, 'الإبل');
  }
  // الخيل: صفوف بوكسات (8 بالصف كحد أقصى)
  for (let left = horses, row = 1; left > 0; row++) {
    const n = Math.min(8, left);
    left -= n;
    const w = half(n * RATES.horseBay);
    const st = createElement('horse-stable', { x: 0, y: 0 }, { width: w, depth: 5, name: horses > 8 ? `إسطبل خيل ${row} (${n})` : `إسطبل خيل (${n})` });
    put(st, w, 5);
  }
  const total = sheep + camels + horses;
  if (total && h.feed && !h.hasFeedStore) {
    const big = sheep + camels * 4 + horses * 5 > 120;
    const w = big ? 8 : 6;
    const d = big ? 5 : 4;
    put(createElement('feed-store', { x: 0, y: 0 }, { width: w, depth: d }), w, d);
  }
  if (total > 20 && h.worker && !h.hasWorker) put(createElement('worker-room', { x: 0, y: 0 }), 4, 3);
  return { els, width: Math.max(0, x - GAP), depth: maxD };
}

export interface MajlisInput {
  /** طول المجلس (الواجهة) */
  width: number;
  /** عمق المجلس */
  depth: number;
  bath: boolean;
  kitchen: boolean;
}

/** المقاسات الشائعة للمجالس */
export const MAJLIS_SIZES: { w: number; d: number; label: string }[] = [
  { w: 6, d: 5, label: 'صغير' },
  { w: 8, d: 6, label: 'وسط' },
  { w: 10, d: 7, label: 'كبير' },
  { w: 14, d: 8, label: 'كبير جداً' },
];

const op = (side: Opening['side'], width = 0.9, offset = 0): Opening => ({ side, width, offset });

/** المجلس: غرفة بالمقاس + جلسة L + تلفزيون وطاولات، والحمام والمطبخ عمود على اليمين (جدار مشترك) */
export function majlisGroup(m: MajlisInput, roof = '#e9e7e2', facade = '#e7dcc6'): Group {
  const W = clamp(half(m.width), 4, 30);
  const D = clamp(half(m.depth), 3.5, 20);
  const els: PlanElement[] = [];
  const room = (type: Parameters<typeof makeRoom>[0], x: number, y: number, w: number, d: number, doors: Opening[], windows: Opening[], name?: string) =>
    els.push(createElement('room', { x: x + w / 2, y: y + d / 2 }, { width: w, depth: d, name: name ?? ROOM_TYPE_LABELS[type], room: makeRoom(type, doors, windows), roof, color: facade }));
  const wins: Opening[] = [op('left', 1.4)];
  if (W >= 8) wins.push(op('front', 1.4, -W / 3), op('front', 1.4, W / 3));
  else wins.push(op('front', 1.2, -W / 3));
  room('majlis', 0, 0, W, D, [op('front', Math.min(1.8, W / 4))], wins, 'المجلس');
  const col = m.bath || m.kitchen ? 4.4 : 0;
  const cx = W - 0.2;
  if (m.bath && m.kitchen) {
    const bd = clamp(half(D * 0.45), 2.6, 4);
    room('bathroom', cx, 0, col, bd, [op('left', 0.8, 0.5)], [op('back', 0.6)]);
    room('kitchen', cx, bd - 0.2, col, D - bd + 0.2, [op('front', 0.9)], [op('right', 1.2)]);
    els.push(createElement('bath-set', { x: cx + col / 2, y: 1.1 }));
    els.push(createElement('kitchen-counter', { x: cx + col - 0.55, y: bd + (D - bd) / 2 }, { rotation: 90, width: clamp(D - bd - 0.6, 1.5, 4) }));
  } else if (m.bath) {
    room('bathroom', cx, 0, col, Math.min(D, 4), [op('left', 0.8, 0.5)], [op('back', 0.6)]);
    els.push(createElement('bath-set', { x: cx + col / 2, y: 1.1 }));
  } else if (m.kitchen) {
    room('kitchen', cx, 0, col, D, [op('front', 0.9)], [op('right', 1.2)]);
    els.push(createElement('kitchen-counter', { x: cx + col - 0.55, y: D / 2 }, { rotation: 90, width: clamp(D - 0.8, 1.5, 4) }));
  }
  // جلسة المجلس
  els.push(createElement('sofa-l', { x: W / 2 - 0.1, y: D / 2 }, { width: Math.max(2.5, W - 1), depth: Math.max(2.5, D - 0.9) }));
  els.push(createElement('tv-unit', { x: W - 0.55, y: D / 2 }, { rotation: 90 }));
  els.push(createElement('coffee-table', { x: W / 2 - 0.6, y: D / 2 + 0.4 }));
  if (W >= 9) els.push(createElement('coffee-table', { x: W / 2 + 1.6, y: D / 2 + 0.4 }));
  return { els, width: W + (col ? col - 0.2 : 0), depth: D };
}
