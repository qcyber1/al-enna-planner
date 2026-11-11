import { describe, expect, it } from 'vitest';
import { BUILDING_PRESETS, buildPreset } from '../buildings';
import { emptyPlan } from '../sample';
import { izbaLand } from '../izba';
import { validatePlan } from '../validation';

describe('المباني الجاهزة', () => {
  for (const b of BUILDING_PRESETS)
    it(`${b.title}: بدون تداخلات وداخل المقاس المكتوب`, () => {
      const p = emptyPlan(izbaLand(1));
      p.elements = buildPreset(b.id, 10, 10);
      const v = validatePlan(p);
      if (v.issues.length) console.log(b.id, v.issues.map((i) => i.message));
      expect(v.issues).toEqual([]);
      const rooms = p.elements.filter((e) => e.kind === 'room');
      const maxX = Math.max(...rooms.map((r) => r.x + r.width / 2)) - 10;
      const maxY = Math.max(...rooms.map((r) => r.y + r.depth / 2)) - 10;
      expect(maxX).toBeLessThanOrEqual(b.width + 0.01);
      expect(maxY).toBeLessThanOrEqual(b.depth + 0.01);
    });
});
