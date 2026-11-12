import { describe, expect, it } from 'vitest';
import { buildIzba } from '../izba';
import { computeSummary, DEFAULT_ESTIMATE } from '../quantities';
import { izbaRunning, runInputs, suggestWorkers, RUN_DEFAULTS } from '../izbaRunning';

const run = (plan: ReturnType<typeof buildIzba>, prices: Record<string, number> = {}, season: 'summer' | 'winter' = 'summer') =>
  izbaRunning(plan, computeSummary(plan, DEFAULT_ESTIMATE), prices, 500000, season);

describe('المصاريف الشهرية للعزبة', () => {
  it('عزبة حلال: فيها عمال وعلف وماي وكهرباء وبيطري وصيانة، والمجموع = البنود', () => {
    const r = run(buildIzba('livestock', 1));
    const keys = r.lines.map((l) => l.key);
    for (const k of ['workers', 'feed', 'water', 'power', 'vet', 'maint']) expect(keys).toContain(k);
    expect(r.monthly).toBe(r.lines.reduce((t, l) => t + l.monthly, 0));
    expect(r.workers).toBeGreaterThanOrEqual(1);
    expect(r.yearly).toBe(r.monthly * 12);
  });
  it('الشتا أرخص من الصيف، ومتوسط السنة بينهم', () => {
    const p = buildIzba('livestock', 2);
    const sm = run(p, {}, 'summer');
    const w = run(p, {}, 'winter');
    expect(w.monthly).toBeLessThan(sm.monthly);
    expect(sm.yearlyAvg).toBe(w.yearlyAvg);
    expect(sm.yearlyAvg).toBeGreaterThan(w.monthly * 12);
    expect(sm.yearlyAvg).toBeLessThan(sm.monthly * 12);
  });
  it('الاستراحة بدون حلال: ما فيها علف ولا بيطري', () => {
    const r = run(buildIzba('rest', 1));
    expect(r.lines.some((l) => l.key === 'feed' || l.key === 'vet')).toBe(false);
  });
  it('الأرقام اللي يكتبها المستخدم تغلب، وتنبيه لو الحلال أكثر من الحظيرة', () => {
    const p = buildIzba('livestock', 1);
    const base = run(p);
    const r = run(p, { 'run.workers': 3, 'run.salary': 2000, 'run.sheep': base.capacity.sheep + 50 });
    expect(r.workers).toBe(3);
    expect(r.lines.find((l) => l.key === 'workers')!.monthly).toBe(3 * (2000 + RUN_DEFAULTS.workerExtra));
    expect(r.sheep).toBe(base.capacity.sheep + 50);
    expect(r.tips.some((t) => t.level === 'warn' && t.text.includes('الحظاير'))).toBe(true);
    expect(r.lines.find((l) => l.key === 'feed')!.monthly).toBeGreaterThan(base.lines.find((l) => l.key === 'feed')!.monthly);
  });
  it('الديزل أغلى من كهرماء وينصح بالتوصيل', () => {
    const p = buildIzba('family', 2);
    const g = run(p);
    const d = run(p, { 'run.power': 1 });
    expect(d.lines.find((l) => l.key === 'power')!.monthly).toBeGreaterThan(g.lines.find((l) => l.key === 'power')!.monthly);
    expect(runInputs({ 'run.power': 1 }).power).toBe('diesel');
    expect(d.tips.some((t) => t.text.includes('كهرماء'))).toBe(true);
  });
  it('العمال المقترحين يزيدون مع الحلال', () => {
    expect(suggestWorkers(0, 0, 0, 0, 0)).toBe(1);
    expect(suggestWorkers(200, 0, 0, 0, 0)).toBeGreaterThan(suggestWorkers(40, 0, 0, 0, 0));
  });
});
