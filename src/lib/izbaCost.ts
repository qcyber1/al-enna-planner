// التكلفة التقديرية للعزبة: كميات من المخطط × أسعار تقريبية لسوق قطر (المستخدم يعدّلها حسب عرض المقاول)
// الأسعار نقطة بداية بس — مكتوبة بوضوح إنها تقريبية، ونعطي مدى (أقل / أعلى) مو رقم واحد.
import type { ElementKind, Plan, PlanElement, RoomType } from '../types/plan';
import type { Summary } from './quantities';
import { isIzba } from './izba';

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
export const RANGE = { low: 0.85, high: 1.2 } as const;
/** احتياطي للمصاريف غير المتوقعة (توصيلات، تسوية أرض، رخص…) */
export const CONTINGENCY_PCT = 10;

const M2 = 'م²';
const PC = 'قطعة';
const LM = 'م طولي';

/** بنود تنحسب بالمساحة (عرض × عمق العنصر) */
const BY_AREA: Partial<Record<ElementKind, [string, number, CostGroup]>> = {
  'majlis-room': ['المجلس (بناء بلوك + تشطيب)', 1800, 'civil'],
  'worker-room': ['غرفة العامل', 1300, 'civil'],
  'feed-store': ['مخزن العلف', 900, 'livestock'],
  'sheep-pen': ['حظاير الغنم (مظلة حديد + شبك)', 150, 'livestock'],
  'camel-pen': ['حظيرة الإبل (شبك + مظلة جزئية)', 100, 'livestock'],
  'horse-stable': ['إسطبل الخيل', 1200, 'livestock'],
  'animal-shade': ['مظلات الحلال', 130, 'livestock'],
  'farm-bed': ['أحواض الزراعة (تربة + تنقيط)', 60, 'garden'],
  greenhouse: ['البيت المحمي', 120, 'garden'],
  pool: ['المسبح (حفر + عزل + فلتر + بلاط)', 2500, 'garden'],
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
const ROOM_BASE = 1800;
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
    const perM = Math.round((block ? 350 : 120) * Math.max(0.6, h / 2.5));
    add('fence', block ? `السور (بلوك ${h} م مع القواعد)` : 'السياج', LM, s.fenceLength, perM, 'civil');
    add('gate', 'البوابة الرئيسية (حديد)', PC, 1, 6000, 'civil');
  }

  // بالمساحة
  for (const [kind, [label, price, group]] of Object.entries(BY_AREA) as [ElementKind, [string, number, CostGroup]][]) {
    add(kind, label, M2, plan.elements.filter((e) => e.kind === kind).reduce((t, e) => t + area(e), 0), price, group);
  }

  // المواقف: مظلة سيارات لكل موقف
  const slots = plan.elements.filter((e) => e.kind === 'parking').reduce((t, e) => t + (e.parking?.slots ?? Math.max(1, Math.round(e.width / 2.7))), 0);
  add('parking', 'مظلات السيارات', 'موقف', slots, 2000, 'services');

  // بالقطعة
  for (const [kind, [label, price, group]] of Object.entries(BY_PIECE) as [ElementKind, [string, number, CostGroup]][]) {
    add(kind, label, PC, s.counts[kind] ?? 0, price, group);
  }

  // الممرات والحدائق
  for (const [m, v] of Object.entries(s.pathByMaterial)) {
    const p = PATHS[m];
    if (p) add('path-' + m, p[0], M2, v.area, p[1], 'garden');
  }
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
