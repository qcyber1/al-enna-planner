import type { Land, Plan, PlanElement, Vec2 } from '../types/plan';
import { createElement } from './catalog';
import { uid } from './id';

export function defaultLand(): Land {
  return {
    shape: 'square',
    width: 50,
    depth: 50,
    ground: 'sand',
    northAngle: 0,
    // الضلع الأمامي (2) يبدأ من الزاوية اليمنى السفلية باتجاه اليسار
    entrance: { edge: 2, offset: 25, width: 4 },
    fence: { enabled: true, type: 'fabric', height: 2, color: '#d9c49b' },
  };
}

export function emptyPlan(land: Land = defaultLand()): Plan {
  return { land, elements: [], measurements: [] };
}

/** زاوية الدوران التي تجعل الكشاف موجهاً من نقطة إلى نقطة */
export function aimRotation(from: Vec2, to: Vec2): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const deg = (Math.atan2(-dx, dy) * 180) / Math.PI;
  return Math.round(((deg % 360) + 360) % 360);
}

/**
 * نموذج تجريبي لعنة قطرية على أرض 50 × 50 م (المقاس المعتاد).
 * جميع المقاسات والمواقع افتراضية للتجربة فقط ويمكن تعديلها.
 */
// التوزيع مصمم ثم يُزاح ليتوسط أرض 50 × 50
const SHIFT = { x: 5, y: 10 };

export function createSamplePlan(): Plan {
  const land: Land = { ...defaultLand(), entrance: { edge: 2, offset: 50 - (12.5 + SHIFT.x), width: 4 } };
  const els: PlanElement[] = [];
  const add = (el: PlanElement) => {
    els.push(el);
    return el;
  };

  add(createElement('main-tent', { x: 12.5, y: 6.5 }, { name: 'الخيمة الرئيسية (المجلس)', width: 11, depth: 7 }));
  add(createElement('small-tent', { x: 4, y: 14 }, { name: 'خيمة 1', rotation: 270 }));
  add(createElement('small-tent', { x: 4, y: 20.5 }, { name: 'خيمة 2', rotation: 270, color: '#e6d6b5' }));

  const court = add(createElement('volleyball', { x: 32, y: 15.5 }, { name: 'ملعب الطائرة', rotation: 90 }));

  add(
    createElement('path', { x: 12.5, y: 20 }, {
      name: 'الممر الرئيسي',
      points: [
        { x: 12.5, y: 30 },
        { x: 12.5, y: 10 },
      ],
      path: { material: 'turf', width: 2.4, edgeLights: true, edgeLightSpacing: 3 },
    }),
  );
  add(
    createElement('path', { x: 18.5, y: 18 }, {
      name: 'ممر الملعب (خشب + عشب)',
      points: [
        { x: 12.5, y: 18 },
        { x: 24.5, y: 18 },
      ],
      path: { material: 'wood-turf', width: 2, edgeLights: false, edgeLightSpacing: 3 },
    }),
  );

  add(createElement('canopy', { x: 19.8, y: 13.8 }, { name: 'مظلة الجلسة', width: 5.6, depth: 4.6 }));
  add(createElement('majlis-rug', { x: 19.8, y: 13.8 }, { name: 'جلسة شعبية' }));
  add(createElement('table-set', { x: 17.5, y: 21.8 }, { name: 'طاولة وكراسي' }));
  add(createElement('bbq', { x: 21.5, y: 21.5 }, { name: 'منطقة الشواء' }));

  add(createElement('toilet', { x: 21.2, y: 28.5 }, { name: 'حمام 1', rotation: 180 }));
  add(createElement('toilet', { x: 22.7, y: 28.5 }, { name: 'حمام 2', rotation: 180 }));
  add(createElement('sink', { x: 18.2, y: 28.8 }, { name: 'مغسلة 1', rotation: 180 }));
  add(createElement('sink', { x: 19.6, y: 28.8 }, { name: 'مغسلة 2', rotation: 180 }));
  add(createElement('water-tank', { x: 23.3, y: 25.3 }, { name: 'خزان الماء' }));
  add(createElement('generator', { x: 2.2, y: 1.6 }, { name: 'المولد' }));
  add(createElement('parking', { x: 5, y: 26.75 }, { name: 'مواقف السيارات' }));

  // كشافات الملعب موجهة نحو مركز الملعب
  const center = { x: court.x, y: court.y };
  for (const p of [
    { x: 24.1, y: 9 },
    { x: 24.1, y: 22 },
    { x: 38.6, y: 2.9 },
    { x: 38.6, y: 28.1 },
  ]) {
    add(
      createElement('flood-light', p, {
        name: 'كشاف الملعب',
        rotation: aimRotation(p, center),
      }),
    );
  }

  // أعمدة الإنارة
  add(createElement('light-pole', { x: 6.8, y: 11.2 }, { name: 'عمود إنارة 1' }));
  add(createElement('light-pole', { x: 18.2, y: 11.2 }, { name: 'عمود إنارة 2' }));
  add(createElement('light-pole', { x: 10.8, y: 16 }, { name: 'عمود إنارة 3' }));
  add(createElement('light-pole', { x: 7.6, y: 23.2 }, { name: 'عمود إنارة 4' }));
  add(createElement('light-pole', { x: 15.8, y: 26.2 }, { name: 'عمود إنارة 5' }));

  // سلاسل الليتات
  add(
    createElement('string-lights', { x: 12.5, y: 11.2 }, {
      name: 'سلسلة أمام المجلس',
      points: [
        { x: 6.8, y: 11.2 },
        { x: 18.2, y: 11.2 },
      ],
      height: 3.6,
      light: { on: true, intensity: 100, watts: 1, color: 'warm', mountHeight: 3.6, tilt: 90, beam: 360 },
    }),
  );
  add(
    createElement('string-lights', { x: 19, y: 18 }, {
      name: 'سلسلة ممر الملعب',
      points: [
        { x: 14.2, y: 16.6 },
        { x: 17.5, y: 19.4 },
        { x: 20.8, y: 16.6 },
        { x: 24.1, y: 19.4 },
      ],
      height: 3,
      light: { on: true, intensity: 100, watts: 1, color: 'warm', mountHeight: 3, tilt: 90, beam: 360 },
    }),
  );

  // إنارة المدخل
  add(createElement('entrance-light', { x: 10.1, y: 29.4 }, { name: 'إنارة المدخل 1' }));
  add(createElement('entrance-light', { x: 14.9, y: 29.4 }, { name: 'إنارة المدخل 2' }));

  const mv = (p: Vec2): Vec2 => ({ x: p.x + SHIFT.x, y: p.y + SHIFT.y });
  for (const el of els) {
    el.x += SHIFT.x;
    el.y += SHIFT.y;
    if (el.points) el.points = el.points.map(mv);
  }
  // الممر الرئيسي يبدأ من المدخل عند السور، وإنارة المدخل عند البوابة
  const mainPath = els.find((e) => e.name === 'الممر الرئيسي');
  if (mainPath?.points) mainPath.points[0] = { x: mainPath.points[0].x, y: 50 };
  for (const e of els) if (e.kind === 'entrance-light') e.y = 49.4;
  return {
    land,
    elements: els,
    measurements: [{ id: uid('m'), a: mv({ x: 18, y: 6.5 }), b: mv({ x: 27.5, y: 6.5 }) }],
  };
}
