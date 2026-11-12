import { describe, expect, it } from 'vitest';
import { createSamplePlan, defaultLand, emptyPlan } from '../sample';
import { createElement } from '../catalog';
import { genInputFromPlan, generateDesigns } from '../generator';

describe('ولّد من اللي عندي', () => {
  it('يعد الخيام والكباين والملعب من المخطط والمجلس أكبر خيمة', () => {
    const p = emptyPlan(defaultLand());
    p.elements = [
      createElement('small-tent', { x: 5, y: 5 }, { width: 4, depth: 4 }),
      createElement('main-tent', { x: 15, y: 5 }, { width: 11, depth: 6 }),
      createElement('small-tent', { x: 25, y: 5 }, { width: 5, depth: 4 }),
      createElement('small-tent', { x: 35, y: 5 }, { width: 4, depth: 4 }),
      ...[1, 2, 3, 4].map((i) => createElement('sleep-cabin', { x: 5 * i, y: 20 })),
      createElement('volleyball', { x: 20, y: 30 }),
    ];
    const g = genInputFromPlan(p)!;
    expect(g.tents).toBe(4);
    expect(g.sleepCabins).toBe(4);
    expect(g.court).toBe(true);
    expect(g.sizes![0]).toEqual({ w: 11, d: 6 });
    const ideas = generateDesigns(p.land, g);
    const majlis = ideas[0].plan.elements.find((e) => e.kind === 'main-tent')!;
    expect([majlis.width, majlis.depth]).toEqual([11, 6]);
    expect(ideas[0].plan.elements.filter((e) => e.kind === 'sleep-cabin').length).toBe(4);
  });
  it('مخطط فاضي = ما نعبّي شي', () => {
    expect(genInputFromPlan(emptyPlan(defaultLand()))).toBeNull();
    expect(genInputFromPlan(createSamplePlan())!.tents).toBeGreaterThan(0);
  });
});
