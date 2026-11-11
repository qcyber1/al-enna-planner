import { describe, expect, it } from 'vitest';
import { createSamplePlan as samplePlan } from '../sample';
import { computePower, pickCable, sanitizePower, suggestAppliances } from '../power';
import { createElement } from '../catalog';

describe('كهرباء العنة', () => {
  it('المخطط النموذجي: حمل ومولد وديزل وكيابل', () => {
    const plan = samplePlan();
    const w = computePower(plan, { season: 'winter' });
    const s = computePower(plan, { season: 'summer' });
    expect(w.lines.length).toBeGreaterThan(0);
    expect(w.peakKw).toBeGreaterThan(0);
    expect(w.generatorKva).toBeGreaterThan(0);
    expect(s.generatorKva).toBeGreaterThanOrEqual(10);
    expect(w.litersPerNight).toBeGreaterThan(0);
    if (w.generator) expect(w.cableByMm2.length).toBeGreaterThan(0);
  });

  it('المكيف ما ينحسب بالشتا والدفاية ما تنحسب بالصيف', () => {
    const tent = createElement('main-tent', { x: 20, y: 20 }, { width: 10, depth: 6 });
    expect(suggestAppliances(tent, 'summer').ac).toBe(4);
    expect(suggestAppliances(tent, 'winter').heater).toBe(3);
    const plan = { ...samplePlan(), elements: [tent, createElement('generator', { x: 2, y: 2 })] };
    const both = { [tent.id]: { ac: 2, heater: 2 } };
    const w = computePower(plan, { season: 'winter', appliances: both });
    const s = computePower(plan, { season: 'summer', appliances: both });
    expect(w.lines[0].watts).toBe(4000);
    expect(s.lines[0].watts).toBe(3600);
  });

  it('الكيبل: أكبر كل ما زاد التيار أو بعدت المسافة', () => {
    expect(pickCable(8, 20).mm2).toBe(2.5);
    expect(pickCable(30, 20).mm2).toBe(4);
    expect(pickCable(30, 60).mm2!).toBeGreaterThan(4);
    expect(pickCable(200, 50).mm2).toBeNull();
  });

  it('تنبيهات: مولد قريب من الخيمة وصغير، وبدون خزان ديزل', () => {
    const tent = createElement('main-tent', { x: 10, y: 10 }, { width: 10, depth: 6, name: 'المجلس' });
    const gen = createElement('generator', { x: 10, y: 16 });
    const plan = { ...samplePlan(), elements: [tent, gen] };
    const r = computePower(plan, { season: 'summer', generatorKva: 5 });
    expect(r.warnings.some((x) => x.includes('قريب من «المجلس»'))).toBe(true);
    expect(r.warnings.some((x) => x.includes('أصغر من الحاجة'))).toBe(true);
    expect(r.warnings.some((x) => x.includes('خزان ديزل'))).toBe(true);
  });

  it('تنظيف الإعدادات المستوردة', () => {
    const p = sanitizePower({ season: 'summer', hours: 99, appliances: { a: { ac: 3, hack: 5 } } })!;
    expect(p.season).toBe('summer');
    expect(p.hours).toBe(24);
    expect(p.appliances.a).toEqual({ ac: 3 });
    expect(sanitizePower('x')).toBeUndefined();
  });
});
