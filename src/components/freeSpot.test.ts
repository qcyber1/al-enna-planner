import { describe, expect, it } from 'vitest';
import { freeSpot } from './Library';
import { createElement } from '../lib/catalog';

describe('freeSpot', () => {
  const land = { minX: 0, minY: 0, maxX: 50, maxY: 50 };
  it('يبقى في مكانه إذا فاضي', () => {
    const el = createElement('main-tent', { x: 25, y: 25 });
    expect(freeSpot(el, [], land)).toEqual({ x: 25, y: 25 });
  });
  it('ما ينحط فوق عنصر ثاني ويبقى داخل الأرض', () => {
    const a = createElement('main-tent', { x: 25, y: 25 });
    const el = createElement('main-tent', { x: 25, y: 25 });
    const p = freeSpot(el, [a], land);
    const sep = Math.abs(p.x - a.x) >= a.width / 2 + el.width / 2 || Math.abs(p.y - a.y) >= a.depth / 2 + el.depth / 2;
    expect(sep).toBe(true);
    expect(p.x - el.width / 2).toBeGreaterThanOrEqual(0);
    expect(p.y + el.depth / 2).toBeLessThanOrEqual(50);
  });
});
