import { describe, expect, it } from 'vitest';
import { BUILDING_PRESETS, buildPreset } from '../buildings';
import { emptyPlan } from '../sample';
import { izbaLand } from '../izba';
import { validatePlan } from '../validation';
import { wallPieces } from '../rooms';
import { sanitizeElement } from '../sanitize';

describe('المباني الجاهزة', () => {
  for (const b of BUILDING_PRESETS)
    it(`${b.title}: الغرف متلاصقة والأثاث داخلها بدون تنبيهات`, () => {
      const p = emptyPlan(izbaLand(1));
      p.elements = buildPreset(b.id, 5, 5);
      const v = validatePlan(p);
      if (v.issues.length) console.log(v.issues.map((i) => i.message));
      expect(v.issues).toEqual([]);
      expect(p.elements.filter((e) => e.kind === 'room').length).toBeGreaterThan(2);
    });

  it('الجدار ينقسم حول الباب والشباك', () => {
    const [room] = buildPreset('izba-house', 0, 0);
    const front = wallPieces(room, 'front');
    expect(front.filter((x) => x.kind === 'door')).toHaveLength(1);
    expect(front.filter((x) => x.kind === 'window')).toHaveLength(2);
    const total = front.reduce((s, x) => s + (x.b - x.a), 0);
    expect(total).toBeCloseTo(room.width, 5);
  });

  it('غرفتين متداخلتين فعلاً = تنبيه', () => {
    const p = emptyPlan(izbaLand(1));
    const els = buildPreset('majlis-annex', 5, 5).filter((e) => e.kind === 'room');
    els[1] = { ...els[1], x: els[0].x + 1 };
    p.elements = els;
    expect(validatePlan(p).issues.some((i) => i.code === 'overlap')).toBe(true);
  });

  it('بيانات الغرفة تنحفظ وتنفحص عند الاستيراد', () => {
    const [room] = buildPreset('izba-house', 0, 0);
    const back = sanitizeElement(JSON.parse(JSON.stringify(room)))!;
    expect(back.room).toEqual(room.room);
    const bad = sanitizeElement({ ...room, room: { type: 'x', floor: 'gold', doors: [{ side: 'up', width: 99 }] } })!;
    expect(bad.room!.type).toBe('majlis');
    expect(bad.room!.doors[0]).toEqual({ side: 'front', offset: 0, width: 10 });
  });
});
