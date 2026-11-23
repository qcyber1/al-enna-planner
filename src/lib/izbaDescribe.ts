// «✍️ وصّف عزبتك»: جملة عادية ← تصميم كامل. بدون ذكاء اصطناعي (ما في تكلفة): نفهم الأرقام والكلمات المعروفة
// مثال: «أرضين، 100 غنم و10 إبل، مجلس 10×7 بحمام ومطبخ، مسبح وملعب كورة»
import type { Plan, PlanElement } from '../types/plan';
import { buildIzba, IZBA_USES, type IzbaPlots, type IzbaUse } from './izba';
import { herdGroup, majlisGroup } from './izbaQuick';
import { placeGroup } from './placement';
import { placePreset, BUILDING_PRESETS } from './buildings';
import { createElement } from './catalog';

export interface IzbaWish {
  plots: IzbaPlots;
  use: IzbaUse;
  sheep: number;
  camels: number;
  horses: number;
  majlis: { w: number; d: number } | null;
  bath: boolean;
  kitchen: boolean;
  pool: boolean;
  football: boolean;
  volleyball: boolean;
  women: boolean;
  workers: boolean;
  /** اللي فهمناه — يطلع للمستخدم قبل ما نسوي */
  chips: string[];
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const norm = (t: string) =>
  t
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[×xX*✕]/g, '×')
    .replace(/(\d)\s*في\s*(\d)/g, '$1×$2')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

const num = (re: RegExp, t: string): number => {
  const m = re.exec(t);
  return m ? Math.min(2000, Math.round(Number(m[1]))) : 0;
};

const PLOT_OPTS: IzbaPlots[] = [1, 2, 3, 4, 6];
const nearestPlots = (n: number): IzbaPlots => PLOT_OPTS.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a), 1 as IzbaPlots);

export function parseWish(text: string): IzbaWish {
  const t = norm(text);
  // الأرض: «أرضين» / «3 أراضي» / «100×50»
  let plots: IzbaPlots = 1;
  let plotsSaid = false;
  const size = /(\d{2,3})\s*×\s*(\d{2,3})(?!\s*(?:م\s*)?(?:مجلس))/.exec(t.replace(/مجلس[^،,.\n]*/g, ''));
  if (/ارضين|قطعتين/.test(t)) [plots, plotsSaid] = [2, true];
  else if (/(\d)\s*(ارض|اراضي|قطع)/.test(t)) [plots, plotsSaid] = [nearestPlots(num(/(\d)\s*(?:ارض|اراضي|قطع)/, t)), true];
  else if (size) {
    const area = Number(size[1]) * Number(size[2]);
    if (area >= 2000) [plots, plotsSaid] = [nearestPlots(area / 2500), true];
  } else if (/ارض\s*(وحده|واحده)/.test(t)) plotsSaid = true;

  // الحلال
  const sheep = num(/(\d+)\s*(?:راس\s*)?(?:غنم|حلال(?!\s*ابل)|ماعز|خروف|نعج)/, t) || num(/(?:غنم|حلال)\s*(\d+)/, t);
  const camels = num(/(\d+)\s*(?:راس\s*)?(?:ناقه|نياق|بعير|ابل|هجن|جمل)/, t) || num(/(?:ابل|هجن|نياق)\s*(\d+)/, t);
  const horses = num(/(\d+)\s*(?:راس\s*)?(?:خيل|خيول|فرس|حصان)/, t) || num(/(?:خيل|خيول)\s*(\d+)/, t);

  // المجلس: «مجلس 10×7» أو «مجلس كبير»
  let majlis: { w: number; d: number } | null = null;
  const mm = /مجلس[^\d،,.\n]{0,15}(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)/.exec(t);
  if (mm) majlis = { w: Math.max(Number(mm[1]), Number(mm[2])), d: Math.min(Number(mm[1]), Number(mm[2])) };
  else if (/مجلس\s*(كبير\s*جدا|ضخم)/.test(t)) majlis = { w: 14, d: 8 };
  else if (/مجلس\s*كبير/.test(t)) majlis = { w: 10, d: 7 };
  else if (/مجلس\s*(صغير)/.test(t)) majlis = { w: 6, d: 5 };
  else if (/مجلس\s*(وسط|متوسط)/.test(t)) majlis = { w: 8, d: 6 };
  const bath = /حمام|دوره\s*مياه/.test(t);
  const kitchen = /مطبخ/.test(t);
  const pool = /مسبح|بركه|حوض\s*سباحه/.test(t);
  const football = /كوره|كره\s*قدم|ملعب\s*خماسي/.test(t);
  const volleyball = /طائره|طايره|فولي/.test(t);
  const women = /نساء|حريم|ملحق/.test(t);
  const workers = /عمال|عامل|سايس|راعي/.test(t);

  // نوع العزبة
  let use: IzbaUse = 'mixed';
  if (/عائلي|عايلي|للعائله|للعايله/.test(t)) use = 'family';
  else if (/استراحه/.test(t) && !sheep && !camels && !horses) use = 'rest';
  else if (/زراعه|مزرعه|نخل\s*وخضر/.test(t) && !sheep && !camels && !horses) use = 'farm';
  else if (horses && !sheep && !camels) use = 'horses';
  else if (camels && !sheep && !horses) use = 'camels';
  else if ((sheep || camels) && !pool && !majlis && !/مجلس/.test(t)) use = 'livestock';
  else if (!sheep && !camels && !horses && pool) use = 'rest';

  const chips: string[] = [];
  chips.push(`📐 ${plots === 1 ? 'أرض وحدة' : plots === 2 ? 'أرضين' : `${plots} أراضي`}${plotsSaid ? '' : ' (ما حددت — حطينا وحدة)'}`);
  chips.push(`${IZBA_USES.find((u) => u.id === use)!.icon} ${IZBA_USES.find((u) => u.id === use)!.title}`);
  if (sheep) chips.push(`🐑 ${sheep} غنم`);
  if (camels) chips.push(`🐪 ${camels} إبل`);
  if (horses) chips.push(`🐎 ${horses} خيل`);
  if (majlis) chips.push(`🏠 مجلس ${majlis.w}×${majlis.d}${bath ? ' + حمام' : ''}${kitchen ? ' + مطبخ' : ''}`);
  if (pool) chips.push('🏊 مسبح');
  if (football) chips.push('⚽ ملعب كورة');
  if (volleyball) chips.push('🏐 ملعب طائرة');
  if (women) chips.push('👩 ملحق نساء');
  if (workers) chips.push('🛖 سكن عمال');
  return { plots, use, sheep, camels, horses, majlis, bath, kitchen, pool, football, volleyball, women, workers, chips };
}

const LIVESTOCK = new Set(['sheep-pen', 'camel-pen', 'horse-stable', 'trough', 'animal-shade']);
const FURN = new Set(['sofa-l', 'tv-unit', 'coffee-table', 'bath-set', 'kitchen-counter']);

/** مجلس القالب (غرفة المجلس + الغرف الملاصقة لها + أثاثها) — عشان نبدله بالمقاس اللي طلبه */
function templateMajlisIds(plan: Plan): Set<string> {
  const ids = new Set<string>();
  const m = plan.elements.find((e) => e.kind === 'room' && e.room?.type === 'majlis' && !/نساء/.test(e.name));
  if (!m) return ids;
  const box = (e: PlanElement) => ({ x0: e.x - e.width / 2, x1: e.x + e.width / 2, y0: e.y - e.depth / 2, y1: e.y + e.depth / 2 });
  const b = box(m);
  ids.add(m.id);
  for (const e of plan.elements) {
    if (e.kind !== 'room' || e.id === m.id || /نساء/.test(e.name)) continue;
    const o = box(e);
    if (o.x0 <= b.x1 + 0.3 && o.x1 >= b.x0 - 0.3 && o.y0 <= b.y1 + 0.3 && o.y1 >= b.y0 - 0.3) {
      ids.add(e.id);
      b.x0 = Math.min(b.x0, o.x0);
      b.x1 = Math.max(b.x1, o.x1);
      b.y0 = Math.min(b.y0, o.y0);
      b.y1 = Math.max(b.y1, o.y1);
    }
  }
  for (const e of plan.elements) if (FURN.has(e.kind) && e.x >= b.x0 && e.x <= b.x1 && e.y >= b.y0 && e.y <= b.y1) ids.add(e.id);
  return ids;
}

/** التصميم: نبدأ من القالب المناسب، ونبدّل الحلال والمجلس بالأرقام اللي كتبها، ونضيف الزيادات */
export function buildFromWish(w: IzbaWish): Plan {
  const plan = buildIzba(w.use, w.plots);
  const add = (els: PlanElement[]) => plan.elements.push(...els);
  // الحلال بالعدد اللي كتبه (يتحط تحت الريح)
  if (w.sheep || w.camels || w.horses) {
    plan.elements = plan.elements.filter((e) => !LIVESTOCK.has(e.kind));
    const g = herdGroup({
      sheep: w.sheep,
      camels: w.camels,
      horses: w.horses,
      feed: true,
      worker: true,
      hasFeedStore: plan.elements.some((e) => e.kind === 'feed-store'),
      hasWorker: plan.elements.some((e) => e.kind === 'worker-room' || (e.kind === 'room' && /عامل|العمال/.test(e.name))),
    });
    add(placeGroup(plan, g, 'downwind'));
  }
  // المجلس بالمقاس اللي طلبه (يتحط فوق الريح)
  if (w.majlis) {
    const old = templateMajlisIds(plan);
    plan.elements = plan.elements.filter((e) => !old.has(e.id));
    add(placeGroup(plan, majlisGroup({ width: w.majlis.w, depth: w.majlis.d, bath: w.bath || !w.kitchen, kitchen: w.kitchen || !w.bath }), 'upwind'));
  }
  const has = (k: string) => plan.elements.some((e) => e.kind === k);
  const one = (kind: Parameters<typeof createElement>[0], o: Partial<PlanElement> = {}) => {
    const el = createElement(kind, { x: 0, y: 0 }, o);
    add(placeGroup(plan, { els: [{ ...el, x: el.width / 2, y: el.depth / 2 }], width: el.width, depth: el.depth }));
  };
  if (w.pool && !has('pool')) one('pool');
  if (w.football && !has('football')) one('football');
  if (w.volleyball && !has('volleyball')) one('volleyball');
  const preset = (id: 'women-annex' | 'workers') => {
    const p = BUILDING_PRESETS.find((b) => b.id === id)!;
    const els = placePreset(id, p.width / 2, p.depth / 2);
    add(placeGroup(plan, { els, width: p.width, depth: p.depth }, id === 'workers' ? 'downwind' : 'upwind'));
  };
  if (w.women && !plan.elements.some((e) => /نساء/.test(e.name))) preset('women-annex');
  if (w.workers && !plan.elements.some((e) => e.kind === 'worker-room' || /عامل|العمال/.test(e.name))) preset('workers');
  return plan;
}
