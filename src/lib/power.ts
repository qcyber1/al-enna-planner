// كهرباء العنة: الأجهزة في كل خيمة ← الحمل الكلي ← حجم المولد ← الديزل ← الكيابل من المولد لكل خيمة
// أرقام تقريبية للتخطيط (230 فولت فاز واحد، كيبل نحاس). الكهربائي يعتمد المقاسات النهائية.
import type { Plan, PlanElement } from '../types/plan';
import { CATALOG_BY_KIND, isTentKind } from './catalog';
import { totalLightingWatts } from './lighting';

export type Season = 'winter' | 'summer';
export type ApplianceId = 'ac' | 'heater' | 'fridge' | 'kettle' | 'tv' | 'chargers' | 'microwave' | 'fan' | 'speaker' | 'water-heater';

export interface Appliance {
  id: ApplianceId;
  label: string;
  icon: string;
  /** القدرة وهو شغال (واط) */
  watts: number;
  /** نسبة الوقت اللي يشتغل فيه خلال الليلة (للمتوسط والديزل) */
  duty: number;
  /** يحتاج تيار تشغيل عالي (ضواغط) — يحسب في هامش المولد */
  surge?: boolean;
  season?: Season;
}

export const APPLIANCES: Appliance[] = [
  { id: 'ac', label: 'مكيف 1.5 طن', icon: '❄️', watts: 1800, duty: 0.8, surge: true, season: 'summer' },
  { id: 'heater', label: 'دفاية', icon: '🔥', watts: 2000, duty: 0.6, season: 'winter' },
  { id: 'fridge', label: 'ثلاجة', icon: '🧊', watts: 200, duty: 0.5, surge: true },
  { id: 'kettle', label: 'غلاية / ترمس قهوة', icon: '☕', watts: 2000, duty: 0.15 },
  { id: 'microwave', label: 'مايكرويف', icon: '🍲', watts: 1200, duty: 0.1 },
  { id: 'water-heater', label: 'سخان ماي', icon: '🚿', watts: 1500, duty: 0.3, season: 'winter' },
  { id: 'tv', label: 'تلفزيون + رسيفر', icon: '📺', watts: 200, duty: 0.7 },
  { id: 'speaker', label: 'سماعات', icon: '🔊', watts: 150, duty: 0.5 },
  { id: 'fan', label: 'مروحة', icon: '🌀', watts: 70, duty: 0.8 },
  { id: 'chargers', label: 'شواحن + واي فاي', icon: '🔌', watts: 100, duty: 1 },
];
export const APPLIANCE_BY_ID = Object.fromEntries(APPLIANCES.map((a) => [a.id, a])) as Record<ApplianceId, Appliance>;

export interface PowerSettings {
  season: Season;
  /** ساعات تشغيل المولد في الليلة */
  hours: number;
  /** سعة خزان الديزل (لتر) */
  tankL: number;
  /** حجم المولد اللي عندك (0 = ما حددت) */
  generatorKva: number;
  /** الأجهزة لكل عنصر (لو ما تحدد نستخدم الاقتراح التلقائي) */
  appliances: Record<string, Partial<Record<ApplianceId, number>>>;
}

export const DEFAULT_POWER: PowerSettings = { season: 'winter', hours: 10, tankL: 1000, generatorKva: 0, appliances: {} };

/** المقاسات الشائعة للمولدات المؤجرة */
export const GEN_SIZES = [10, 15, 20, 30, 40, 50, 60, 80, 100, 125, 150, 200, 250, 300];

/** الأماكن اللي يوصلها كهرباء */
export function isPowered(el: PlanElement): boolean {
  return isTentKind(el.kind) || ['sleep-cabin', 'kitchen-cabin', 'outdoor-kitchen', 'screen', 'majlis-room', 'room', 'worker-room'].includes(el.kind);
}

const area = (el: PlanElement) => Math.max(0, el.width) * Math.max(0, el.depth);

/** الاقتراح التلقائي حسب نوع المكان ومساحته */
export function suggestAppliances(el: PlanElement, season: Season): Partial<Record<ApplianceId, number>> {
  const a = area(el);
  // خيمة: طن لكل ~12 م² (عزلها ضعيف) ← مكيف 1.5 طن لكل 18 م²
  const ac = Math.max(1, Math.ceil(a / 18));
  const heaters = Math.max(1, Math.ceil(a / 25));
  const climate = season === 'summer' ? { ac } : { heater: heaters };
  switch (el.kind) {
    case 'kitchen-tent':
    case 'kitchen-cabin':
    case 'outdoor-kitchen':
      return { fridge: 1, kettle: 1, microwave: 1, ...(season === 'summer' ? { fan: 1 } : {}) };
    case 'screen':
      return { tv: 1, speaker: 1 };
    case 'main-tent':
    case 'majlis-room':
      return { ...climate, tv: 1, kettle: 1, chargers: 1 };
    case 'dining-tent':
      return { ...climate };
    default:
      return { ...climate, chargers: 1 };
  }
}

export interface PowerLine {
  id: string;
  name: string;
  watts: number;
  avgWatts: number;
  items: { id: ApplianceId; n: number }[];
  auto: boolean;
  /** المسافة بالكيبل من المولد (م) */
  cableM: number | null;
  amps: number;
  cableMm2: number | null;
  dropPct: number | null;
}

export interface PowerResult {
  lines: PowerLine[];
  lightingW: number;
  lightingCableM: number | null;
  peakKw: number;
  avgKw: number;
  generatorKva: number;
  litersPerNight: number;
  tankNights: number | null;
  cableByMm2: { mm2: number; m: number }[];
  generator: PlanElement | null;
  warnings: string[];
}

const V = 230;
/** مقاسات الكيبل (مم²) والتيار المسموح تقريباً (أمبير) */
const CABLES: [number, number][] = [
  [2.5, 24],
  [4, 32],
  [6, 41],
  [10, 57],
  [16, 76],
  [25, 101],
  [35, 125],
];
const RHO = 0.0175;

/** أصغر كيبل يتحمل التيار وهبوط الجهد فيه 5% أو أقل */
export function pickCable(amps: number, meters: number): { mm2: number | null; drop: number } {
  for (const [mm2, max] of CABLES) {
    const drop = ((2 * meters * amps * RHO) / mm2 / V) * 100;
    if (amps <= max && drop <= 5) return { mm2, drop: Math.round(drop * 10) / 10 };
  }
  const [mm2] = CABLES[CABLES.length - 1];
  return { mm2: null, drop: Math.round(((2 * meters * amps * RHO) / mm2 / V) * 1000) / 10 };
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
/** الكيبل ما يمشي خط مستقيم: +15% للالتفاف و 2 م للتوصيل */
const route = (d: number) => Math.round((d * 1.15 + 2) * 10) / 10;

export function computePower(plan: Plan, settings: Partial<PowerSettings> = {}): PowerResult {
  const st = { ...DEFAULT_POWER, ...settings };
  const gen = plan.elements.find((e) => e.kind === 'generator') ?? null;
  const lines: PowerLine[] = [];
  for (const el of plan.elements) {
    if (!isPowered(el)) continue;
    const custom = st.appliances[el.id];
    const cfg = custom ?? suggestAppliances(el, st.season);
    const items = (Object.entries(cfg) as [ApplianceId, number][]).filter(([id, n]) => APPLIANCE_BY_ID[id] && n > 0).map(([id, n]) => ({ id, n: Math.min(20, Math.round(n)) }));
    // الأجهزة الموسمية: المكيف ما يشتغل بالشتا والدفاية ما تشتغل بالصيف
    const active = items.filter((i) => !APPLIANCE_BY_ID[i.id].season || APPLIANCE_BY_ID[i.id].season === st.season);
    const watts = active.reduce((t, i) => t + APPLIANCE_BY_ID[i.id].watts * i.n, 0);
    const avgWatts = active.reduce((t, i) => t + APPLIANCE_BY_ID[i.id].watts * APPLIANCE_BY_ID[i.id].duty * i.n, 0);
    const cableM = gen ? route(dist(gen, el)) : null;
    const amps = Math.round((watts / V) * 10) / 10;
    const c = cableM !== null && watts > 0 ? pickCable(amps, cableM) : null;
    lines.push({ id: el.id, name: el.name || CATALOG_BY_KIND[el.kind].label, watts, avgWatts, items, auto: !custom, cableM, amps, cableMm2: c?.mm2 ?? null, dropPct: c?.drop ?? null });
  }
  const lightingW = Math.round(totalLightingWatts(plan));
  const lights = plan.elements.filter((e) => e.light && e.light.on !== false);
  const lightingCableM = gen && lights.length ? Math.round(lights.reduce((t, e) => t + route(dist(gen, e)), 0)) : null;

  const loadW = lines.reduce((t, l) => t + l.watts, 0) + lightingW;
  // مو كل الأجهزة تشتغل بنفس اللحظة: الغلايات والمايكرويف نحسب نصها
  const peakW = lines.reduce((t, l) => t + l.items.reduce((s, i) => {
    const a = APPLIANCE_BY_ID[i.id];
    if (a.season && a.season !== st.season) return s;
    return s + a.watts * i.n * (a.duty < 0.2 ? 0.5 : 1);
  }, 0), 0) + lightingW;
  const avgW = lines.reduce((t, l) => t + l.avgWatts, 0) + lightingW;
  const surge = lines.some((l) => l.items.some((i) => APPLIANCE_BY_ID[i.id].surge && (!APPLIANCE_BY_ID[i.id].season || APPLIANCE_BY_ID[i.id].season === st.season)));
  // KVA = kW ÷ 0.8 (معامل القدرة) × هامش (25% مع المكيفات/الثلاجات، 15% بدونها)
  const needKva = peakW ? (peakW / 1000 / 0.8) * (surge ? 1.25 : 1.15) : 0;
  const generatorKva = needKva ? GEN_SIZES.find((s) => s >= needKva) ?? Math.ceil(needKva / 50) * 50 : 0;
  // الديزل: ~0.28 لتر لكل كيلوواط ساعة، والمولد ما ينزل تحت ~30% من حجمه
  const runKw = Math.max(avgW / 1000, generatorKva * 0.8 * 0.3);
  const litersPerNight = generatorKva ? Math.round(runKw * st.hours * 0.28 * 10) / 10 : 0;
  const tankNights = litersPerNight && plan.elements.some((e) => e.kind === 'diesel-tank') ? Math.round((st.tankL / litersPerNight) * 10) / 10 : null;

  const byMm2 = new Map<number, number>();
  for (const l of lines) if (l.cableMm2 && l.cableM) byMm2.set(l.cableMm2, (byMm2.get(l.cableMm2) ?? 0) + l.cableM);
  if (lightingCableM) byMm2.set(2.5, (byMm2.get(2.5) ?? 0) + lightingCableM);
  const cableByMm2 = [...byMm2.entries()].sort((a, b) => a[0] - b[0]).map(([mm2, m]) => ({ mm2, m: Math.round(m) }));

  const warnings: string[] = [];
  if (!gen && loadW > 0) warnings.push('ما في مولد في المخطط — حطه عشان نحسب الكيابل والمسافات');
  if (gen) {
    const tents = plan.elements.filter((e) => isTentKind(e.kind) || e.kind === 'sleep-cabin');
    const near = tents.map((t) => ({ t, d: dist(gen, t) - Math.max(t.width, t.depth) / 2 })).sort((a, b) => a.d - b.d)[0];
    if (near && near.d < 10) warnings.push(`المولد قريب من «${near.t.name}» (${Math.max(0, Math.round(near.d))} م) — الإزعاج والدخان، الأفضل 10 م أو أكثر`);
    const fire = plan.elements.filter((e) => e.kind === 'fire-pit' || e.kind === 'bbq' || e.kind === 'tannour');
    for (const f of fire) if (dist(gen, f) < 6) warnings.push(`المولد قريب من «${f.name}» — خله بعيد عن النار 6 م على الأقل`);
    const diesel = plan.elements.find((e) => e.kind === 'diesel-tank');
    if (diesel) for (const f of fire) if (dist(diesel, f) < 8) warnings.push(`خزان الديزل قريب من «${f.name}» — خطر حريق، بعّده 8 م على الأقل`);
  }
  if (generatorKva && litersPerNight && !plan.elements.some((e) => e.kind === 'diesel-tank')) warnings.push(`المولد يحتاج تقريباً ${litersPerNight} لتر ديزل بالليلة — حط خزان ديزل`);
  if (tankNights !== null && tankNights < 3) warnings.push(`خزان الديزل يكفي ${tankNights} ليلة بس`);
  if (st.generatorKva > 0 && generatorKva > st.generatorKva) warnings.push(`مولدك ${st.generatorKva} KVA أصغر من الحاجة (${generatorKva} KVA) — بيطفي لما تشتغل الأجهزة مع بعض`);
  for (const l of lines) if (l.cableM !== null && l.watts > 0 && l.cableMm2 === null) warnings.push(`«${l.name}» بعيدة والحمل عالي — تحتاج كيبل أكبر من 35 مم² أو لوحة فرعية قريبة`);

  return {
    lines,
    lightingW,
    lightingCableM,
    peakKw: Math.round(peakW / 100) / 10,
    avgKw: Math.round(avgW / 100) / 10,
    generatorKva,
    litersPerNight,
    tankNights,
    cableByMm2,
    generator: gen,
    warnings,
  };
}

/** تنظيف إعدادات الكهرباء من ملف مستورد */
export function sanitizePower(raw: unknown): PowerSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown, d: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
  const appliances: PowerSettings['appliances'] = {};
  if (r.appliances && typeof r.appliances === 'object') {
    for (const [id, cfg] of Object.entries(r.appliances as Record<string, unknown>).slice(0, 500)) {
      if (!cfg || typeof cfg !== 'object') continue;
      const out: Partial<Record<ApplianceId, number>> = {};
      for (const [k, v] of Object.entries(cfg as Record<string, unknown>)) if (k in APPLIANCE_BY_ID) out[k as ApplianceId] = n(v, 0, 0, 20);
      appliances[id.slice(0, 80)] = out;
    }
  }
  return {
    season: r.season === 'summer' ? 'summer' : 'winter',
    hours: n(r.hours, DEFAULT_POWER.hours, 1, 24),
    tankL: n(r.tankL, DEFAULT_POWER.tankL, 50, 50000),
    generatorKva: n(r.generatorKva, 0, 0, 2000),
    appliances,
  };
}
