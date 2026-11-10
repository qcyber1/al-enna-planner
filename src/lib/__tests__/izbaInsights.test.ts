import { describe, expect, it } from 'vitest';
import { buildIzba } from '../izba';
import { computeSummary, DEFAULT_ESTIMATE } from '../quantities';
import { izbaInsights, RATES } from '../izbaInsights';
import { createElement } from '../catalog';

const run = (plan: ReturnType<typeof buildIzba>) => izbaInsights(plan, computeSummary(plan, DEFAULT_ESTIMATE));

describe('تحليل العزبة', () => {
  it('عزبة حلال: فيها غنم وماي وعلف وخزان ومولد', () => {
    const x = run(buildIzba('livestock', 1));
    expect(x.sheep).toBeGreaterThan(20);
    expect(x.waterPerDay).toBeGreaterThan(x.sheep * RATES.waterSheep);
    expect(x.feedPerDay).toBe(x.sheep * RATES.feedSheep + x.camels * RATES.feedCamel + x.horses * RATES.feedHorse);
    expect(x.tanks).toBe(1);
    expect(x.tankDays).toBeGreaterThan(0);
    expect(x.acTons).toBeGreaterThan(0);
    expect(x.generatorKva % 5).toBe(0);
  });
  it('الاستراحة ما فيها حلال', () => {
    const x = run(buildIzba('rest', 1));
    expect(x.sheep + x.camels + x.horses).toBe(0);
    expect(x.feedPerDay).toBe(0);
  });
  it('تنبيه لو ما في خزان، أو الخزان ما يكفي', () => {
    const plan = buildIzba('livestock', 4);
    plan.elements = plan.elements.filter((e) => e.kind !== 'water-tank');
    expect(run(plan).tips.some((t) => t.level === 'warn' && t.text.includes('ما في خزان'))).toBe(true);
    plan.elements.push(createElement('water-tank', { x: 5, y: 5 }));
    const x = run(plan);
    if (x.tankDays! < 2) expect(x.tips.some((t) => t.text.includes('تكفي'))).toBe(true);
  });
});
