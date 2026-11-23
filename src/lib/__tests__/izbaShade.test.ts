import { describe, expect, it } from 'vitest';
import { createElement } from '../catalog';
import { emptyPlan } from '../sample';
import { penShade, shadeFix } from '../izbaShade';
import { herdGroup } from '../izbaQuick';

describe('ظل الحلال', () => {
  it('حظيرة كبيرة مظلتها ما تكفي ← الإصلاح يكمّل الظل', () => {
    const p = emptyPlan();
    p.elements.push(createElement('sheep-pen', { x: 25, y: 25 }, { width: 16, depth: 12 }));
    const [s] = penShade(p);
    expect(s.heads).toBe(96);
    expect(s.ok).toBe(false);
    const fix = shadeFix(p, s.id)!;
    expect(fix.kind).toBe('animal-shade');
    p.elements.push(fix);
    expect(penShade(p)[0].ok).toBe(true);
  });
  it('«أضف حلالك» يحط ظل يكفي من البداية', () => {
    const g = herdGroup({ sheep: 120, camels: 10, horses: 0, feed: true, worker: false });
    const plan = { ...emptyPlan(), elements: g.els };
    expect(penShade(plan).every((x) => x.ok)).toBe(true);
  });
});
