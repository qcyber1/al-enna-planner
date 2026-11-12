import { describe, expect, it } from 'vitest';
import { createElement, isCourtKind } from '../catalog';
import { defaultLand, emptyPlan } from '../sample';
import { generateDesigns, DEFAULT_GEN } from '../generator';
import { validatePlan } from '../validation';
import { computeSummary, DEFAULT_ESTIMATE } from '../quantities';

describe('ملعب الكورة الخماسي', () => {
  it('20×10 بمنطقة أمان، وينحسب ملعب', () => {
    const el = createElement('football', { x: 25, y: 25 });
    expect([el.width, el.depth]).toEqual([20, 10]);
    expect(isCourtKind('football')).toBe(true);
    const p = emptyPlan(defaultLand());
    p.elements = [el];
    const s = computeSummary(p, DEFAULT_ESTIMATE);
    expect(s.courts.length).toBe(1);
    expect(s.courtZoneArea).toBeGreaterThan(200);
  });
  it('منطقة الأمان برا السور = تنبيه', () => {
    const p = emptyPlan(defaultLand());
    p.elements = [createElement('football', { x: 10.6, y: 25 })];
    expect(validatePlan(p).issues.some((i) => i.code === 'court-zone-outside')).toBe(true);
  });
  it('المولّد يحط الملعب لما نطلبه', () => {
    const ideas = generateDesigns(defaultLand(), { ...DEFAULT_GEN, football: true });
    const withFb = ideas.filter((r) => r.plan.elements.some((e) => e.kind === 'football'));
    expect(withFb.length).toBeGreaterThanOrEqual(3);
  });
});
