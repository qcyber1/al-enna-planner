import { describe, expect, it } from 'vitest';
import { buildIzba, izbaLand } from '../izba';
import { emptyPlan } from '../sample';
import { buildPreset } from '../buildings';
import { izbaMaterials, materialRows, MAT } from '../izbaMaterials';

describe('كميات مواد البناء', () => {
  it('السور بس: 50×50 بارتفاع 2.5 ناقص البوابة', () => {
    const p = emptyPlan(izbaLand(1));
    const m = izbaMaterials(p);
    expect(m.fenceM2).toBe(Math.round((200 - 6) * 2.5));
    expect(m.wallM2).toBe(0);
    expect(m.blocks).toBeGreaterThanOrEqual(Math.floor(m.fenceM2 * MAT.blocksPerM2));
    expect(m.cementBags).toBeGreaterThan(0);
  });
  it('مبنى جاهز: جدران وسقف وبلاط وسيراميك وأبواب', () => {
    const p = emptyPlan(izbaLand(1));
    p.elements = buildPreset('izba-house', 10, 10);
    const m = izbaMaterials(p);
    expect(m.roofM2).toBeGreaterThan(200);
    expect(m.wallM2).toBeGreaterThan(150);
    expect(m.wallCeramicM2).toBeGreaterThan(0);
    expect(m.doors).toBeGreaterThanOrEqual(8);
    expect(m.steelTon).toBeGreaterThan(1);
  });
  it('كل القوالب تطلع كميات معقولة والصفوف بدون أصفار', () => {
    for (const u of ['mixed', 'rest', 'family', 'horses'] as const) {
      const m = izbaMaterials(buildIzba(u, 1));
      expect(m.blocks).toBeGreaterThan(5000);
      expect(m.blocks).toBeLessThan(40000);
      const rows = materialRows(m);
      expect(rows.every((r) => !r.value.startsWith('0 '))).toBe(true);
    }
  });
});
