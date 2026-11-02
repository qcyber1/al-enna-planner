import { describe, expect, it } from 'vitest';
import { createSamplePlan } from '../sample';
import { createElement } from '../catalog';
import { bestEntranceSide, sideBearing, windNotes } from '../wind';

describe('ريح الشمال', () => {
  it('اتجاهات الأضلاع صحيحة مع زاوية الشمال', () => {
    const el = { rotation: 0 };
    expect(Math.round(sideBearing(el, 'front', 0))).toBe(180);
    expect(Math.round(sideBearing(el, 'back', 0))).toBe(0);
    expect(Math.round(sideBearing(el, 'right', 0))).toBe(90);
    // الشمال لليمين ← أسفل المخطط = الشرق
    expect(Math.round(sideBearing(el, 'front', 90))).toBe(90);
  });

  it('المثال الجاهز بدون ملاحظات ريح', () => {
    expect(windNotes(createSamplePlan())).toHaveLength(0);
  });

  it('خيمة مدخلها للشمال تطلع ملاحظة واقتراح الجنوب', () => {
    const plan = createSamplePlan();
    const t = createElement('small-tent', { x: 20, y: 20 });
    t.tent!.entranceSide = 'back';
    plan.elements.push(t);
    const notes = windNotes(plan);
    expect(notes).toHaveLength(1);
    expect(notes[0].bestSide).toBe('front');
    expect(notes[0].message).toContain('الشمال');
    expect(bestEntranceSide(t, 0)).toBe('front');
  });
});

import { generateDesigns, DEFAULT_GEN } from '../generator';
import { defaultLand } from '../sample';

describe('المولّد يحترم ريح الشمال', () => {
  it('كل الأفكار بدون مداخل بوجه الريح مهما كان اتجاه الشمال', () => {
    for (const na of [0, 90, 180, 270]) {
      for (const r of generateDesigns({ ...defaultLand(), northAngle: na }, { ...DEFAULT_GEN, tents: 5 })) {
        expect(windNotes(r.plan)).toHaveLength(0);
        expect(r.issues).toBe(0);
      }
    }
  });
});
