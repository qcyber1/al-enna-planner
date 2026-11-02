import type { Plan, PlanElement, Side, Vec2 } from '../types/plan';
import { rotate } from './geometry';

/**
 * الريح السائدة في قطر شتاءً: «الشمال» — تهب من الشمال/الشمال الغربي.
 * الاتجاه هنا اتجاه المصدر (من وين تهب) بالدرجات من الشمال مع عقارب الساعة.
 */
export const WIND_FROM = 330;
/** إذا كان المدخل ضمن هذا الفرق من مصدر الريح نعتبره «يواجه الريح» */
export const WIND_TOLERANCE = 50;

const SIDES: Side[] = ['front', 'back', 'left', 'right'];
const LOCAL: Record<Side, Vec2> = {
  front: { x: 0, y: 1 },
  back: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const COMPASS = ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'];

/** اسم الجهة الجغرافية لزاوية (0 = شمال) */
export function compassName(bearing: number): string {
  const b = ((bearing % 360) + 360) % 360;
  return COMPASS[Math.round(b / 45) % 8];
}

/** الفرق الزاوي بين اتجاهين (0..180) */
export function angleDiff(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/** الاتجاه الجغرافي الذي يطالع عليه ضلع من أضلاع العنصر */
export function sideBearing(el: Pick<PlanElement, 'rotation'>, side: Side, northAngle: number): number {
  const v = rotate(rotate(LOCAL[side], el.rotation), -northAngle);
  const deg = (Math.atan2(v.x, -v.y) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export interface WindNote {
  elementId: string;
  name: string;
  /** الجهة التي يطالع عليها المدخل الحالي */
  facing: string;
  bestSide: Side;
  bestFacing: string;
  message: string;
}

/** أفضل ضلع للمدخل: الأبعد عن مصدر الريح */
export function bestEntranceSide(el: Pick<PlanElement, 'rotation'>, northAngle: number): Side {
  let best: Side = 'front';
  let bestD = -1;
  for (const s of SIDES) {
    const d = angleDiff(sideBearing(el, s, northAngle), WIND_FROM);
    if (d > bestD + 1e-6) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** ملاحظات معلوماتية (مو أخطاء): خيام مداخلها تواجه ريح الشمال */
export function windNotes(plan: Plan): WindNote[] {
  const out: WindNote[] = [];
  const na = plan.land.northAngle;
  for (const el of plan.elements) {
    if (!el.tent) continue;
    const b = sideBearing(el, el.tent.entranceSide, na);
    if (angleDiff(b, WIND_FROM) > WIND_TOLERANCE) continue;
    const bestSide = bestEntranceSide(el, na);
    if (bestSide === el.tent.entranceSide) continue;
    const facing = compassName(b);
    const bestFacing = compassName(sideBearing(el, bestSide, na));
    out.push({
      elementId: el.id,
      name: el.name,
      facing,
      bestSide,
      bestFacing,
      message: `مدخل «${el.name}» يطالع ${facing} — بوجه ريح الشمال والغبار. الأفضل يكون المدخل جهة ${bestFacing}.`,
    });
  }
  return out;
}
