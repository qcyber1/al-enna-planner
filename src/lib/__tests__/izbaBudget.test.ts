import { describe, expect, it } from 'vitest';
import { buildIzba } from '../izba';
import { computeSummary, DEFAULT_ESTIMATE } from '../quantities';
import { budgetFit, izbaEstimate } from '../izbaCost';

const est = () => {
  const p = buildIzba('mixed', 2);
  return izbaEstimate(p, computeSummary(p, DEFAULT_ESTIMATE), {});
};

describe('ميزانيتي', () => {
  it('ميزانية كبيرة: كل العزبة', () => {
    const e = est();
    const f = budgetFit(e, e.total + 1000);
    expect(f.all).toBe(true);
    expect(f.phases.every((p) => p.status === 'in')).toBe(true);
  });
  it('ميزانية تكفي المرحلة الأولى بس: الثانية جزئية واللي بعدها بعدين', () => {
    const e = est();
    const f0 = budgetFit(e, 1e9);
    const b = f0.phases[0].total + 5000;
    const f = budgetFit(e, b);
    expect(f.all).toBe(false);
    expect(f.phases[0].status).toBe('in');
    expect(f.phases[1].status).toBe('partial');
    expect(f.left).toBe(5000);
    expect(f.shortfall).toBe(e.total - b);
    expect(f.startWith.reduce((t, x) => t + x.total, 0)).toBeLessThanOrEqual(5000);
  });
  it('ميزانية صغيرة جداً: ولا مرحلة', () => {
    const f = budgetFit(est(), 1000);
    expect(f.phases.some((p) => p.status === 'in')).toBe(false);
    expect(f.phases[0].status).toBe('partial');
  });
});
