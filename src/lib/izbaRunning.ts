// «💵 المصاريف الشهرية»: كم تكلف العزبة كل شهر بعد ما تنبني — العمال، العلف، الماي، الكهرباء، البيطري، الصيانة
// كل الأرقام تقريبية لقطر ويقدر المستخدم يغيّرها (تنحفظ مع المشروع بمفاتيح run.*)
import type { Plan } from '../types/plan';
import type { Summary } from './quantities';
import { izbaInsights, RATES } from './izbaInsights';

export type Season = 'summer' | 'winter';

/** الافتراضات — كل وحدة تقدر تتغير من الواجهة */
export const RUN_DEFAULTS = {
  workers: -1, // -1 = نقترح العدد من حجم العزبة
  salary: 1500, // راتب العامل بالشهر (ر.ق)
  workerExtra: 350, // أكل + سكن + إقامة وتذكرة موزعة على الشهور
  sheep: -1, // -1 = سعة الحظاير
  camels: -1,
  horses: -1,
  feedPrice: 1.2, // ر.ق لكل كجم علف (شعير + برسيم)
  tankerPrice: 200, // تانكر 2,000 جالون
  power: 'grid' as 'grid' | 'diesel',
  kwhPrice: 0.1, // كهرماء
  dieselPrice: 2.05, // ر.ق للتر
  acHours: 10, // ساعات تشغيل المكيفات باليوم (الصيف)
  vetSheep: 6, // بيطري ودوا بالشهر لكل راس
  vetCamel: 30,
  vetHorse: 120, // مع البيطار
  maintPct: 2, // صيانة بالسنة % من تكلفة البناء
  people: 15, // متوسط الزوار باليوم (ماي)
};
export type RunInputs = typeof RUN_DEFAULTS;
export type RunKey = Exclude<keyof RunInputs, 'power'>;

/** يقرأ الافتراضات المحفوظة مع المشروع (run.*) */
export function runInputs(prices: Record<string, number>): RunInputs {
  const r = { ...RUN_DEFAULTS };
  for (const k of Object.keys(RUN_DEFAULTS) as (keyof RunInputs)[]) {
    const v = prices['run.' + k];
    if (v === undefined || !Number.isFinite(v)) continue;
    if (k === 'power') r.power = v === 1 ? 'diesel' : 'grid';
    else (r as Record<RunKey, number>)[k] = v;
  }
  return r;
}

export interface RunLine {
  key: 'workers' | 'feed' | 'water' | 'power' | 'vet' | 'maint';
  icon: string;
  label: string;
  monthly: number;
  detail: string;
}

export interface IzbaRunning {
  season: Season;
  workers: number;
  suggestedWorkers: number;
  sheep: number;
  camels: number;
  horses: number;
  capacity: { sheep: number; camels: number; horses: number };
  waterPerDay: number;
  tankersPerMonth: number;
  kwhPerDay: number;
  lines: RunLine[];
  monthly: number;
  yearly: number;
  /** متوسط السنة: 5 شهور صيف + 7 شتاء */
  yearlyAvg: number;
  perVisitDay: number;
  tips: { level: 'warn' | 'info'; text: string }[];
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** عدد العمال المقترح: عامل لكل ~80 راس غنم / 15 هجن / 4 خيل، وعامل للزراعة إذا كثرت، وأقل شي واحد */
export function suggestWorkers(sheep: number, camels: number, horses: number, palms: number, plantM2: number): number {
  const animals = sheep / 80 + camels / 15 + horses / 4;
  const farm = palms / 80 + plantM2 / 1500;
  return Math.max(1, Math.ceil(animals + farm - 0.15));
}

type Core = Omit<IzbaRunning, 'yearlyAvg'>;

/** المصاريف لموسم واحد */
function runCore(plan: Plan, s: Summary, prices: Record<string, number>, buildCost: number, season: Season): Core {
  const inp = runInputs(prices);
  const ins = izbaInsights(plan, s, inp.people);
  const pick = (v: number, cap: number) => (v >= 0 ? Math.round(v) : cap);
  const sheep = pick(inp.sheep, ins.sheep);
  const camels = pick(inp.camels, ins.camels);
  const horses = pick(inp.horses, ins.horses);
  const plantM2 = plan.elements.filter((e) => e.kind === 'farm-bed' || e.kind === 'greenhouse').reduce((t, e) => t + e.width * e.depth, 0) + (s.pathByMaterial.turf?.area ?? 0);
  const suggested = suggestWorkers(sheep, camels, horses, ins.palms, plantM2);
  const workers = inp.workers >= 0 ? Math.round(inp.workers) : suggested;
  const winter = season === 'winter';

  // الماي: نفس معدلات التحليل بس بعدد الحلال الفعلي، والشتا تقريباً 60%
  const animalWater = sheep * RATES.waterSheep + camels * RATES.waterCamel + horses * RATES.waterHorse;
  const otherWater = ins.waterPerDay - (ins.sheep * RATES.waterSheep + ins.camels * RATES.waterCamel + ins.horses * RATES.waterHorse);
  const waterPerDay = Math.round((animalWater + Math.max(0, otherWater) + workers * RATES.waterPerson) * (winter ? 0.6 : 1));
  const tankersPerMonth = waterPerDay > 0 ? Math.ceil((waterPerDay * 30) / RATES.tankL) : 0;

  const feedPerDay = sheep * RATES.feedSheep + camels * RATES.feedCamel + horses * RATES.feedHorse;

  // الكهرباء: المكيفات (تشغيل ~60% من الوقت) + الإضاءة 6 ساعات + المضخة 3 ساعات + المسبح 8 ساعات
  const acKw = ins.acTons * RATES.kwPerTon;
  const acH = winter ? Math.min(inp.acHours, 2) : inp.acHours;
  const hasPool = plan.elements.some((e) => e.kind === 'pool');
  const kwhPerDay = Math.round(acKw * acH * 0.6 + (s.lights.totalWatts / 1000) * 6 + (waterPerDay > 0 ? 1.5 * 3 : 0) + (hasPool ? 1.5 * 8 : 0) + workers * 2);
  // الديزل: ~0.3 لتر لكل كيلوواط ساعة
  const kwhCost = inp.power === 'diesel' ? 0.3 * inp.dieselPrice : inp.kwhPrice;

  const lines: RunLine[] = [];
  const add = (l: RunLine) => l.monthly > 0 && lines.push({ ...l, monthly: Math.round(l.monthly) });
  add({ key: 'workers', icon: '👷', label: 'العمال', monthly: workers * (inp.salary + inp.workerExtra), detail: `${workers} × (${fmt(inp.salary)} راتب + ${fmt(inp.workerExtra)} أكل وسكن وإقامة)` });
  add({ key: 'feed', icon: '🌾', label: 'العلف', monthly: feedPerDay * 30 * inp.feedPrice, detail: `${fmt(feedPerDay * 30)} كجم بالشهر × ${inp.feedPrice} ر.ق` });
  add({ key: 'water', icon: '💧', label: 'الماي', monthly: tankersPerMonth * inp.tankerPrice, detail: `${tankersPerMonth} تانكر (${fmt(waterPerDay)} لتر باليوم)` });
  add({ key: 'power', icon: '⚡', label: inp.power === 'diesel' ? 'الكهرباء (ديزل)' : 'الكهرباء', monthly: kwhPerDay * 30 * kwhCost, detail: inp.power === 'diesel' ? `${fmt(kwhPerDay)} ك.و.س باليوم ≈ ${fmt(kwhPerDay * 0.3 * 30)} لتر ديزل بالشهر` : `${fmt(kwhPerDay)} ك.و.س باليوم × ${inp.kwhPrice} ر.ق` });
  add({ key: 'vet', icon: '🩺', label: 'البيطري والأدوية', monthly: sheep * inp.vetSheep + camels * inp.vetCamel + horses * inp.vetHorse, detail: 'تحصينات وعلاج' + (horses ? ' وبيطار للخيل' : '') });
  add({ key: 'maint', icon: '🔧', label: 'الصيانة', monthly: (buildCost * inp.maintPct) / 100 / 12, detail: `${inp.maintPct}% بالسنة من تكلفة البناء (صبغ، سباكة، مكيفات، شبك)` });

  const monthly = lines.reduce((t, l) => t + l.monthly, 0);

  const tips: IzbaRunning['tips'] = [];
  const cap = { sheep: ins.sheep, camels: ins.camels, horses: ins.horses };
  if (sheep > cap.sheep && cap.sheep >= 0) tips.push({ level: 'warn', text: `الحظاير تكفي ${cap.sheep} راس غنم تقريباً وانت حاط ${sheep} — كبّر الحظيرة أو زود مظلة` });
  if (camels > cap.camels) tips.push({ level: 'warn', text: `حظيرة الهجن تكفي ${cap.camels} تقريباً وانت حاط ${camels}` });
  if (horses > cap.horses) tips.push({ level: 'warn', text: `الإسطبل فيه ${cap.horses} موقف تقريباً وانت حاط ${horses} خيل` });
  if (workers < suggested) tips.push({ level: 'info', text: `حجم العزبة يحتاج تقريباً ${suggested} عامل — ${workers} يمكن ما يلحقون` });
  if (workers > 0 && !plan.elements.some((e) => e.kind === 'worker-room')) tips.push({ level: 'info', text: 'ما في سكن عمال في المخطط — أضف «سكن العمال» من المباني الجاهزة' });
  if (inp.power === 'diesel' && kwhPerDay > 0) {
    const grid = kwhPerDay * 30 * inp.kwhPrice;
    const diesel = kwhPerDay * 30 * kwhCost;
    if (diesel - grid > 500) tips.push({ level: 'info', text: `توصيل كهرماء يوفر تقريباً ${fmt(diesel - grid)} ر.ق بالشهر مقارنة بالديزل` });
  }
  const feedShare = monthly ? (lines.find((l) => l.key === 'feed')?.monthly ?? 0) / monthly : 0;
  if (feedShare > 0.35) tips.push({ level: 'info', text: 'العلف أكبر مصروف — الشراء بالجملة (شاحنة) أو الشعير المدعوم يوفر كثير' });
  if (tankersPerMonth > 20) tips.push({ level: 'info', text: `${tankersPerMonth} تانكر بالشهر — اسأل عن توصيل ماي أو بئر، والري بالليل يقلل الاستهلاك` });

  return {
    season,
    workers,
    suggestedWorkers: suggested,
    sheep,
    camels,
    horses,
    capacity: cap,
    waterPerDay,
    tankersPerMonth,
    kwhPerDay,
    lines,
    monthly,
    yearly: monthly * 12,
    perVisitDay: Math.round(monthly / 8), // تقريباً زيارتين بالأسبوع
    tips,
  };
}

/** المصاريف الشهرية + متوسط السنة (5 شهور صيف و7 شتا) */
export function izbaRunning(plan: Plan, s: Summary, prices: Record<string, number>, buildCost: number, season: Season = 'summer'): IzbaRunning {
  const cur = runCore(plan, s, prices, buildCost, season);
  const other = runCore(plan, s, prices, buildCost, season === 'summer' ? 'winter' : 'summer').monthly;
  const yearlyAvg = season === 'summer' ? cur.monthly * 5 + other * 7 : other * 5 + cur.monthly * 7;
  return { ...cur, yearlyAvg: Math.round(yearlyAvg) };
}
