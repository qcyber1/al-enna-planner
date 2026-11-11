import { describe, expect, it } from 'vitest';
import { buildIzba } from '../izba';
import { izbaIrrigation, mstLength, IRR } from '../irrigation';
import { createElement } from '../catalog';
import { emptyPlan } from '../sample';
import { izbaLand } from '../izba';

describe('شبكة الري', () => {
  it('أقصر شبكة: نقاط على خط واحد = المسافة بين الأطراف', () => {
    expect(mstLength([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }])).toBe(10);
    expect(mstLength([{ x: 0, y: 0 }])).toBe(0);
  });
  it('نخلتين وخزان: النقاطات والماي والمضخة', () => {
    const p = emptyPlan(izbaLand(1));
    p.elements = [createElement('water-tank', { x: 0, y: 0 }), createElement('palm', { x: 10, y: 0 }), createElement('palm', { x: 20, y: 0 })];
    const r = izbaIrrigation(p);
    expect(r.hasTank).toBe(true);
    expect(r.palms).toBe(2);
    expect(r.drippers).toBe(2 * IRR.palmDrippers);
    expect(r.dailyL).toBe(2 * IRR.palmL);
    expect(r.mainM).toBe(Math.round(20 * 1.15));
    expect(r.zones).toBe(1);
    expect(r.pumpHp).toBeGreaterThan(0);
    expect(r.minutesPerDay).toBe(Math.round((400 / (2 * 4 * 8)) * 60));
  });
  it('قوالب الزراعة والاستراحة فيها شبكة ري، والزونات تتقسم لما يكبر التدفق', () => {
    const farm = izbaIrrigation(buildIzba('farm', 4));
    expect(farm.mainM).toBeGreaterThan(50);
    expect(farm.zones).toBeGreaterThan(1);
    expect(izbaIrrigation(buildIzba('rest', 1)).sprinklers).toBeGreaterThan(0);
  });
});
