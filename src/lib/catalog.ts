import type {
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

export type Category = 'tents' | 'facilities' | 'paths' | 'lighting' | 'furniture';
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
}

export const CATEGORY_LABELS: Record<Category, string> = {
  tents: 'الخيام',
  facilities: 'المرافق',
  paths: 'الممرات',
  lighting: 'الإنارة',
  furniture: 'الجلسات والأثاث',
};

export const CATEGORY_ORDER: Category[] = ['tents', 'facilities', 'paths', 'lighting', 'furniture'];

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
