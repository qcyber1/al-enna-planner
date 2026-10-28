import { describe, expect, it } from 'vitest';
import { createSamplePlan } from '../sample';
import { validatePlan } from '../validation';
import { computeSummary, pathQuantity } from '../quantities';
import { createElement } from '../catalog';
import { sanitizePlan, parseImport, ImportError } from '../sanitize';

describe('النموذج التجريبي', () => {
  it('لا يحتوي على تنبيهات', () => {
    const v = validatePlan(createSamplePlan());
    expect(v.issues.map((i) => i.message)).toEqual([]);
  });
});

describe('الحسابات', () => {
  it('ممر 2 × 12 م = 24 م²', () => {
    const p = createElement('path', { x: 0, y: 0 }, { points: [{ x: 0, y: 0 }, { x: 12, y: 0 }], path: { material: 'turf', width: 2, edgeLights: false, edgeLightSpacing: 3 } });
    expect(pathQuantity(p).area).toBeCloseTo(24);
  });
  it('ملخص المثال', () => {
    const s = computeSummary(createSamplePlan());
    expect(s.landArea).toBe(2500);
    expect(s.tentCount).toBe(3);
    expect(s.courtArea).toBe(162);
    expect(s.toilets).toBe(2);
    expect(s.sinks).toBe(2);
    expect(s.woodTurf.totalBeams).toBeGreaterThan(0);
    expect(s.freeArea).toBeGreaterThan(0);
  });
});

describe('التنبيهات', () => {
  it('خيمة فوق الملعب وخارج الحدود', () => {
    const plan = createSamplePlan();
    plan.elements.push(createElement('small-tent', { x: 37, y: 25 }));
    plan.elements.push(createElement('main-tent', { x: 49, y: 2 }));
    const v = validatePlan(plan);
    expect(v.issues.some((i) => i.code === 'court-overlap')).toBe(true);
    expect(v.issues.some((i) => i.code === 'out-of-bounds')).toBe(true);
  });
});

describe('الاستيراد', () => {
  it('يرفض JSON غير صالح', () => {
    expect(() => parseImport('not json')).toThrow(ImportError);
    expect(() => parseImport('{"a":1}')).toThrow(ImportError);
  });
  it('ينظف العناصر غير الصالحة', () => {
    const plan = sanitizePlan({ land: { width: 'x' }, elements: [{ kind: 'nope' }, { kind: 'toilet', x: 3, y: 4 }] });
    expect(plan.land.width).toBe(50);
    expect(plan.elements.length).toBe(1);
  });
});
