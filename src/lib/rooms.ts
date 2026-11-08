// هندسة الغرف: الجدران مقسومة حول الأبواب والشبابيك (إحداثيات محلية، المركز 0،0، الأمام +y)
import type { Opening, PlanElement, RoomProps, Side } from '../types/plan';

/** سماكة الجدار بالمتر */
export const WALL = 0.2;
export const DOOR_H = 2.2;
export const SILL_H = 1.0;
export const WIN_TOP = 2.2;

export const SIDES: Side[] = ['front', 'back', 'left', 'right'];

/** طول الضلع */
export function sideLength(el: Pick<PlanElement, 'width' | 'depth'>, side: Side): number {
  return side === 'front' || side === 'back' ? el.width : el.depth;
}

export interface WallPiece {
  /** من وين لوين على طول الضلع (من -L/2 إلى L/2) */
  a: number;
  b: number;
  kind: 'solid' | 'door' | 'window';
}

/** يقص الفتحة داخل الضلع ويرجع حدودها */
export function clampOpening(o: Opening, L: number): { a: number; b: number } | null {
  const w = Math.min(Math.max(0.4, o.width), L - 0.4);
  if (w <= 0) return null;
  const c = Math.min(Math.max(o.offset, -L / 2 + w / 2 + 0.1), L / 2 - w / 2 - 0.1);
  return { a: c - w / 2, b: c + w / 2 };
}

/** قطع جدار ضلع واحد: صلب / باب / شباك */
export function wallPieces(el: Pick<PlanElement, 'width' | 'depth' | 'room'>, side: Side): WallPiece[] {
  const L = sideLength(el, side);
  const r = el.room;
  const holes: WallPiece[] = [];
  if (r) {
    for (const o of r.doors) if (o.side === side) {
      const c = clampOpening(o, L);
      if (c) holes.push({ ...c, kind: 'door' });
    }
    for (const o of r.windows) if (o.side === side) {
      const c = clampOpening(o, L);
      if (c) holes.push({ ...c, kind: 'window' });
    }
  }
  holes.sort((p, q) => p.a - q.a);
  const out: WallPiece[] = [];
  let t = -L / 2;
  for (const h of holes) {
    if (h.a < t) continue; // فتحات متداخلة: نتجاهل الثانية
    if (h.a > t + 1e-6) out.push({ a: t, b: h.a, kind: 'solid' });
    out.push(h);
    t = h.b;
  }
  if (t < L / 2 - 1e-6) out.push({ a: t, b: L / 2, kind: 'solid' });
  return out;
}

/**
 * تحويل نقطة على الضلع (t على طوله، n للداخل من الحافة) لإحداثيات محلية.
 * n = 0 الحافة الخارجية، n = WALL الوجه الداخلي.
 */
export function sidePoint(el: Pick<PlanElement, 'width' | 'depth'>, side: Side, t: number, n: number): { x: number; y: number } {
  const w = el.width / 2;
  const d = el.depth / 2;
  switch (side) {
    case 'front':
      return { x: t, y: d - n };
    case 'back':
      return { x: t, y: -d + n };
    case 'left':
      return { x: -w + n, y: t };
    case 'right':
      return { x: w - n, y: t };
  }
}

/** مساحة الغرفة الصافية من الداخل */
export function roomNetArea(el: Pick<PlanElement, 'width' | 'depth'>): number {
  return Math.max(0, el.width - 2 * WALL) * Math.max(0, el.depth - 2 * WALL);
}

export function sanitizeRoom(raw: unknown, fallback: RoomProps): RoomProps {
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  const one = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
  const sides = ['front', 'back', 'left', 'right'] as const;
  const ops = (v: unknown): Opening[] =>
    Array.isArray(v)
      ? v.slice(0, 12).flatMap((o) => {
          if (!o || typeof o !== 'object') return [];
          const q = o as Record<string, unknown>;
          const off = Number(q.offset);
          const w = Number(q.width);
          return [{ side: one(q.side, sides, 'front'), offset: Number.isFinite(off) ? Math.max(-50, Math.min(50, off)) : 0, width: Number.isFinite(w) ? Math.max(0.4, Math.min(10, w)) : 1 }];
        })
      : [];
  return {
    type: one(r.type, ['majlis', 'bedroom', 'bathroom', 'kitchen', 'hall', 'games', 'store', 'dining'] as const, fallback.type),
    floor: one(r.floor, ['marble', 'wood', 'microcement', 'tiles', 'carpet'] as const, fallback.floor),
    wall: one(r.wall, ['paint', 'wood-panel', 'stone', 'marble'] as const, fallback.wall),
    wallColor: typeof r.wallColor === 'string' && /^#[0-9a-f]{6}$/i.test(r.wallColor) ? r.wallColor : fallback.wallColor,
    doors: Array.isArray(r.doors) ? ops(r.doors) : fallback.doors,
    windows: Array.isArray(r.windows) ? ops(r.windows) : fallback.windows,
    coveLight: typeof r.coveLight === 'boolean' ? r.coveLight : fallback.coveLight,
  };
}
