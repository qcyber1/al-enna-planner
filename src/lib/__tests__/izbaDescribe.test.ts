import { describe, expect, it } from 'vitest';
import { buildFromWish, parseWish } from '../izbaDescribe';
import { validatePlan } from '../validation';

describe('وصّف عزبتك', () => {
  it('يفهم الجملة الكاملة', () => {
    const w = parseWish('أرضين، ١٠٠ غنم و10 إبل، مجلس 10×7 بحمام ومطبخ، مسبح وملعب كورة');
    expect(w.plots).toBe(2);
    expect(w.sheep).toBe(100);
    expect(w.camels).toBe(10);
    expect(w.majlis).toEqual({ w: 10, d: 7 });
    expect([w.bath, w.kitchen, w.pool, w.football]).toEqual([true, true, true, true]);
    expect(w.use).toBe('mixed');
  });
  it('نوع العزبة من الكلام', () => {
    expect(parseWish('استراحة عائلية فيها مسبح').use).toBe('family');
    expect(parseWish('5 خيل في 3 اراضي').use).toBe('horses');
    expect(parseWish('5 خيل في 3 اراضي').plots).toBe(3);
    expect(parseWish('عزبة 150 في 100 فيها 300 راس غنم').plots).toBe(6);
    expect(parseWish('استراحة ومسبح').use).toBe('rest');
    expect(parseWish('مجلس كبير').majlis).toEqual({ w: 10, d: 7 });
  });
  it('التصميم: الحظيرة تكفي العدد، والمجلس بالمقاس، والزيادات موجودة', () => {
    const plan = buildFromWish(parseWish('أرضين، 150 غنم، مجلس 12×8 بحمام، مسبح، ملعب كورة، ملحق نساء'));
    const pen = plan.elements.find((e) => e.kind === 'sheep-pen')!;
    expect(pen.width * pen.depth).toBeGreaterThanOrEqual(300);
    const m = plan.elements.filter((e) => e.kind === 'room' && e.room?.type === 'majlis' && !/نساء/.test(e.name));
    expect(m).toHaveLength(1);
    expect([m[0].width, m[0].depth]).toEqual([12, 8]);
    for (const k of ['pool', 'football']) expect(plan.elements.some((e) => e.kind === k)).toBe(true);
    expect(plan.elements.some((e) => /نساء/.test(e.name))).toBe(true);
    // ما في عناصر برا الأرض
    const out = validatePlan(plan).issues.filter((i) => /برا|خارج|تتجاوز|يتجاوز/.test(i.message));
    expect(out).toHaveLength(0);
  });
});
