import { describe, expect, it } from 'vitest';
import { buildIzba, IZBA_USES, IZBA_PLOT_OPTIONS } from '../izba';
import { validatePlan } from '../validation';

describe('قوالب العزبة', () => {
  for (const u of IZBA_USES)
    for (const p of IZBA_PLOT_OPTIONS)
      it(`${u.title} — ${p.size} بدون تنبيهات`, () => {
        const plan = buildIzba(u.id, p.n);
        const v = validatePlan(plan);
        if (v.issues.length) console.log(u.id, p.n, v.issues.map((i) => i.message));
        expect(plan.land.site).toBe('izba');
        expect(plan.elements.length).toBeGreaterThan(5);
        expect(v.issues).toEqual([]);
      });
});

import { createElement } from '../catalog';
import { emptyPlan } from '../sample';
import { izbaLand } from '../izba';
import { fixIssue } from '../autofix';

describe('الحلال وريح الشمال', () => {
  const plan = (penAt: { x: number; y: number }) => {
    const p = emptyPlan(izbaLand(1));
    p.elements = [createElement('majlis-room', { x: 30, y: 30 }, { id: 'm' }), createElement('sheep-pen', penAt, { id: 'p' })];
    return p;
  };
  const warn = (p: ReturnType<typeof plan>) => validatePlan(p).issues.filter((i) => i.code === 'livestock-wind');

  it('الحظيرة شمال غرب المجلس (فوق الريح) = تنبيه', () => {
    const w = warn(plan({ x: 9, y: 9 }));
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain('فوق الريح');
  });
  it('الحظيرة جنوب شرق المجلس وبعيدة = تمام', () => {
    const p = emptyPlan(izbaLand(2));
    p.elements = [createElement('majlis-room', { x: 12, y: 10 }), createElement('sheep-pen', { x: 80, y: 44 })];
    expect(warn(p)).toHaveLength(0);
  });
  it('لاصقة في المجلس من أي جهة = تنبيه المسافة', () => {
    const w = warn(plan({ x: 30, y: 41 }));
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain('قريبة');
  });
  it('اتجاه الشمال يتغير: نفس المكان يصير تحت الريح', () => {
    const p = plan({ x: 9, y: 9 });
    p.land.northAngle = 180;
    expect(warn(p)).toHaveLength(0);
  });
  it('زر «اصلحها» ينقل الحظيرة لمكان بدون تنبيه', () => {
    const p = plan({ x: 9, y: 9 });
    const f = fixIssue(p, warn(p)[0]);
    expect(f).not.toBeNull();
    expect(f!.id).toBe('p');
  });
});

import { sanitizeLand } from '../sanitize';
import { izbaIdeas, plotsOf } from '../izba';

describe('العزبة: الحفظ والمولّد', () => {
  it('نوع المكان ينحفظ ويرجع بعد الاستيراد، والمشاريع القديمة تبقى عنة', () => {
    expect(sanitizeLand(izbaLand(2)).site).toBe('izba');
    expect(sanitizeLand({ shape: 'square', width: 50 }).site).toBeUndefined();
    expect(sanitizeLand({ site: 'hack' }).site).toBeUndefined();
  });
  it('عدد الأراضي من المقاس', () => {
    expect(plotsOf({ width: 50, depth: 50 })).toBe(1);
    expect(plotsOf({ width: 100, depth: 50 })).toBe(2);
    expect(plotsOf({ width: 100, depth: 100 })).toBe(4);
  });
  it('«ولّد» في العزبة يعطي 4 أفكار بدون تنبيهات ويحافظ على اتجاه الشمال', () => {
    const ideas = izbaIdeas({ ...izbaLand(2), northAngle: 0 });
    expect(ideas).toHaveLength(4);
    expect(ideas.every((i) => i.issues === 0)).toBe(true);
    expect(izbaIdeas({ ...izbaLand(1), northAngle: 30 })[0].plan.land.northAngle).toBe(30);
  });
});
