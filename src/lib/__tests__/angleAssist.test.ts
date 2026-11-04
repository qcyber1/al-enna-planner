import { describe, expect, it } from 'vitest';
import { assistAngle, circlePoints } from '../angleAssist';

describe('assistAngle', () => {
  it('يعدّل الخط المايل شوي لأفقي', () => {
    const r = assistAngle([{ x: 0, y: 0 }], { x: 10, y: 0.6 }, []);
    expect(r.snapped).toBe('straight');
    expect(r.p.y).toBeCloseTo(0, 3);
    expect(r.p.x).toBeCloseTo(Math.hypot(10, 0.6), 2);
  });
  it('يعطي زاوية قائمة مع الضلع السابق', () => {
    const r = assistAngle([{ x: 0, y: 0 }, { x: 10, y: 0 }], { x: 10.7, y: 8 }, []);
    expect(r.turn).toBe(90);
    expect(r.p.x).toBeCloseTo(10, 3);
  });
  it('يتبع اتجاه سور الأرض المايل', () => {
    const r = assistAngle([{ x: 0, y: 0 }], { x: 10, y: 3.3 }, [20]);
    expect(r.snapped).toBe('land');
    expect(r.angle).toBe(20);
  });
  it('ما يغيّر الزاوية البعيدة عن أي مرجع', () => {
    const r = assistAngle([{ x: 0, y: 0 }], { x: 10, y: 6.5 }, []);
    expect(r.snapped).toBeNull();
  });
  it('الدائرة مغلقة وبنفس نصف القطر', () => {
    const pts = circlePoints({ x: 5, y: 5 }, 3);
    expect(pts[0]).toEqual(pts[pts.length - 1]);
    for (const p of pts) expect(Math.hypot(p.x - 5, p.y - 5)).toBeCloseTo(3, 2);
  });
});
