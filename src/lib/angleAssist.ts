import type { Vec2 } from '../types/plan';

export interface AngleSnap {
  p: Vec2;
  /** الزاوية من الأفقي (0..180) */
  angle: number;
  /** زاوية الانعطاف عن الضلع السابق إن وجد */
  turn: number | null;
  snapped: 'straight' | 'right' | 'land' | 'step' | null;
}

const norm180 = (a: number) => ((a % 180) + 180) % 180;
const diff = (a: number, b: number) => {
  const d = Math.abs(norm180(a) - norm180(b));
  return Math.min(d, 180 - d);
};

/**
 * مساعد الزوايا للرسم: يعدّل النقطة لو قريبة من خط مستقيم (أفقي/عمودي)،
 * أو موازي/عامودي لسور الأرض أو للضلع السابق، أو مضاعفات 15°.
 * force = Shift: يلتصق دايماً بأقرب 45°
 */
export function assistAngle(pts: Vec2[], raw: Vec2, landEdges: number[], force = false): AngleSnap {
  const last = pts[pts.length - 1];
  const prev = pts.length >= 2 ? pts[pts.length - 2] : null;
  const L = Math.hypot(raw.x - last.x, raw.y - last.y);
  const ang = (Math.atan2(raw.y - last.y, raw.x - last.x) * 180) / Math.PI;
  const prevAng = prev ? (Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI : null;
  const turnOf = (a: number) => (prevAng === null ? null : Math.round(Math.min(Math.abs(((a - prevAng + 540) % 360) - 180), 180)));
  const out = (a: number, snapped: AngleSnap['snapped']): AngleSnap => {
    const r = (a * Math.PI) / 180;
    const p = snapped ? { x: last.x + Math.cos(r) * L, y: last.y + Math.sin(r) * L } : raw;
    return { p: { x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 }, angle: Math.round(norm180(a)), turn: turnOf(a), snapped };
  };
  if (L < 0.3) return out(ang, null);
  if (force) return out(Math.round(ang / 45) * 45, 'step');
  // المرشحين بالأولوية: [زاوية، السماحية، النوع]
  const cands: [number, number, AngleSnap['snapped']][] = [];
  if (prevAng !== null) {
    cands.push([prevAng, 7, 'straight'], [prevAng + 90, 7, 'right'], [prevAng - 90, 7, 'right']);
  }
  for (const a of [0, 90]) cands.push([a, 7, 'straight']);
  for (const e of landEdges) cands.push([e, 6, 'land'], [e + 90, 6, 'land']);
  for (let a = 0; a < 180; a += 15) cands.push([a, 3, 'step']);
  let best: [number, AngleSnap['snapped'], number] | null = null;
  for (const [a, tol, kind] of cands) {
    const d = diff(ang, a);
    if (d <= tol && (!best || d < best[2] - 0.5)) best = [a, kind, d];
  }
  if (!best) return out(ang, null);
  // نختار الاتجاه (a أو a+180) الأقرب للحركة الفعلية
  let a = best[0];
  const d1 = Math.abs(((ang - a + 540) % 360) - 180);
  if (d1 > 90) a += 180;
  return out(a, best[1]);
}

/** نقاط دائرة مغلقة (آخر نقطة = أول نقطة) */
export function circlePoints(c: Vec2, r: number, n = 48): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push({ x: Math.round((c.x + Math.cos(t) * r) * 1000) / 1000, y: Math.round((c.y + Math.sin(t) * r) * 1000) / 1000 });
  }
  return out;
}

/** نقاط وعرض حشيش دائري: ممتلئ = دائرة كاملة بنصف قطر r، أو حلقة عرضها width */
export function circlePath(c: Vec2, r: number, filled: boolean, width: number): { points: Vec2[]; width: number } {
  return filled ? { points: circlePoints(c, r / 2), width: r } : { points: circlePoints(c, r), width };
}
export function polyCenter(pts: Vec2[]): Vec2 {
  const q = pts.length > 2 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y ? pts.slice(0, -1) : pts;
  const s = q.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / q.length, y: s.y / q.length };
}
