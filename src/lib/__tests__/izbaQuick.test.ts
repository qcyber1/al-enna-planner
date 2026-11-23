import { describe, expect, it } from 'vitest';
import { herdGroup, majlisGroup } from '../izbaQuick';
import { closedArea } from '../geometry';

describe('أدوات العزبة السريعة', () => {
  it('الحلال: الحظيرة تكفي العدد، ومعلف لكل حظيرة ومخزن علف وغرفة عامل', () => {
    const g = herdGroup({ sheep: 100, camels: 10, horses: 4, feed: true, worker: true });
    const sheep = g.els.find((e) => e.kind === 'sheep-pen')!;
    expect(sheep.width * sheep.depth).toBeGreaterThanOrEqual(200);
    const camel = g.els.find((e) => e.kind === 'camel-pen')!;
    expect(camel.width * camel.depth).toBeGreaterThanOrEqual(120);
    const st = g.els.find((e) => e.kind === 'horse-stable')!;
    expect(st.width).toBeGreaterThanOrEqual(4 * 3.6);
    expect(g.els.filter((e) => e.kind === 'trough')).toHaveLength(2);
    expect(g.els.some((e) => e.kind === 'feed-store')).toBe(true);
    expect(g.els.some((e) => e.kind === 'worker-room')).toBe(true);
    // ما في تداخل بين الحظاير (صف وحد)
    const big = g.els.filter((e) => e.kind !== 'trough' && e.kind !== 'animal-shade').sort((a, b) => a.x - b.x);
    for (let i = 1; i < big.length; i++) expect(big[i].x - big[i].width / 2).toBeGreaterThanOrEqual(big[i - 1].x + big[i - 1].width / 2);
  });
  it('خيل كثير ينقسم صفوف 8، وبدون معلف لو طفّاه', () => {
    const g = herdGroup({ sheep: 0, camels: 0, horses: 12, feed: false, worker: false });
    expect(g.els.filter((e) => e.kind === 'horse-stable')).toHaveLength(2);
    expect(g.els.some((e) => e.kind === 'trough' || e.kind === 'feed-store')).toBe(false);
  });
  it('المجلس بالمقاس + حمام ومطبخ بجدار مشترك', () => {
    const g = majlisGroup({ width: 10, depth: 7, bath: true, kitchen: true });
    const rooms = g.els.filter((e) => e.kind === 'room');
    expect(rooms.map((r) => r.room!.type).sort()).toEqual(['bathroom', 'kitchen', 'majlis']);
    const m = rooms.find((r) => r.room!.type === 'majlis')!;
    expect([m.width, m.depth]).toEqual([10, 7]);
    expect(g.els.some((e) => e.kind === 'sofa-l')).toBe(true);
    expect(majlisGroup({ width: 8, depth: 6, bath: false, kitchen: false }).els.filter((e) => e.kind === 'room')).toHaveLength(1);
  });
  it('الشبك المسكّر يحسب مساحة الحوش', () => {
    expect(closedArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }, { x: 0.2, y: 0.1 }])).toBeGreaterThan(55);
    expect(closedArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }])).toBe(0);
  });
});

describe('ما نكرر مخزن العلف وغرفة العامل', () => {
  it('لو موجودين ما ينضافون', () => {
    const g = herdGroup({ sheep: 100, camels: 0, horses: 0, feed: true, worker: true, hasFeedStore: true, hasWorker: true });
    expect(g.els.some((e) => e.kind === 'feed-store' || e.kind === 'worker-room')).toBe(false);
    expect(g.els.some((e) => e.kind === 'trough')).toBe(true);
  });
});
