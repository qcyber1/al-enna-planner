// التكلفة التقديرية للعزبة: كميات من المخطط × أسعار تقريبية لسوق قطر (المستخدم يعدّلها حسب عرض المقاول)
// الأسعار نقطة بداية بس — مكتوبة بوضوح إنها تقريبية، ونعطي مدى (أقل / أعلى) مو رقم واحد.
// المراجع (نوفمبر 2026): مقاولين قطر يسعّرون البناء بتشطيب متوسط 2,500–3,500 ر.ق/م²؛ المسابح بالخليج 1,500–3,000/م² + 10–40% إضافات؛
// مظلات السيارات ~1,750 ر.ق للموقف (عرض سعر 2016، مرفوع للتضخم). الباقي تقدير — المستخدم يعدّله.
import type { ElementKind, Plan, PlanElement, RoomType } from '../types/plan';
import type { Summary } from './quantities';
import { isIzba } from './izba';
import { izbaIrrigation } from './irrigation';

export type CostGroup = 'civil' | 'livestock' | 'garden' | 'services' | 'interior' | 'lighting';

export const COST_GROUPS: { id: CostGroup; title: string; icon: string }[] = [
  { id: 'civil', title: 'المباني والسور', icon: '🧱' },
  { id: 'livestock', title: 'الحلال', icon: '🐑' },
  { id: 'garden', title: 'الزراعة والحوش', icon: '🌴' },
  { id: 'services', title: 'الخدمات والجلسات', icon: '🔧' },
  { id: 'interior', title: 'الأثاث الداخلي', icon: '🛋️' },
  { id: 'lighting', title: 'الإنارة', icon: '💡' },
];

export interface IzbaCostLine {
  key: string;
  label: string;
  unit: string;
  qty: number;
  /** السعر التقريبي الافتراضي (ر.ق) */
  price: number;
  group: CostGroup;
}

/** المدى حول الرقم: الأسعار تختلف حسب المقاول والمواد */
export const RANGE = { low: 0.8, high: 1.25 } as const;
/** احتياطي للمصاريف غير المتوقعة (توصيلات، تسوية أرض، رخص…) */
export const CONTINGENCY_PCT = 10;

const M2 = 'م²';
const PC = 'قطعة';
const LM = 'م طولي';

/** بنود تنحسب بالمساحة (عرض × عمق العنصر) */
const BY_AREA: Partial<Record<ElementKind, [string, number, CostGroup]>> = {
  'majlis-room': ['المجلس (بناء بلوك + تشطيب)', 2500, 'civil'],
  'worker-room': ['غرفة العامل', 1800, 'civil'],
  'feed-store': ['مخزن العلف', 1200, 'livestock'],
  'sheep-pen': ['حظاير الغنم (مظلة حديد + شبك)', 150, 'livestock'],
  'camel-pen': ['حظيرة الإبل (شبك + مظلة جزئية)', 100, 'livestock'],
  'horse-stable': ['إسطبل الخيل', 1500, 'livestock'],
  'animal-shade': ['مظلات الحلال', 130, 'livestock'],
  'farm-bed': ['أحواض الزراعة (تربة + تنقيط)', 60, 'garden'],
  greenhouse: ['البيت المحمي', 120, 'garden'],
  pool: ['المسبح (حفر + عزل + فلتر + بلاط)', 3000, 'garden'],
  canopy: ['المظلات والجلسات الخارجية', 250, 'services'],
};

/** بنود تنحسب بالقطعة */
const BY_PIECE: Partial<Record<ElementKind, [string, number, CostGroup]>> = {
  trough: ['المعالف والمشارب', 1500, 'livestock'],
  palm: ['النخل (شتلة كبيرة مع الزراعة)', 1200, 'garden'],
  tree: ['الشجر (سدر / غاف)', 400, 'garden'],
  toilet: ['حمامات خارجية', 8000, 'services'],
  sink: ['مغاسل خارجية', 1200, 'services'],
  'water-tank': ['خزانات الماي', 4000, 'services'],
  generator: ['المولد الكهربائي', 25000, 'services'],
  'diesel-tank': ['خزان الديزل', 3500, 'services'],
  'fire-pit': ['الضو (موقد)', 1500, 'services'],
  bbq: ['الشوي', 2500, 'services'],
  tannour: ['التنور', 1800, 'services'],
  'kids-area': ['ألعاب الأطفال', 8000, 'services'],
  volleyball: ['ملعب الطائرة (شبكة + تجهيز)', 3000, 'services'],
  football: ['ملعب كورة خماسي (عشب صناعي + مرامي)', 15000, 'services'],
  seating: ['جلسات خارجية', 1500, 'services'],
  'majlis-rug': ['جلسات أرضية (سدو)', 1200, 'services'],
  'outdoor-kitchen': ['مطبخ خارجي', 6000, 'services'],
  storage: ['مخازن', 5000, 'services'],
  'sofa-l': ['جلسات المجلس الداخلية', 6000, 'interior'],
  'tv-unit': ['مكتبات التلفزيون', 2500, 'interior'],
  'coffee-table': ['طاولات القهوة', 800, 'interior'],
  bed: ['الأسرّة', 2500, 'interior'],
  wardrobe: ['الدواليب', 2000, 'interior'],
  billiard: ['طاولة البلياردو', 6000, 'interior'],
  'kitchen-counter': ['كاونترات المطبخ', 6000, 'interior'],
  'bath-set': ['أطقم الحمامات (صحي + خلاط)', 3500, 'interior'],
  'light-pole': ['أعمدة الإنارة', 1200, 'lighting'],
  'flood-light': ['كشافات LED', 400, 'lighting'],
  'ground-light': ['إنارة أرضية', 150, 'lighting'],
  'entrance-light': ['إنارة البوابة', 600, 'lighting'],
  lantern: ['فوانيس', 150, 'lighting'],
};

/** الغرف المبنية: هيكل + تشطيب متوسط، والحمامات والمطابخ عليها زيادة (سيراميك + تمديدات) */
const ROOM_BASE = 2500;
const WET_EXTRA = 700;
const WET: RoomType[] = ['bathroom', 'kitchen'];

const PATHS: Record<string, [string, number]> = {
  tiles: ['ممرات بلاط / انترلوك', 120],
  stone: ['ممرات حجرية', 150],
  turf: ['عشب صناعي (حدائق وممرات)', 60],
  sand: ['تسوية رمل', 15],
  'wood-turf': ['ممرات خشب + عشب', 220],
};

const area = (e: PlanElement) => Math.max(0, e.width) * Math.max(0, e.depth);

export function izbaCostLines(plan: Plan, s: Summary): IzbaCostLine[] {
  const out: IzbaCostLine[] = [];
  const add = (key: string, label: string, unit: string, qty: number, price: number, group: CostGroup) => {
    if (qty > 0) out.push({ key: 'izba:' + key, label, unit, qty: Math.round(qty * 100) / 100, price, group });
  };

  // المباني (الغرف المرسومة بأداة «ارسم مبنى»)
  const rooms = plan.elements.filter((e) => e.kind === 'room');
  add('rooms', 'المباني (بلوك + سقف + تشطيب متوسط)', M2, rooms.reduce((t, e) => t + area(e), 0), ROOM_BASE, 'civil');
  add('rooms-wet', 'زيادة تشطيب الحمامات والمطابخ', M2, rooms.filter((e) => e.room && WET.includes(e.room.type)).reduce((t, e) => t + area(e), 0), WET_EXTRA, 'civil');

  // السور والبوابة
  const fence = plan.land.fence;
  if (fence?.enabled && s.fenceLength > 0) {
    const block = fence.type === 'block';
    const h = fence.height ?? 2.5;
    // سعر السور يكبر مع الارتفاع (المرجع 2.5 م)
    const perM = Math.round((block ? 400 : 120) * Math.max(0.6, h / 2.5));
    add('fence', block ? `السور (بلوك ${h} م مع القواعد)` : 'السياج', LM, s.fenceLength, perM, 'civil');
    add('gate', 'البوابة الرئيسية (حديد)', PC, 1, 6000, 'civil');
  }

  // بالمساحة
  for (const [kind, [label, price, group]] of Object.entries(BY_AREA) as [ElementKind, [string, number, CostGroup]][]) {
    add(kind, label, M2, plan.elements.filter((e) => e.kind === kind).reduce((t, e) => t + area(e), 0), price, group);
  }

  // المواقف: مظلة سيارات لكل موقف
  const slots = plan.elements.filter((e) => e.kind === 'parking').reduce((t, e) => t + (e.parking?.slots ?? Math.max(1, Math.round(e.width / 2.7))), 0);
  add('parking', 'مظلات السيارات', 'موقف', slots, 2500, 'services');

  // بالقطعة
  for (const [kind, [label, price, group]] of Object.entries(BY_PIECE) as [ElementKind, [string, number, CostGroup]][]) {
    add(kind, label, PC, s.counts[kind] ?? 0, price, group);
  }

  // الممرات والحدائق
  for (const [m, v] of Object.entries(s.pathByMaterial)) {
    const p = PATHS[m];
    if (p) add('path-' + m, p[0], M2, v.area, p[1], 'garden');
  }
  // شبكة الري بالتنقيط (من الخزان للنخل والشجر والأحواض)
  const irr = izbaIrrigation(plan);
  add('irr-main', 'خط الري الرئيسي (32 مم)', LM, irr.mainM, 12, 'garden');
  add('irr-lateral', 'خطوط التنقيط (16 مم)', LM, irr.lateralM, 3, 'garden');
  add('irr-sprinklers', 'رشاشات الحشيش', PC, irr.sprinklers, 35, 'garden');
  add('irr-pump', `مضخة الري (${irr.pumpHp} حصان)`, PC, irr.pumpHp ? 1 : 0, 900 + irr.pumpHp * 600, 'garden');
  add('irr-control', `جهاز ري أوتوماتيكي + ${irr.zones} محبس`, PC, irr.zones ? 1 : 0, 400 + irr.zones * 150, 'garden');
  add('string-lights', 'سلاسل ليتات', LM, s.lights.stringLength, 25, 'lighting');
  add('path-edge', 'إنارة جوانب الممرات', PC, s.lights.pathEdgeLights, 150, 'lighting');
  return out;
}

export interface IzbaEstimate {
  lines: (IzbaCostLine & { unitPrice: number; total: number; custom: boolean })[];
  byGroup: { id: CostGroup; title: string; icon: string; total: number }[];
  subtotal: number;
  contingency: number;
  total: number;
  low: number;
  high: number;
}

/** يجمع التقدير: السعر اللي كتبه المستخدم يغلب الافتراضي */
export function izbaEstimate(plan: Plan, s: Summary, prices: Record<string, number>): IzbaEstimate {
  const lines = izbaCostLines(plan, s).map((l) => {
    const custom = prices[l.key] !== undefined;
    const unitPrice = custom ? prices[l.key] : l.price;
    return { ...l, unitPrice, total: Math.round(unitPrice * l.qty), custom };
  });
  const byGroup = COST_GROUPS.map((g) => ({ ...g, total: lines.filter((l) => l.group === g.id).reduce((t, l) => t + l.total, 0) })).filter((g) => g.total > 0);
  const subtotal = lines.reduce((t, l) => t + l.total, 0);
  const contingency = Math.round((subtotal * CONTINGENCY_PCT) / 100);
  const total = subtotal + contingency;
  // نقرّب لأقرب ألف عشان ما يبان رقم دقيق وهو تقدير
  const k = (n: number) => Math.round(n / 1000) * 1000;
  return { lines, byGroup, subtotal, contingency, total, low: k(total * RANGE.low), high: k(total * RANGE.high) };
}

export const hasIzbaEstimate = (plan: Plan) => isIzba(plan.land);

/** مراحل البناء: أغلب الناس يبنون العزبة على مراحل — كل مرحلة بتكلفتها (مع نصيبها من الاحتياطي) */
export interface IzbaPhase {
  n: number;
  title: string;
  icon: string;
  hint: string;
  total: number;
  items: string[];
}

const PHASE1 = new Set(['fence', 'gate', 'water-tank', 'generator', 'diesel-tank', 'toilet', 'sink', 'worker-room', 'parking', 'path-sand', 'path-tiles']);
const PHASE2 = new Set(['rooms', 'rooms-wet', 'majlis-room']);

export function phaseOf(l: Pick<IzbaCostLine, 'key' | 'group'>): 1 | 2 | 3 {
  const k = l.key.replace(/^izba:/, '');
  if (PHASE1.has(k)) return 1;
  if (PHASE2.has(k) || l.group === 'interior') return 2;
  return 3;
}

export function izbaPhases(e: IzbaEstimate): IzbaPhase[] {
  const meta: [string, string, string][] = [
    ['السور والخدمات الأساسية', '🧱', 'السور والبوابة، الماي والكهرباء، الحمام وغرفة العامل — العزبة تصير قابلة للاستخدام'],
    ['المباني والمجلس', '🏠', 'المجلس والغرف وتشطيبها والأثاث'],
    ['الحلال والزراعة والجلسات', '🌴', 'الحظاير والإسطبلات، النخل والزراعة، الجلسات والإنارة والكماليات'],
  ];
  const k = e.subtotal ? 1 + CONTINGENCY_PCT / 100 : 1;
  return meta
    .map(([title, icon, hint], i) => {
      const ls = e.lines.filter((l) => phaseOf(l) === i + 1);
      return { n: i + 1, title, icon, hint, total: Math.round(ls.reduce((t, l) => t + l.total, 0) * k), items: ls.map((l) => l.label) };
    })
    .filter((p) => p.total > 0);
}

/** مرحلة كل عنصر في المخطط (نفس تقسيم التكلفة) */
const EL_PHASE1 = new Set(['water-tank', 'generator', 'diesel-tank', 'toilet', 'sink', 'worker-room', 'parking', 'entrance-light', 'light-pole', 'flood-light']);
const EL_PHASE2 = new Set(['room', 'majlis-room', 'sofa-l', 'tv-unit', 'coffee-table', 'bed', 'wardrobe', 'billiard', 'kitchen-counter', 'bath-set']);
export function elementPhase(el: Plan['elements'][number]): 1 | 2 | 3 {
  if (el.kind === 'path') return el.path?.material === 'turf' ? 3 : 1;
  if (EL_PHASE1.has(el.kind)) return 1;
  if (EL_PHASE2.has(el.kind)) return 2;
  return 3;
}

/** المخطط لين نهاية مرحلة معيّنة (السور جزء من الأرض فيطلع من المرحلة 1) */
export function phasePlan(plan: Plan, n: 1 | 2 | 3): Plan {
  const copy = JSON.parse(JSON.stringify(plan)) as Plan;
  copy.elements = copy.elements.filter((e) => elementPhase(e) <= n);
  return copy;
}
