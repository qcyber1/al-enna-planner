import { describe, expect, it } from 'vitest';
import { generateDesigns, DEFAULT_GEN } from '../generator';
import { defaultLand } from '../sample';

describe('مولّد التصاميم', () => {
  it('يولّد 5 أفكار على أرض 50×50', () => {
    const t0 = Date.now();
    const res = generateDesigns(defaultLand(), { ...DEFAULT_GEN, tents: 5, sleepCabins: 1, kitchenCabins: 1, toilets: 1 });
    console.log('ms', Date.now() - t0);
    expect(res).toHaveLength(5);
    for (const r of res) {
      console.log(r.title, 'عناصر', r.plan.elements.length, 'تنبيهات', r.issues, 'تخطي', r.skipped.join('، '));
      expect(r.plan.elements.some((e) => e.kind === 'main-tent')).toBe(true);
    }
  });
  it('أرض 25×25', () => {
    const land = { ...defaultLand(), width: 25, depth: 25, entrance: { edge: 2, offset: 12.5, width: 4 } };
    const res = generateDesigns(land, { ...DEFAULT_GEN, tents: 2, court: true });
    for (const r of res) console.log('25:', r.title, 'تنبيهات', r.issues, 'تخطي', r.skipped.join('، '));
    expect(res).toHaveLength(5);
  });
});
