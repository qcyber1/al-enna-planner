import type {
  FloorFinish,
  Opening,
  RoomProps,
  RoomType,
  WallFinish,
  CourtSurface,
  ElementKind,
  FenceType,
  GroundType,
  LightColor,
  PathMaterial,
  PlanElement,
  Side,
  TentInterior,
  TentStyle,
  Vec2,
} from '../types/plan';
import { uid } from './id';

export type Category = 'tents' | 'facilities' | 'paths' | 'lighting' | 'furniture' | 'livestock' | 'garden' | 'building' | 'interior';
export type Geometry = 'rect' | 'point' | 'polyline';
/** فئة التصادم المستخدمة في التنبيهات */
export type CollisionClass = 'structure' | 'cover' | 'soft' | 'court' | 'path' | 'pole' | 'none';

export interface CatalogItem {
  kind: ElementKind;
  category: Category;
  label: string;
  description: string;
  icon: string;
  geometry: Geometry;
  collision: CollisionClass;
  /** قيم افتراضية تقريبية للتجربة فقط — يمكن تعديلها */
  defaults: Omit<PlanElement, 'id' | 'kind' | 'x' | 'y' | 'rotation' | 'locked' | 'name'>;
  minSize: number;
  isTent?: boolean;
  isLight?: boolean;
  /** يطلع في المكتبة بس لما المشروع عزبة */
  izbaOnly?: boolean;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  tents: 'الخيام',
  facilities: 'المرافق',
  paths: 'الممرات',
  lighting: 'الإنارة',
  furniture: 'الجلسات والأثاث',
  livestock: 'الحلال',
  garden: 'الزراعة والحديقة',
  building: 'المباني والغرف',
  interior: 'الأثاث الداخلي',
};

export const CATEGORY_ORDER: Category[] = ['tents', 'facilities', 'paths', 'lighting', 'furniture', 'livestock', 'garden', 'building', 'interior'];
/** ترتيب المكتبة في العزبة: الحلال والزراعة أول */
export const IZBA_CATEGORY_ORDER: Category[] = ['building', 'interior', 'livestock', 'facilities', 'garden', 'tents', 'furniture', 'paths', 'lighting'];

export const TENT_STYLE_LABELS: Record<TentStyle, string> = {
  majlis: 'مجلس (سقف مائل)',
  bedouin: 'بيت شعر',
  pyramid: 'هرمية',
};

export const SIDE_LABELS: Record<Side, string> = {
  front: 'أمام',
  back: 'خلف',
  left: 'يسار',
  right: 'يمين',
};

export const INTERIOR_LABELS: Record<TentInterior, string> = {
  majlis: 'جلسة مجلس',
  dining: 'طاولات طعام',
  kitchen: 'مطبخ وخدمات',
  empty: 'فارغة',
};

export const PATH_MATERIAL_LABELS: Record<PathMaterial, string> = {
  turf: 'عشب صناعي أخضر',
  'wood-turf': 'خشب + عشب صناعي',
  tiles: 'بلاط خارجي',
  sand: 'رمل فقط',
  stone: 'ممر حجري',
};

export const COURT_SURFACE_LABELS: Record<CourtSurface, string> = {
  sand: 'رمل',
  turf: 'عشب صناعي',
};

export const GROUND_LABELS: Record<GroundType, string> = {
  sand: 'رمل صحراوي',
  soil: 'تراب',
  flat: 'أرض مستوية (مدكوكة)',
};

export const FENCE_LABELS: Record<FenceType, string> = {
  fabric: 'سواتر قماش',
  mesh: 'شبك',
  block: 'جدار بلوك منخفض',
};

export const SURROUND_LABELS: Record<import('../types/plan').Surround, string> = {
  open: 'صحراء مفتوحة',
  dunes: 'طعوس (كثبان رملية)',
  hazm: 'حزم (مرتفع صخري)',
  sea: 'بحر',
};

export const LIGHT_COLOR_LABELS: Record<LightColor, string> = {
  warm: 'أصفر دافئ',
  white: 'أبيض',
};

const tent = (
  style: TentStyle,
  interior: TentInterior,
  wallHeight: number,
  entranceWidth: number,
): PlanElement['tent'] => ({
  style,
  wallHeight,
  entranceSide: 'front',
  entranceOffset: 0,
  entranceWidth,
  interior,
  interiorLight: true,
  entranceLight: true,
});

const light = (
  watts: number,
  mountHeight: number,
  beam: number,
  color: LightColor,
  tilt = 90,
): PlanElement['light'] => ({
  on: true,
  intensity: 100,
  watts,
  color,
  mountHeight,
  tilt,
  beam,
});

const base = {
  width: 1,
  depth: 1,
  height: 1,
  color: '#e9dcc0',
  accent: '#9b2c2c',
};

// ——— الغرف ———
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  majlis: 'مجلس',
  bedroom: 'غرفة نوم',
  bathroom: 'حمام',
  kitchen: 'مطبخ',
  hall: 'صالة',
  games: 'غرفة ألعاب',
  store: 'مخزن',
  dining: 'غرفة طعام',
};
export const FLOOR_LABELS: Record<FloorFinish, string> = {
  marble: 'رخام أبيض',
  wood: 'باركيه خشب',
  microcement: 'مايكروسمنت رمادي',
  tiles: 'بلاط',
  carpet: 'موكيت',
};
export const WALL_LABELS: Record<WallFinish, string> = {
  paint: 'دهان',
  'wood-panel': 'ألواح خشب',
  stone: 'حجر',
  marble: 'رخام',
};
/** تشطيبات افتراضية حسب نوع الغرفة (مثل عزب سميسمة) */
export const ROOM_PRESETS: Record<RoomType, Omit<RoomProps, 'type' | 'doors' | 'windows'>> = {
  majlis: { floor: 'marble', wall: 'paint', wallColor: '#f3eee4', coveLight: true },
  bedroom: { floor: 'wood', wall: 'paint', wallColor: '#ece6dc', coveLight: true },
  bathroom: { floor: 'marble', wall: 'marble', wallColor: '#f1f1ef', coveLight: false },
  kitchen: { floor: 'tiles', wall: 'marble', wallColor: '#f1f1ef', coveLight: false },
  hall: { floor: 'marble', wall: 'paint', wallColor: '#f3eee4', coveLight: true },
  games: { floor: 'wood', wall: 'wood-panel', wallColor: '#a57a52', coveLight: true },
  store: { floor: 'tiles', wall: 'paint', wallColor: '#e6e1d8', coveLight: false },
  dining: { floor: 'marble', wall: 'paint', wallColor: '#f3eee4', coveLight: true },
};
export function makeRoom(type: RoomType, doors: Opening[] = [{ side: 'front', offset: 0, width: 1 }], windows: Opening[] = []): RoomProps {
  return { type, ...ROOM_PRESETS[type], doors, windows };
}

export const CATALOG: CatalogItem[] = [
  // ——— الخيام ———
  {
    kind: 'main-tent',
    category: 'tents',
    label: 'الخيمة الرئيسية (المجلس)',
    description: 'مجلس رئيسي بسقف مائل وحزام سدو',
    icon: '⛺',
    geometry: 'rect',
    collision: 'structure',
    isTent: true,
    minSize: 2,
    defaults: {
      ...base,
      width: 12,
      depth: 7,
      height: 4.4,
      color: '#efe4cc',
      accent: '#9b2c2c',
      tent: tent('majlis', 'majlis', 2.6, 2.4),
    },
  },
  {
    kind: 'small-tent',
    category: 'tents',
    label: 'خيمة صغيرة',
    description: 'خيمة إضافية للنوم أو الضيوف',
    icon: '🏕️',
    geometry: 'rect',
    collision: 'structure',
    isTent: true,
    minSize: 1.5,
    defaults: {
      ...base,
      width: 4,
      depth: 4,
      height: 3.4,
      color: '#ece0c4',
      accent: '#7a4a24',
      tent: tent('pyramid', 'majlis', 2.1, 1.4),
    },
  },
  {
    kind: 'dining-tent',
    category: 'tents',
    label: 'خيمة الطعام',
    description: 'خيمة بطاولات طعام',
    icon: '🍽️',
    geometry: 'rect',
    collision: 'structure',
    isTent: true,
    minSize: 2,
    defaults: {
      ...base,
      width: 8,
      depth: 5,
      height: 4,
      color: '#f1e8d6',
      accent: '#2f5d3a',
      tent: tent('majlis', 'dining', 2.4, 2),
    },
  },
  {
    kind: 'kitchen-tent',
    category: 'tents',
    label: 'خيمة الخدمات / المطبخ',
    description: 'خيمة للمطبخ والتخزين والخدمات',
    icon: '🍳',
    geometry: 'rect',
    collision: 'structure',
    isTent: true,
    minSize: 2,
    defaults: {
      ...base,
      width: 6,
      depth: 4,
      height: 3.6,
      color: '#e2d5b8',
      accent: '#5c4033',
      tent: tent('majlis', 'kitchen', 2.3, 1.6),
    },
  },
  {
    kind: 'canopy',
    category: 'tents',
    label: 'مظلة / جلسة خارجية',
    description: 'مظلة مفتوحة الجوانب على أعمدة',
    icon: '⛱️',
    geometry: 'rect',
    collision: 'cover',
    minSize: 1.5,
    defaults: {
      ...base,
      width: 5,
      depth: 4,
      height: 3.2,
      color: '#f4ecdb',
      accent: '#a0522d',
    },
  },
  {
    kind: 'majlis-rug',
    category: 'furniture',
    label: 'جلسة شعبية وسجاد',
    description: 'سجاد سدو مع مساند ومراكي أرضية',
    icon: '🧶',
    geometry: 'rect',
    collision: 'soft',
    minSize: 1,
    defaults: {
      ...base,
      width: 5,
      depth: 4,
      height: 0.6,
      color: '#8e2a2a',
      accent: '#1f3d2b',
    },
  },
  // ——— المرافق ———
  {
    kind: 'volleyball',
    category: 'facilities',
    label: 'ملعب كرة طائرة',
    description: '18 × 9 م مع الشبكة ومنطقة الأمان',
    icon: '🏐',
    geometry: 'rect',
    collision: 'court',
    minSize: 4,
    defaults: {
      ...base,
      width: 18,
      depth: 9,
      height: 2.43,
      color: '#e8d3a2',
      accent: '#ffffff',
      court: { surface: 'sand', safetyMargin: 3, netHeight: 2.43, attackLines: false },
    },
  },
  {
    kind: 'toilet',
    category: 'facilities',
    label: 'كبينة حمام',
    description: 'كبينة حمام خارجية',
    icon: '🚻',
    geometry: 'rect',
    collision: 'structure',
    minSize: 0.8,
    defaults: { ...base, width: 1.3, depth: 1.3, height: 2.4, color: '#f2f2ef', accent: '#2b6cb0' },
  },
  {
    kind: 'sink',
    category: 'facilities',
    label: 'مغسلة خارجية',
    description: 'مغسلة مع مرآة',
    icon: '🚰',
    geometry: 'rect',
    collision: 'structure',
    minSize: 0.4,
    defaults: { ...base, width: 1.2, depth: 0.6, height: 1.8, color: '#d9d4cb', accent: '#7a5c3e' },
  },
  {
    kind: 'outdoor-kitchen',
    category: 'facilities',
    label: 'مطبخ خارجي',
    description: 'كاونتر مع موقد ومغسلة',
    icon: '🔥',
    geometry: 'rect',
    collision: 'structure',
    minSize: 1,
    defaults: { ...base, width: 3.5, depth: 1.2, height: 2.6, color: '#c9b79a', accent: '#5a3e2b' },
  },
  {
    kind: 'storage',
    category: 'facilities',
    label: 'مخزن',
    description: 'كرفان أو حاوية تخزين',
    icon: '📦',
    geometry: 'rect',
    collision: 'structure',
    minSize: 1,
    defaults: { ...base, width: 3, depth: 2.4, height: 2.5, color: '#8a6f4e', accent: '#e9dcc0' },
  },
  {
    kind: 'parking',
    category: 'facilities',
    label: 'مواقف سيارات',
    description: 'مواقف بعدد قابل للتعديل',
    icon: '🚙',
    geometry: 'rect',
    collision: 'structure',
    minSize: 2.5,
    defaults: {
      ...base,
      width: 8,
      depth: 5.5,
      height: 1.8,
      color: '#c8b38c',
      accent: '#ffffff',
      parking: { slots: 3, showCars: true },
    },
  },
  {
    kind: 'water-tank',
    category: 'facilities',
    label: 'خزان ماء',
    description: 'خزان على قاعدة مرتفعة',
    icon: '💧',
    geometry: 'rect',
    collision: 'structure',
    minSize: 0.6,
    defaults: { ...base, width: 1.6, depth: 1.6, height: 2.8, color: '#e8e4da', accent: '#5d6b75' },
  },
  {
    kind: 'generator',
    category: 'facilities',
    label: 'مولد كهرباء',
    description: 'مولد مع غطاء عازل',
    icon: '⚡',
    geometry: 'rect',
    collision: 'structure',
    minSize: 0.6,
    defaults: { ...base, width: 2.2, depth: 1.1, height: 1.4, color: '#c58a1c', accent: '#2d2d2d' },
  },
  {
    kind: 'bbq',
    category: 'facilities',
    label: 'منطقة شواء',
    description: 'منقلة شواء مع طاولة تحضير',
    icon: '🍢',
    geometry: 'rect',
    collision: 'structure',
    minSize: 0.6,
    defaults: { ...base, width: 3, depth: 2, height: 1.1, color: '#3a3a38', accent: '#8a5a33' },
  },
  // ——— الأثاث ———
  {
    kind: 'table-set',
    category: 'furniture',
    label: 'طاولة وكراسي',
    description: 'طاولة دائرية مع كراسي',
    icon: '🪑',
    geometry: 'rect',
    collision: 'soft',
    minSize: 0.6,
    defaults: {
      ...base,
      width: 2.4,
      depth: 2.4,
      height: 0.75,
      color: '#7b5434',
      accent: '#efe4cc',
      furniture: { seats: 6 },
    },
  },
  {
    kind: 'seating',
    category: 'furniture',
    label: 'جلسة خارجية (كنب)',
    description: 'كنب خارجي على شكل حرف U',
    icon: '🛋️',
    geometry: 'rect',
    collision: 'soft',
    minSize: 1,
    defaults: { ...base, width: 4, depth: 3, height: 0.8, color: '#d8c7a5', accent: '#6b3f26' },
  },
  // ——— الممرات ———
  {
    kind: 'path',
    category: 'paths',
    label: 'ممر',
    description: 'ارسم ممراً من نقطة إلى نقطة بعدة زوايا',
    icon: '🟩',
    geometry: 'polyline',
    collision: 'path',
    minSize: 0.3,
    defaults: {
      ...base,
      height: 0.05,
      color: '#4f9a35',
      accent: '#7a5534',
      path: { material: 'turf', width: 2, edgeLights: false, edgeLightSpacing: 3 },
    },
  },
  // ——— الإنارة ———
  {
    kind: 'light-pole',
    category: 'lighting',
    label: 'عمود إنارة',
    description: 'عمود إنارة خارجي مع رأس LED',
    icon: '💡',
    geometry: 'point',
    collision: 'pole',
    isLight: true,
    minSize: 0.2,
    defaults: {
      ...base,
      width: 0.4,
      depth: 0.4,
      height: 4.5,
      color: '#2f2f2f',
      accent: '#d4a24c',
      light: light(60, 4.5, 110, 'warm'),
    },
  },
  {
    kind: 'flood-light',
    category: 'lighting',
    label: 'كشاف LED',
    description: 'كشاف موجه بزاوية وميل قابلين للتعديل',
    icon: '🔦',
    geometry: 'point',
    collision: 'pole',
    isLight: true,
    minSize: 0.2,
    defaults: {
      ...base,
      width: 0.4,
      depth: 0.4,
      height: 6,
      color: '#3a3a3a',
      accent: '#d0d0d0',
      light: light(200, 6, 60, 'white', 35),
    },
  },
  {
    kind: 'string-lights',
    category: 'lighting',
    label: 'سلسلة ليتات معلقة',
    description: 'ارسمها بين الأعمدة نقطة بنقطة',
    icon: '✨',
    geometry: 'polyline',
    collision: 'none',
    isLight: true,
    minSize: 0.2,
    defaults: {
      ...base,
      height: 3.2,
      color: '#3a3a3a',
      accent: '#ffd58a',
      light: light(1, 3.2, 360, 'warm'),
      string: { sag: 0.4, bulbSpacing: 0.6, autoPoles: true },
    },
  },
  {
    kind: 'ground-light',
    category: 'lighting',
    label: 'إنارة أرضية',
    description: 'إنارة منخفضة لجوانب الممرات',
    icon: '🔅',
    geometry: 'point',
    collision: 'none',
    isLight: true,
    minSize: 0.1,
    defaults: {
      ...base,
      width: 0.2,
      depth: 0.2,
      height: 0.5,
      color: '#3a3a3a',
      accent: '#ffd58a',
      light: light(5, 0.5, 360, 'warm'),
    },
  },
  {
    kind: 'entrance-light',
    category: 'lighting',
    label: 'إنارة المدخل',
    description: 'عمود مدخل بفانوس تراثي',
    icon: '🏮',
    geometry: 'point',
    collision: 'pole',
    isLight: true,
    minSize: 0.2,
    defaults: {
      ...base,
      width: 0.45,
      depth: 0.45,
      height: 2.8,
      color: '#4a3424',
      accent: '#d4a24c',
      light: light(25, 2.8, 360, 'warm'),
    },
  },
  {
    kind: 'lantern',
    category: 'lighting',
    label: 'فانوس مدخل خيمة',
    description: 'فانوس يوضع عند مدخل الخيمة',
    icon: '🪔',
    geometry: 'point',
    collision: 'none',
    isLight: true,
    minSize: 0.1,
    defaults: {
      ...base,
      width: 0.3,
      depth: 0.3,
      height: 2.2,
      color: '#3b2a1e',
      accent: '#d4a24c',
      light: light(12, 2.2, 360, 'warm'),
    },
  },
  // ——— عناصر العنة القطرية ———
  {
    kind: 'sleep-cabin',
    category: 'facilities',
    label: 'كبينة رقدة (نوم)',
    description: 'كرفان نوم مع مكيف وشباك',
    icon: '🛏️',
    geometry: 'rect',
    collision: 'structure',
    minSize: 1.5,
    defaults: { ...base, width: 6, depth: 2.6, height: 2.8, color: '#f1ece2', accent: '#7a4a24' },
  },
  {
    kind: 'kitchen-cabin',
    category: 'facilities',
    label: 'كبينة مطبخ',
    description: 'كرفان مطبخ مع شفاط',
    icon: '🍲',
    geometry: 'rect',
    collision: 'structure',
    minSize: 1.5,
    defaults: { ...base, width: 4.5, depth: 2.6, height: 2.8, color: '#e8e2d6', accent: '#2f5d3a' },
  },
  {
    kind: 'fire-pit',
    category: 'furniture',
    label: 'الضو (شبّة النار)',
    description: 'موقد نار مع جلسة أرضية والدلال',
    icon: '🔥',
    geometry: 'rect',
    collision: 'structure',
    minSize: 1,
    defaults: { ...base, width: 4, depth: 4, height: 0.5, color: '#8e2a2a', accent: '#5a4636' },
  },
  {
    kind: 'prayer-area',
    category: 'furniture',
    label: 'مصلّى',
    description: 'سجاد صلاة موجّه للقبلة تلقائياً',
    icon: '🕌',
    geometry: 'rect',
    collision: 'soft',
    minSize: 1,
    defaults: { ...base, width: 5, depth: 3, height: 0.05, color: '#2f5d3a', accent: '#d4a24c' },
  },
  {
    kind: 'screen',
    category: 'furniture',
    label: 'شاشة عرض (مباريات)',
    description: 'شاشة خارجية كبيرة على حامل',
    icon: '📺',
    geometry: 'rect',
    collision: 'structure',
    minSize: 0.5,
    defaults: { ...base, width: 3, depth: 0.6, height: 2.6, color: '#1c1c1c', accent: '#3a3a3a' },
  },
  {
    kind: 'kids-area',
    category: 'facilities',
    label: 'ألعاب أطفال',
    description: 'زحليقة ومراجيح على أرضية مطاطية',
    icon: '🛝',
    geometry: 'rect',
    collision: 'structure',
    minSize: 2,
    defaults: { ...base, width: 6, depth: 5, height: 2.5, color: '#3b82c4', accent: '#e8b33a' },
  },
  {
    kind: 'partition',
    category: 'tents',
    label: 'ساتر (خصوصية)',
    description: 'ساتر قماش للفصل بين المجالس',
    icon: '🧱',
    geometry: 'rect',
    collision: 'structure',
    minSize: 0.2,
    defaults: { ...base, width: 8, depth: 0.2, height: 2.2, color: '#d9c49b', accent: '#8e2a2a' },
  },
  {
    kind: 'dakka',
    category: 'furniture',
    label: 'دكة / مركاز',
    description: 'دكة جلوس خارجية مرتفعة بمساند ودواوشك',
    icon: '🪑',
    geometry: 'rect',
    collision: 'soft',
    minSize: 0.6,
    defaults: { ...base, width: 4, depth: 1.8, height: 0.9, color: '#c9b089', accent: '#8e2a2a' },
  },
  {
    kind: 'tannour',
    category: 'facilities',
    label: 'تنور / فرن طين',
    description: 'تنور خبز رقاق ومندي',
    icon: '🫓',
    geometry: 'rect',
    collision: 'structure',
    minSize: 0.6,
    defaults: { ...base, width: 1.4, depth: 1.4, height: 1.2, color: '#b5794a', accent: '#5a3a22' },
  },
  {
    kind: 'diesel-tank',
    category: 'facilities',
    label: 'خزان ديزل للمولد',
    description: 'خزان ديزل مع حوض تسريب — يُفضّل قريب من المولد وبعيد عن الضو',
    icon: '🛢️',
    geometry: 'rect',
    collision: 'structure',
    minSize: 0.5,
    defaults: { ...base, width: 1.8, depth: 1.1, height: 1.4, color: '#2f5d3a', accent: '#d9b23a' },
  },
  {
    kind: 'carport',
    category: 'facilities',
    label: 'مظلة سيارات',
    description: 'مظلة قماش على أعمدة حديد — تنحط فوق مواقف السيارات',
    icon: '🏗️',
    geometry: 'rect',
    collision: 'cover',
    minSize: 2,
    defaults: { ...base, width: 9, depth: 6, height: 3, color: '#e9e2d0', accent: '#6b6b6b' },
  },

  // ——— العزبة: الحلال ———
  {
    kind: 'sheep-pen',
    category: 'livestock',
    label: 'حظيرة غنم',
    description: 'حوش شبك مع مظلة في جهة — يُفضّل تحت الريح بعيد عن المجلس',
    icon: '🐑',
    geometry: 'rect',
    collision: 'structure',
    minSize: 2,
    izbaOnly: true,
    defaults: { ...base, width: 12, depth: 8, height: 1.6, color: '#c9b48c', accent: '#8a8f94' },
  },
  {
    kind: 'camel-pen',
    category: 'livestock',
    label: 'حظيرة إبل',
    description: 'حوش واسع بسياج مواسير عالي',
    icon: '🐪',
    geometry: 'rect',
    collision: 'structure',
    minSize: 4,
    izbaOnly: true,
    defaults: { ...base, width: 20, depth: 15, height: 2, color: '#cdb995', accent: '#7d7f82' },
  },
  {
    kind: 'horse-stable',
    category: 'livestock',
    label: 'إسطبل خيل',
    description: 'صف بوكسات خيل تحت سقف واحد',
    icon: '🐎',
    geometry: 'rect',
    collision: 'structure',
    minSize: 3,
    izbaOnly: true,
    defaults: { ...base, width: 14, depth: 5, height: 3.2, color: '#d8c7a4', accent: '#6b4a2b' },
  },
  {
    kind: 'animal-shade',
    category: 'livestock',
    label: 'مظلة حلال',
    description: 'مظلة صاج على أعمدة تحمي الحلال من الشمس',
    icon: '⛱️',
    geometry: 'rect',
    collision: 'cover',
    minSize: 2,
    izbaOnly: true,
    defaults: { ...base, width: 10, depth: 6, height: 3, color: '#d9d6cf', accent: '#5f6266' },
  },
  {
    kind: 'feed-store',
    category: 'livestock',
    label: 'مخزن علف',
    description: 'مخزن مسقوف لبالات البرسيم والشعير',
    icon: '🌾',
    geometry: 'rect',
    collision: 'structure',
    minSize: 1.5,
    izbaOnly: true,
    defaults: { ...base, width: 6, depth: 4, height: 3.2, color: '#b7a07a', accent: '#d9b84e' },
  },
  {
    kind: 'trough',
    category: 'livestock',
    label: 'معلف / مشرب',
    description: 'حوض أكل أو ماي للحلال',
    icon: '🪣',
    geometry: 'rect',
    collision: 'structure',
    minSize: 0.4,
    izbaOnly: true,
    defaults: { ...base, width: 3, depth: 0.8, height: 0.6, color: '#9aa3a8', accent: '#6fa8c9' },
  },
  {
    kind: 'worker-room',
    category: 'facilities',
    label: 'غرفة عامل',
    description: 'غرفة سكن للعامل مع حمام — قريبة من الحلال',
    icon: '🛖',
    geometry: 'rect',
    collision: 'structure',
    minSize: 2,
    izbaOnly: true,
    defaults: { ...base, width: 4, depth: 3, height: 2.8, color: '#e6dccb', accent: '#7a5c3e' },
  },
  {
    kind: 'majlis-room',
    category: 'facilities',
    label: 'المجلس',
    description: 'مجلس بناء أو بورتا كابن، مسقوف ومكيف — قلب العزبة',
    icon: '🏠',
    geometry: 'rect',
    collision: 'structure',
    minSize: 3,
    izbaOnly: true,
    defaults: { ...base, width: 10, depth: 6, height: 3.2, color: '#efe6d4', accent: '#8a6a3a' },
  },
  // ——— العزبة: الزراعة والحديقة ———
  {
    kind: 'palm',
    category: 'garden',
    label: 'نخلة',
    description: 'نخلة — قطر السعف تقريباً 5 م',
    icon: '🌴',
    geometry: 'rect',
    collision: 'none',
    minSize: 1,
    izbaOnly: true,
    defaults: { ...base, width: 5, depth: 5, height: 7, color: '#4f7a3a', accent: '#8a6a45' },
  },
  {
    kind: 'tree',
    category: 'garden',
    label: 'شجرة (سدر / غاف)',
    description: 'شجرة ظل',
    icon: '🌳',
    geometry: 'rect',
    collision: 'none',
    minSize: 1,
    izbaOnly: true,
    defaults: { ...base, width: 5, depth: 5, height: 5, color: '#5b7f3f', accent: '#6b4a2b' },
  },
  {
    kind: 'farm-bed',
    category: 'garden',
    label: 'أحواض زراعة',
    description: 'أحواض خضرة مع ري بالتنقيط',
    icon: '🥬',
    geometry: 'rect',
    collision: 'soft',
    minSize: 1,
    izbaOnly: true,
    defaults: { ...base, width: 10, depth: 6, height: 0.3, color: '#7a5a3a', accent: '#5f9a3e' },
  },
  {
    kind: 'greenhouse',
    category: 'garden',
    label: 'بيت محمي',
    description: 'بيت زراعي مقوّس مغطى بالنايلون',
    icon: '🏕️',
    geometry: 'rect',
    collision: 'structure',
    minSize: 3,
    izbaOnly: true,
    defaults: { ...base, width: 9, depth: 20, height: 3.5, color: '#e8f0ec', accent: '#9aa5a0' },
  },
  {
    kind: 'pool',
    category: 'garden',
    label: 'مسبح',
    description: 'مسبح مع ممشى حوله',
    icon: '🏊',
    geometry: 'rect',
    collision: 'structure',
    minSize: 2,
    izbaOnly: true,
    defaults: { ...base, width: 8, depth: 4, height: 0.2, color: '#3fa7d6', accent: '#e9e2d0' },
  },

  // ——— المباني والغرف ———
  {
    kind: 'room',
    category: 'building',
    label: 'غرفة',
    description: 'غرفة بجدران وباب وشبابيك — حط الغرف جنب بعض تصير مبنى، واختار نوعها وتشطيبها',
    icon: '🚪',
    geometry: 'rect',
    collision: 'structure',
    minSize: 1.2,
    izbaOnly: true,
    defaults: { ...base, width: 5, depth: 4, height: 3.2, color: '#e7dcc6', accent: '#f4f4f2', room: makeRoom('majlis') },
  },
  // ——— الأثاث الداخلي ———
  {
    kind: 'sofa-l',
    category: 'interior',
    label: 'جلسة أرضية (L)',
    description: 'جلسة مجلس على الجدار بشكل L مع مساند',
    icon: '🛋️',
    geometry: 'rect',
    collision: 'none',
    minSize: 0.8,
    izbaOnly: true,
    defaults: { ...base, width: 5, depth: 3.5, height: 0.8, color: '#d9c7a3', accent: '#8a6a45' },
  },
  {
    kind: 'tv-unit',
    category: 'interior',
    label: 'مكتبة تلفزيون',
    description: 'وحدة خشب مع شاشة',
    icon: '📺',
    geometry: 'rect',
    collision: 'soft',
    minSize: 0.4,
    izbaOnly: true,
    defaults: { ...base, width: 3, depth: 0.5, height: 2.2, color: '#6b4a2b', accent: '#1d1d1f' },
  },
  {
    kind: 'coffee-table',
    category: 'interior',
    label: 'طاولة قهوة',
    description: 'طاولة وسط المجلس',
    icon: '☕',
    geometry: 'rect',
    collision: 'soft',
    minSize: 0.4,
    izbaOnly: true,
    defaults: { ...base, width: 1.6, depth: 0.9, height: 0.45, color: '#5a3a22', accent: '#c9a26a' },
  },
  {
    kind: 'bed',
    category: 'interior',
    label: 'سرير',
    description: 'سرير مع كوميدينات',
    icon: '🛏️',
    geometry: 'rect',
    collision: 'soft',
    minSize: 0.8,
    izbaOnly: true,
    defaults: { ...base, width: 1.8, depth: 2.1, height: 0.6, color: '#f2efe8', accent: '#8a7a6a' },
  },
  {
    kind: 'wardrobe',
    category: 'interior',
    label: 'دولاب',
    description: 'دولاب ملابس',
    icon: '🚪',
    geometry: 'rect',
    collision: 'soft',
    minSize: 0.4,
    izbaOnly: true,
    defaults: { ...base, width: 2, depth: 0.6, height: 2.4, color: '#e8e2d6', accent: '#b9a88e' },
  },
  {
    kind: 'billiard',
    category: 'interior',
    label: 'طاولة بلياردو',
    description: 'بلياردو مع مساحة اللعب حولها',
    icon: '🎱',
    geometry: 'rect',
    collision: 'soft',
    minSize: 1,
    izbaOnly: true,
    defaults: { ...base, width: 2.6, depth: 1.5, height: 0.85, color: '#2f6fb0', accent: '#5a3a22' },
  },
  {
    kind: 'kitchen-counter',
    category: 'interior',
    label: 'كاونتر مطبخ',
    description: 'كاونتر مع موقد ومغسلة وثلاجة',
    icon: '🍳',
    geometry: 'rect',
    collision: 'soft',
    minSize: 0.5,
    izbaOnly: true,
    defaults: { ...base, width: 3, depth: 0.65, height: 0.9, color: '#e6e1d8', accent: '#3a3a3a' },
  },
  {
    kind: 'bath-set',
    category: 'interior',
    label: 'طقم حمام',
    description: 'مرحاض ومغسلة ودش',
    icon: '🚿',
    geometry: 'rect',
    collision: 'soft',
    minSize: 0.8,
    izbaOnly: true,
    defaults: { ...base, width: 2, depth: 1.6, height: 1, color: '#f4f4f2', accent: '#9fb8c8' },
  },
];

export const CATALOG_BY_KIND: Record<ElementKind, CatalogItem> = Object.fromEntries(
  CATALOG.map((c) => [c.kind, c]),
) as Record<ElementKind, CatalogItem>;

export function catalogOf(kind: ElementKind): CatalogItem {
  return CATALOG_BY_KIND[kind];
}

export function isTentKind(kind: ElementKind): boolean {
  return !!CATALOG_BY_KIND[kind].isTent;
}

export function isLightKind(kind: ElementKind): boolean {
  return !!CATALOG_BY_KIND[kind].isLight;
}

export function isPolyline(kind: ElementKind): boolean {
  return CATALOG_BY_KIND[kind].geometry === 'polyline';
}

export function isPoint(kind: ElementKind): boolean {
  return CATALOG_BY_KIND[kind].geometry === 'point';
}

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

/** ينشئ عنصراً جديداً بالقيم الافتراضية من المكتبة */
export function createElement(
  kind: ElementKind,
  at: Vec2,
  overrides: Partial<PlanElement> = {},
): PlanElement {
  const item = CATALOG_BY_KIND[kind];
  const d = clone(item.defaults);
  const el: PlanElement = {
    id: uid(kind.slice(0, 3)),
    kind,
    name: item.label,
    x: at.x,
    y: at.y,
    rotation: 0,
    locked: false,
    ...d,
  };
  if (item.geometry === 'polyline' && !overrides.points) {
    const len = kind === 'path' ? 6 : 8;
    el.points = [
      { x: at.x - len / 2, y: at.y },
      { x: at.x + len / 2, y: at.y },
    ];
  }
  return { ...el, ...clone(overrides) };
}

/** ألوان سقوف الكيربي المنتشرة في العزب */
export const ROOF_COLORS: { color: string; label: string }[] = [
  { color: '#b8423a', label: 'أحمر' },
  { color: '#2f5f9e', label: 'أزرق' },
  { color: '#e9e7e2', label: 'أبيض' },
  { color: '#9aa0a6', label: 'رمادي' },
  { color: '#4f7a55', label: 'أخضر' },
];
/** العناصر اللي لها سقف يتغير لونه */
export const ROOF_KINDS = new Set<ElementKind>(['room', 'majlis-room', 'worker-room', 'feed-store', 'horse-stable', 'animal-shade', 'sheep-pen', 'camel-pen']);

/** اتجاه القبلة من قطر (تقريباً 255° من الشمال) */
export const QIBLA_BEARING = 255;

/** زاوية الدوران التي تجعل أعلى العنصر يتجه للقبلة */
export function qiblaRotation(northAngle: number): number {
  return (((northAngle + QIBLA_BEARING) % 360) + 360) % 360;
}
