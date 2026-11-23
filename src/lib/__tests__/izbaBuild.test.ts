import { describe, expect, it } from 'vitest';
import { buildIzba } from '../izba';
import { buildProgress, buildTasks } from '../izbaBuild';

describe('متابعة البناء', () => {
  it('الشغل حسب اللي في المخطط', () => {
    const ph = buildTasks(buildIzba('livestock', 1));
    const ids = ph.flatMap((p) => p.tasks.map((t) => t.id));
    expect(ids).toContain('p1-permit');
    expect(ids).toContain('p3-pens');
    expect(ids).not.toContain('p3-pool');
    expect(buildTasks(buildIzba('rest', 1)).flatMap((p) => p.tasks.map((t) => t.id))).toContain('p3-pool');
  });
  it('النسبة والدفعات والمرحلة الحالية', () => {
    const ph = buildTasks(buildIzba('mixed', 1));
    const p1 = ph[0].tasks.map((t) => t.id);
    const pr = buildProgress(ph, { done: p1, payments: [{ id: 'a', at: 0, amount: 50000, note: '' }, { id: 'b', at: 0, amount: 25000, note: '' }] });
    expect(pr.done).toBe(p1.length);
    expect(pr.paid).toBe(75000);
    expect(pr.current?.n).toBe(2);
    expect(buildProgress(ph, undefined).pct).toBe(0);
  });
});
