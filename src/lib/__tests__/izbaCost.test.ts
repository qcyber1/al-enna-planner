import { describe, expect, it } from 'vitest';
import { buildIzba } from '../izba';
import { computeSummary, DEFAULT_ESTIMATE } from '../quantities';
import { izbaEstimate } from '../izbaCost';
import { buildPreset } from '../buildings';

describe('تكلفة العزبة التقديرية', () => {
  for (const use of ['mixed', 'livestock', 'rest', 'farm'] as const)
    for (const plots of [1, 4] as const)
      it(`${use} × ${plots}`, () => {
        const plan = buildIzba(use, plots);
        const e = izbaEstimate(plan, computeSummary(plan, DEFAULT_ESTIMATE), {});
        console.log(use, plots, e.total, e.byGroup.map((g) => g.title + ':' + g.total).join(' | '));
        expect(e.total).toBeGreaterThan(50_000);
        expect(e.total).toBeLessThan(3_000_000);
        expect(e.low).toBeLessThan(e.total);
        expect(e.high).toBeGreaterThan(e.total);
        expect(e.lines.some((l) => l.key === 'izba:fence')).toBe(true);
      });

  it('سعر المستخدم يغلب الافتراضي، والمباني تنحسب بالمساحة', () => {
    const plan = buildIzba('rest', 1);
    plan.elements.push(...buildPreset('majlis-annex', 15, 15));
    const s = computeSummary(plan, DEFAULT_ESTIMATE);
    const a = izbaEstimate(plan, s, {});
    const rooms = a.lines.find((l) => l.key === 'izba:rooms')!;
    expect(rooms.qty).toBeGreaterThan(100);
    expect(a.lines.find((l) => l.key === 'izba:rooms-wet')).toBeTruthy();
    const b = izbaEstimate(plan, s, { 'izba:rooms': 1000 });
    const r2 = b.lines.find((l) => l.key === 'izba:rooms')!;
    expect(r2.custom).toBe(true);
    expect(r2.total).toBe(Math.round(rooms.qty * 1000));
    expect(b.total).toBeLessThan(a.total);
  });
});

import { izbaPhases } from '../izbaCost';
describe('مراحل البناء', () => {
  it('مجموع المراحل = الإجمالي تقريباً، والسور بالمرحلة الأولى', () => {
    const plan = buildIzba('mixed', 1);
    const e = izbaEstimate(plan, computeSummary(plan, DEFAULT_ESTIMATE), {});
    const ph = izbaPhases(e);
    expect(ph.length).toBe(3);
    expect(Math.abs(ph.reduce((t, p) => t + p.total, 0) - e.total)).toBeLessThan(5);
    expect(ph[0].items.some((x) => x.includes('السور'))).toBe(true);
    expect(ph[2].items.some((x) => x.includes('حظاير'))).toBe(true);
  });
});
