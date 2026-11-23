import { describe, expect, it } from 'vitest';
import { createElement } from '../catalog';
import { emptyPlan } from '../sample';
import { permitFacts } from '../izbaPermit';

describe('قبل الرخصة', () => {
  it('المسافة للسور والمساحة', () => {
    const p = emptyPlan();
    p.elements.push(createElement('room', { x: 10, y: 10 }, { width: 8, depth: 6 }));
    p.elements.push(createElement('sheep-pen', { x: 40, y: 40 }, { width: 10, depth: 6 }));
    const f = permitFacts(p);
    expect(f.builtArea).toBe(48);
    expect(f.closestBuilding!.m).toBe(6);
    expect(f.closestPen!.m).toBe(5);
    expect(f.buildings).toBe(1);
  });
});
