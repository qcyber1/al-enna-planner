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

describe('العنة البحرية', () => {
  it('المجلس قريب من البحر وفيه جلسة تطل عليه بدون تداخلات', () => {
    const land = { ...defaultLand(), surroundings: ['sea', 'open', 'open', 'open'] as ('sea' | 'open')[] };
    const res = generateDesigns(land, { ...DEFAULT_GEN, tents: 3 });
    for (const r of res) {
      const m = r.plan.elements.find((e) => e.kind === 'main-tent' && e.name === 'المجلس الرئيسي')!;
      const sea = r.plan.elements.find((e) => e.name === 'جلسة البحر');
      console.log('بحر:', r.title, 'y المجلس', m.y, 'جلسة', !!sea, 'تنبيهات', r.issues, r.skipped.join('،'));
      // البحر في الجهة الخلفية (y = 0): المجلس في النصف الخلفي
      expect(m.y).toBeLessThan(25);
      expect(sea).toBeTruthy();
      expect(sea!.y).toBeLessThan(m.y);
      expect(r.issues).toBe(0);
    }
  });
});

describe('كشافات الملعب', () => {
  it('كل فكرة فيها ملعب تحصل على 4 كشافات بدون تنبيهات', () => {
    for (const land of [defaultLand(), { ...defaultLand(), surroundings: ['sea', 'open', 'open', 'open'] as ('sea' | 'open')[] }]) {
      for (const r of generateDesigns(land, { ...DEFAULT_GEN, tents: 4 })) {
        if (!r.plan.elements.some((e) => e.kind === 'volleyball')) continue;
        const floods = r.plan.elements.filter((e) => e.kind === 'flood-light').length;
        console.log('كشافات:', r.title, floods, 'تنبيهات', r.issues);
        expect(floods).toBe(4);
        expect(r.issues).toBe(0);
      }
    }
  });
});
