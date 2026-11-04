import { describe, expect, it } from 'vitest';
import { emptyPlan, createSamplePlan } from '../sample';
import { createElement } from '../catalog';
import { validatePlan } from '../validation';
import { fixAll, fixIssue } from '../autofix';

describe('أصلحها تلقائياً', () => {
  it('يفك التداخل بين خيمتين ويحرك الأصغر', () => {
    const p = emptyPlan();
    const big = createElement('main-tent', { x: 25, y: 25 });
    const small = createElement('small-tent', { x: 26, y: 25 });
    const plan = { ...p, elements: [big, small] };
    const issue = validatePlan(plan).issues.find((i) => i.code === 'overlap')!;
    expect(issue).toBeTruthy();
    const f = fixIssue(plan, issue)!;
    expect(f.id).toBe(small.id);
    const after = { ...plan, elements: plan.elements.map((e) => (e.id === f.id ? { ...e, ...f.patch } : e)) };
    expect(validatePlan(after).issues.filter((i) => i.elementIds.includes(small.id))).toHaveLength(0);
    expect(f.moved).toBeLessThan(15);
  });
  it('يرجّع العنصر اللي طالع برا السور', () => {
    const p = emptyPlan();
    const t = createElement('small-tent', { x: -3, y: 10 });
    const plan = { ...p, elements: [t] };
    const issue = validatePlan(plan).issues.find((i) => i.code === 'out-of-bounds')!;
    const f = fixIssue(plan, issue)!;
    const after = { ...plan, elements: [{ ...t, ...f.patch }] };
    expect(validatePlan(after).issues).toHaveLength(0);
  });
  it('ما يحرك المقفل', () => {
    const p = emptyPlan();
    const a = { ...createElement('small-tent', { x: 20, y: 20 }), locked: true };
    const b = { ...createElement('small-tent', { x: 20.5, y: 20 }), locked: true };
    const plan = { ...p, elements: [a, b] };
    expect(fixIssue(plan, validatePlan(plan).issues[0])).toBeNull();
  });
  it('أصلح الكل يقلل التنبيهات', () => {
    const s = createSamplePlan();
    const extra = createElement('small-tent', { x: s.elements[0].x, y: s.elements[0].y });
    const plan = { ...s, elements: [...s.elements, extra] };
    const before = validatePlan(plan).issues.length;
    const r = fixAll(plan);
    expect(r.fixed).toBeGreaterThan(0);
    expect(r.left).toBeLessThan(before);
  });
});

describe('أصلحها يحرك المختار', () => {
  it('لو مختار العنصر الكبير يحركه هو', () => {
    const p = emptyPlan();
    const big = createElement('main-tent', { x: 25, y: 25 });
    const small = createElement('small-tent', { x: 26, y: 25 });
    const plan = { ...p, elements: [big, small] };
    const issue = validatePlan(plan).issues.find((i) => i.code === 'overlap')!;
    expect(fixIssue(plan, issue, 25, big.id)!.id).toBe(big.id);
  });
});
