// كميات مواد البناء للعزبة: البلوك والإسمنت واللياسة والصبغ والبلاط والصبة — من المباني والسور في المخطط
// معدلات تقريبية شائعة (بلوك 40×20×20) للتخطيط وطلب عروض الأسعار — المهندس/المقاول يعتمد الكميات النهائية.
import type { Plan, PlanElement } from '../types/plan';
import { landPolygon, polygonPerimeter } from './geometry';
import { DOOR_H, SILL_H, WIN_TOP, sideLength, SIDES, clampOpening } from './rooms';

export const MAT = {
  /** بلوك 40×20 = 12.5 حبة لكل م² + 5% كسر */
  blocksPerM2: 12.5 * 1.05,
  /** كيس إسمنت 50 كجم لكل ~10 م² بلوك (مونة) */
  cementBlockM2: 10,
  /** كيس إسمنت لكل ~6 م² لياسة (وجه واحد، 1.5 سم) */
  cementPlasterM2: 6,
  /** رمل: م³ لكل م² (مونة + لياسة الوجهين) */
  sandPerM2: 0.06,
  /** صبغ وجهين: لتر لكل 5 م² */
  paintM2PerL: 5,
  /** هدر البلاط والسيراميك */
  tileWaste: 1.1,
  /** سماكة السقف (صبة) */
  slabM: 0.2,
  /** حديد التسليح كجم لكل م³ خرسانة (سقف + أساسات تقريباً) */
  steelKgPerM3: 110,
  /** أساسات السور: م³ خرسانة لكل متر طولي */
  fenceFootingM3: 0.12,
  /** أساسات المباني: م³ لكل م² من مساحة المبنى */
  buildingFootingM3PerM2: 0.12,
} as const;

export interface Materials {
  wallM2: number;
  fenceM2: number;
  blocks: number;
  cementBags: number;
  sandM3: number;
  plasterM2: number;
  paintL: number;
  floorTilesM2: number;
  wallCeramicM2: number;
  roofM2: number;
  concreteM3: number;
  steelTon: number;
  doors: number;
  windows: number;
}

const BOXES = ['majlis-room', 'worker-room', 'feed-store'];

/** مساحة الجدران الصافية لغرفة (ناقص الأبواب والشبابيك) */
function roomWalls(el: PlanElement): { area: number; doors: number; windows: number; openings: number } {
  const h = el.height || 3.2;
  let area = 0;
  let openings = 0;
  let doors = 0;
  let windows = 0;
  for (const side of SIDES) {
    const L = sideLength(el, side);
    area += L * h;
    for (const o of el.room?.doors ?? []) if (o.side === side) {
      const c = clampOpening(o, L);
      if (c) {
        openings += (c.b - c.a) * DOOR_H;
        doors++;
      }
    }
    for (const o of el.room?.windows ?? []) if (o.side === side) {
      const c = clampOpening(o, L);
      if (c) {
        openings += (c.b - c.a) * (WIN_TOP - SILL_H);
        windows++;
      }
    }
  }
  return { area: area - openings, doors, windows, openings };
}

export function izbaMaterials(plan: Plan): Materials {
  const rooms = plan.elements.filter((e) => e.kind === 'room');
  const boxes = plan.elements.filter((e) => BOXES.includes(e.kind));
  let wallM2 = 0;
  let doors = 0;
  let windows = 0;
  let wetFloor = 0;
  let wetWall = 0;
  for (const r of rooms) {
    const w = roomWalls(r);
    // الغرف المتجاورة تشترك بجدار — نخصم تقريباً ربع الجدران
    wallM2 += w.area * 0.85;
    doors += w.doors;
    windows += w.windows;
    if (r.room && (r.room.type === 'bathroom' || r.room.type === 'kitchen')) {
      wetFloor += r.width * r.depth;
      // سيراميك الجدران لين 2.4 م
      wetWall += 2 * (r.width + r.depth) * 2.4;
    }
  }
  for (const b of boxes) {
    const h = b.height || 3.2;
    // المباني الجاهزة (مجلس، غرفة عامل، مخزن): باب وشبابيك تقريبية
    wallM2 += 2 * (b.width + b.depth) * h - (2.2 * 1.8 + 3 * 1.4 * 1.2);
    doors += 1;
    windows += b.kind === 'feed-store' ? 1 : 3;
  }
  const fence = plan.land.fence;
  const perim = fencePerimeter(plan);
  const fenceM2 = fence?.enabled && fence.type === 'block' ? perim * (fence.height || 2.5) : 0;
  const blockM2 = wallM2 + fenceM2;
  const footprint = [...rooms, ...boxes].reduce((t, e) => t + e.width * e.depth, 0);
  // لياسة: المباني من الوجهين، والسور من الوجهين بعد
  const plasterM2 = wallM2 * 2 + fenceM2 * 2;
  const roofM2 = footprint;
  const concreteM3 = roofM2 * MAT.slabM + footprint * MAT.buildingFootingM3PerM2 + (fenceM2 ? perim * MAT.fenceFootingM3 : 0);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    wallM2: Math.round(wallM2),
    fenceM2: Math.round(fenceM2),
    blocks: Math.ceil((blockM2 * MAT.blocksPerM2) / 10) * 10,
    cementBags: Math.ceil(blockM2 / MAT.cementBlockM2 + plasterM2 / MAT.cementPlasterM2),
    sandM3: r1(blockM2 * MAT.sandPerM2 + plasterM2 * 0.02),
    plasterM2: Math.round(plasterM2),
    paintL: Math.ceil((wallM2 * 2) / MAT.paintM2PerL),
    floorTilesM2: Math.ceil(footprint * 0.88 * MAT.tileWaste),
    wallCeramicM2: Math.ceil(wetWall * MAT.tileWaste),
    roofM2: Math.round(roofM2),
    concreteM3: r1(concreteM3),
    steelTon: r1((concreteM3 * MAT.steelKgPerM3) / 1000),
    doors,
    windows,
  };
}

/** طول السور = محيط الأرض ناقص البوابة */
function fencePerimeter(plan: Plan): number {
  return Math.max(0, polygonPerimeter(landPolygon(plan.land)) - (plan.land.entrance?.width ?? 0));
}

/** كم وحدة من كل شي — للعرض والتقرير */
export function materialRows(m: Materials): { icon: string; label: string; value: string; hint?: string }[] {
  const n = (v: number) => Math.round(v).toLocaleString('en-US');
  const rows: { icon: string; label: string; value: string; hint?: string }[] = [
    { icon: '🧱', label: 'بلوك 40×20', value: `${n(m.blocks)} حبة`, hint: `جدران ${n(m.wallM2)} م²${m.fenceM2 ? ` + سور ${n(m.fenceM2)} م²` : ''}` },
    { icon: '🪨', label: 'إسمنت (كيس 50 كجم)', value: `${n(m.cementBags)} كيس`, hint: 'للبلوك واللياسة' },
    { icon: '⏳', label: 'رمل', value: `${m.sandM3} م³` },
    { icon: '🧽', label: 'لياسة', value: `${n(m.plasterM2)} م²`, hint: 'الوجهين' },
    { icon: '🏗️', label: 'خرسانة (سقف + أساسات)', value: `${m.concreteM3} م³`, hint: `سقف ${n(m.roofM2)} م²` },
    { icon: '🔩', label: 'حديد تسليح', value: `${m.steelTon} طن` },
    { icon: '🟫', label: 'بلاط أرضيات', value: `${n(m.floorTilesM2)} م²`, hint: 'مع 10% هدر' },
    { icon: '🚿', label: 'سيراميك جدران (حمامات ومطابخ)', value: `${n(m.wallCeramicM2)} م²` },
    { icon: '🎨', label: 'صبغ (وجهين)', value: `${n(m.paintL)} لتر` },
    { icon: '🚪', label: 'أبواب / شبابيك', value: `${m.doors} / ${m.windows}` },
  ];
  return rows.filter((r) => !/^0 |^0\.0 |^0 \/ 0$/.test(r.value));
}
