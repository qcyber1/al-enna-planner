import { describe, expect, it } from 'vitest';
import { sketchToLand } from '../../components/SketchDialog';
import { defaultLand } from '../sample';

describe('أرضي من الكروكي', () => {
  it('البكسلات تصير أمتار، والصورة تنحط تحت الأرض بالضبط', () => {
    // أرض على شكل L: 100 بكسل = 50 م
    const px = [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 200 }, { x: 200, y: 200 }, { x: 200, y: 300 }, { x: 100, y: 300 }];
    const r = sketchToLand(defaultLand(), px, 0.5);
    expect(r.land.shape).toBe('polygon');
    expect(r.land.width).toBe(100);
    expect(r.land.depth).toBe(100);
    expect(r.land.polygon![0]).toEqual({ x: 0, y: 0 });
    expect(r.land.polygon![2]).toEqual({ x: 100, y: 50 });
    // الصورة: بكسل (100،100) يطيح على (0،0)
    expect(r.underlay.x + 100 * r.underlay.scale).toBeCloseTo(0);
    expect(r.land.entrance.edge).toBe(0);
  });
});
