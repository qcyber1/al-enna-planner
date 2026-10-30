// نموذج البيانات الموحد للمخطط — يستخدمه المحرر ثنائي الأبعاد والمشهد ثلاثي الأبعاد معاً.
// جميع القياسات بالمتر، والزوايا بالدرجات (مع عقارب الساعة في المسقط العلوي).
// نظام الإحداثيات: x لليمين، y للأسفل (أسفل المسقط = الجهة الأمامية/المدخل افتراضياً).

export const SCHEMA_VERSION = 1;

export interface Vec2 {
  x: number;
  y: number;
}

export type GroundType = 'sand' | 'soil' | 'flat';
export type LandShape = 'rectangle' | 'square' | 'polygon';
export type FenceType = 'fabric' | 'mesh' | 'block';

export interface LandEntrance {
  /** رقم ضلع حدود الأرض (للمستطيل: 0 خلفي، 1 أيمن، 2 أمامي، 3 أيسر) */
  edge: number;
  /** موقع منتصف المدخل بالمتر من بداية الضلع */
  offset: number;
  width: number;
}

export interface Fence {
  enabled: boolean;
  type: FenceType;
  height: number;
  color: string;
}

export interface Land {
  shape: LandShape;
  /** الطول على المحور الأفقي (x) */
  width: number;
  /** العرض على المحور الرأسي (y) */
  depth: number;
  /** رؤوس الأرض للأشكال غير المنتظمة (اختياري) */
  polygon?: Vec2[];
  ground: GroundType;
  /** اتجاه الشمال بالدرجات: 0 = أعلى المخطط */
  northAngle: number;
  entrance: LandEntrance;
  fence: Fence;
  /** ما يحيط بالأرض لكل ضلع (للمستطيل: 0 خلف، 1 يمين، 2 أمام، 3 يسار) */
  surroundings?: Surround[];
}

export type Surround = 'open' | 'dunes' | 'hazm' | 'sea';

export type ElementKind =
  | 'main-tent'
  | 'small-tent'
  | 'dining-tent'
  | 'kitchen-tent'
  | 'canopy'
  | 'majlis-rug'
  | 'volleyball'
  | 'toilet'
  | 'sink'
  | 'outdoor-kitchen'
  | 'storage'
  | 'parking'
  | 'water-tank'
  | 'generator'
  | 'bbq'
  | 'table-set'
  | 'seating'
  | 'path'
  | 'light-pole'
  | 'flood-light'
  | 'string-lights'
  | 'ground-light'
  | 'entrance-light'
  | 'lantern'
  | 'sleep-cabin'
  | 'kitchen-cabin'
  | 'fire-pit'
  | 'prayer-area'
  | 'screen'
  | 'kids-area'
  | 'partition';

export type TentStyle = 'majlis' | 'bedouin' | 'pyramid';
export type Side = 'front' | 'back' | 'left' | 'right';
export type TentInterior = 'majlis' | 'dining' | 'kitchen' | 'empty';

export interface TentProps {
  style: TentStyle;
  wallHeight: number;
  entranceSide: Side;
  /** إزاحة المدخل عن منتصف الضلع بالمتر */
  entranceOffset: number;
  entranceWidth: number;
  interior: TentInterior;
  interiorLight: boolean;
  entranceLight: boolean;
}

export type CourtSurface = 'sand' | 'turf';

export interface CourtProps {
  surface: CourtSurface;
  safetyMargin: number;
  netHeight: number;
  attackLines: boolean;
}

export type PathMaterial = 'turf' | 'wood-turf' | 'tiles' | 'sand' | 'stone';

export interface PathProps {
  material: PathMaterial;
  width: number;
  edgeLights: boolean;
  edgeLightSpacing: number;
}

export type LightColor = 'warm' | 'white';

export interface LightProps {
  on: boolean;
  /** شدة الإضاءة كنسبة مئوية من القدرة الكاملة */
  intensity: number;
  /** القدرة التقديرية بالواط (LED) */
  watts: number;
  color: LightColor;
  /** ارتفاع التركيب بالمتر */
  mountHeight: number;
  /** زاوية الميل للأسفل بالدرجات (للكشافات) */
  tilt: number;
  /** زاوية انتشار الحزمة بالدرجات */
  beam: number;
}

export interface StringLightProps {
  sag: number;
  bulbSpacing: number;
  /** رسم أعمدة تثبيت تلقائياً عند النقاط غير المرتبطة بعمود */
  autoPoles: boolean;
}

export interface ParkingProps {
  slots: number;
  showCars: boolean;
}

export interface FurnitureProps {
  seats: number;
}

export interface PlanElement {
  id: string;
  kind: ElementKind;
  name: string;
  /** مركز العنصر (للعناصر المستطيلة والنقطية) */
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  color: string;
  accent: string;
  locked: boolean;
  allowOutside?: boolean;
  /** نقاط الخط للممرات وسلاسل الليتات (إحداثيات مطلقة) */
  points?: Vec2[];
  tent?: TentProps;
  court?: CourtProps;
  path?: PathProps;
  light?: LightProps;
  string?: StringLightProps;
  parking?: ParkingProps;
  furniture?: FurnitureProps;
  notes?: string;
}

export interface Measurement {
  id: string;
  a: Vec2;
  b: Vec2;
}

export interface Plan {
  land: Land;
  elements: PlanElement[];
  measurements: Measurement[];
}

export interface Design {
  id: string;
  name: string;
  note?: string;
  plan: Plan;
  createdAt: number;
  updatedAt: number;
}

export interface EstimateSettings {
  /** طول قطعة الخشب بالمتر (افتراضي 3 م) */
  beamLength: number;
  /** مقطع الخشب (للعرض فقط) */
  beamSection: string;
  /** المسافة بين الأخشاب الطولية */
  beamSpacing: number;
  sheetWidth: number;
  sheetLength: number;
  /** نسبة الهدر % */
  wastePct: number;
  turfRollWidth: number;
}

export interface Project {
  schema: number;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  designs: Design[];
  activeDesignId: string;
  finalDesignId?: string;
  /** أسعار الوحدات التي يدخلها المستخدم (لا توجد أسعار افتراضية) */
  prices: Record<string, number>;
  estimate?: EstimateSettings;
}

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  designCount: number;
}

export type ViewMode = '2d' | '3d' | 'split';
export type TimeOfDay = 'day' | 'sunset' | 'night';
export type Tool = 'select' | 'pan' | 'path' | 'string-lights' | 'measure';
export type CameraPreset = 'orbit' | 'top' | 'oblique' | 'human' | 'entrance' | 'main-tent' | 'walk';
