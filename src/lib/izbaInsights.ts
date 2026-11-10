// تحليل العزبة: سعة الحلال، الماي والعلف اليومي، كم يوم يكفي الخزان، وحجم المولد المناسب
// كلها أرقام تقريبية للتخطيط (معدلات صيف قطر)، مكتوبة بوضوح إنها تقديرية.
import type { Plan, PlanElement } from '../types/plan';
import type { Summary } from './quantities';

/** معدلات تقريبية */
export const RATES = {
  /** مساحة الحظيرة لكل راس غنم (مع الظل والحركة) */
  sheepM2: 2,
  camelM2: 12,
  /** إسطبل: موقف (بوكس) تقريباً 3.6 م لكل خيل */
  horseBay: 3.6,
  // ماي باليوم (لتر) — صيف قطر
  waterSheep: 8,
  waterCamel: 40,
  waterHorse: 40,
  waterPalm: 200,
  waterTree: 60,
  /** لتر لكل م² زراعة/حشيش باليوم */
  waterPlantM2: 6,
  /** الزوار والعمال باليوم (لتر للشخص) */
  waterPerson: 50,
  // علف باليوم (كجم)
  feedSheep: 2,
  feedCamel: 8,
  feedHorse: 10,
  /** سعة خزان الماي الواحد (لتر) — الشائع 2,000 جالون */
  tankL: 9000,
  /** تكييف: طن لكل 15 م² تقريباً، والطن يسحب ~1.3 كيلوواط */
  acM2PerTon: 15,
  kwPerTon: 1.3,
} as const;

export interface IzbaInsights {
  builtArea: number;
  coveragePct: number;
  sheep: number;
  camels: number;
  horses: number;
  palms: number;
  trees: number;
  waterPerDay: number;
  feedPerDay: number;
  tanks: number;
  tankDays: number | null;
  acTons: number;
  powerKw: number;
  generatorKva: number;
  tips: { level: 'warn' | 'info'; text: string }[];
}

const area = (e: PlanElement) => Math.max(0, e.width) * Math.max(0, e.depth);
const sumArea = (els: PlanElement[], kinds: string[]) => els.filter((e) => kinds.includes(e.kind)).reduce((t, e) => t + area(e), 0);
const count = (els: PlanElement[], kind: string) => els.filter((e) => e.kind === kind).length;

export function izbaInsights(plan: Plan, s: Summary, people = 15): IzbaInsights {
  const els = plan.elements;
  const built = sumArea(els, ['room', 'majlis-room', 'worker-room', 'feed-store', 'toilet']);
  const cooled = sumArea(els, ['room', 'majlis-room', 'worker-room']);
  const sheep = Math.floor(sumArea(els, ['sheep-pen', 'animal-shade']) / RATES.sheepM2);
  const camels = Math.floor(sumArea(els, ['camel-pen']) / RATES.camelM2);
  const horses = els.filter((e) => e.kind === 'horse-stable').reduce((t, e) => t + Math.max(1, Math.floor(Math.max(e.width, e.depth) / RATES.horseBay)), 0);
  const palms = count(els, 'palm');
  const trees = count(els, 'tree');
  const plantM2 = sumArea(els, ['farm-bed', 'greenhouse']) + (s.pathByMaterial.turf?.area ?? 0);

  const waterPerDay = Math.round(
    sheep * RATES.waterSheep + camels * RATES.waterCamel + horses * RATES.waterHorse + palms * RATES.waterPalm + trees * RATES.waterTree + plantM2 * RATES.waterPlantM2 + people * RATES.waterPerson,
  );
  const feedPerDay = Math.round(sheep * RATES.feedSheep + camels * RATES.feedCamel + horses * RATES.feedHorse);
  const tanks = count(els, 'water-tank');
  const tankDays = tanks && waterPerDay ? Math.round(((tanks * RATES.tankL) / waterPerDay) * 10) / 10 : null;

  const acTons = Math.ceil(cooled / RATES.acM2PerTon);
  const pumps = waterPerDay > 0 ? 1.5 : 0;
  const powerKw = Math.round((acTons * RATES.kwPerTon + s.lights.totalWatts / 1000 + pumps + (count(els, 'pool') ? 2 : 0)) * 10) / 10;
  // المولد: معامل قدرة 0.8 + هامش 25% لتشغيل المكيفات
  const generatorKva = powerKw ? Math.ceil(((powerKw / 0.8) * 1.25) / 5) * 5 : 0;

  const landArea = Math.max(1, s.landArea);
  const tips: IzbaInsights['tips'] = [];
  if (waterPerDay > 0 && !tanks) tips.push({ level: 'warn', text: `ما في خزان ماي — العزبة تحتاج تقريباً ${fmt(waterPerDay)} لتر باليوم` });
  else if (tankDays !== null && tankDays < 2) tips.push({ level: 'warn', text: `الخزانات تكفي ${tankDays} يوم بس — زود خزان عشان ما تنقطع لو تأخر التانكر` });
  if (sheep + camels + horses > 0 && !els.some((e) => e.kind === 'trough')) tips.push({ level: 'warn', text: 'في حلال بس ما في معلف أو مشرب' });
  if (sheep + camels + horses > 0 && !els.some((e) => e.kind === 'feed-store')) tips.push({ level: 'info', text: `العلف تقريباً ${fmt(feedPerDay * 30)} كجم بالشهر — حط مخزن علف قريب من الحظاير` });
  if (cooled > 0 && !els.some((e) => e.kind === 'generator')) tips.push({ level: 'info', text: `إذا ما في كهرباء عامة تحتاج مولد تقريباً ${generatorKva} KVA` });
  if (!els.some((e) => e.kind === 'worker-room') && sheep + camels + horses > 20) tips.push({ level: 'info', text: 'الحلال كثير — الأغلب يحتاج غرفة عامل قريبة' });
  if (built / landArea > 0.3) tips.push({ level: 'info', text: `المباني ${Math.round((built / landArea) * 100)}% من الأرض — تأكد من نسبة البناء المسموحة عند البلدية` });

  return {
    builtArea: Math.round(built),
    coveragePct: Math.round((built / landArea) * 1000) / 10,
    sheep,
    camels,
    horses,
    palms,
    trees,
    waterPerDay,
    feedPerDay,
    tanks,
    tankDays,
    acTons,
    powerKw,
    generatorKva,
    tips,
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
