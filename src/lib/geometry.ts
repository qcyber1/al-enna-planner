import type { Land, PlanElement, Vec2 } from '../types/plan';
import { CATALOG_BY_KIND } from './catalog';

export const DEG = Math.PI / 180;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;
export const len = (a: Vec2) => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec2): Vec2 => {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function snapValue(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  return round(a, 2);
}

/** تدوير نقطة حول الأصل (مع عقارب الساعة في محاور y للأسفل) */
export function rotate(p: Vec2, deg: number): Vec2 {
  const r = deg * DEG;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

export function localToWorld(el: Pick<PlanElement, 'x' | 'y' | 'rotation'>, p: Vec2): Vec2 {
  return add(rotate(p, el.rotation), { x: el.x, y: el.y });
}

export function worldToLocal(el: Pick<PlanElement, 'x' | 'y' | 'rotation'>, p: Vec2): Vec2 {
  return rotate(sub(p, { x: el.x, y: el.y }), -el.rotation);
}

export function rectCorners(cx: number, cy: number, w: number, d: number, rotDeg: number): Vec2[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ].map((p) => add(rotate(p, rotDeg), { x: cx, y: cy }));
}

export function polygonArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function polygonPerimeter(poly: Vec2[]): number {
  let p = 0;
  for (let i = 0; i < poly.length; i++) p += dist(poly[i], poly[(i + 1) % poly.length]);
  return p;
}

export function polylineLength(points: Vec2[]): number {
  let l = 0;
  for (let i = 1; i < points.length; i++) l += dist(points[i - 1], points[i]);
  return l;
}

export function boundsOf(points: Vec2[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function boundsIntersect(a: Bounds, b: Bounds, pad = 0): boolean {
  return a.minX - pad <= b.maxX && a.maxX + pad >= b.minX && a.minY - pad <= b.maxY && a.maxY + pad >= b.minY;
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function segmentsIntersect(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): boolean {
  const d1 = cross(sub(q2, q1), sub(p1, q1));
  const d2 = cross(sub(q2, q1), sub(p2, q1));
  const d3 = cross(sub(p2, p1), sub(q1, p1));
  const d4 = cross(sub(p2, p1), sub(q2, p1));
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < 1e-12) return a;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

function axesOf(poly: Vec2[]): Vec2[] {
  const axes: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const e = sub(poly[(i + 1) % poly.length], poly[i]);
    axes.push(norm({ x: -e.y, y: e.x }));
  }
  return axes;
}

/** اختبار تقاطع مضلعين محدبين (SAT) مع هامش تسامح بسيط */
export function convexIntersect(a: Vec2[], b: Vec2[], tolerance = 0.01): boolean {
  for (const axis of [...axesOf(a), ...axesOf(b)]) {
    let minA = Infinity;
    let maxA = -Infinity;
    let minB = Infinity;
    let maxB = -Infinity;
    for (const p of a) {
      const d = dot(p, axis);
      minA = Math.min(minA, d);
      maxA = Math.max(maxA, d);
    }
    for (const p of b) {
      const d = dot(p, axis);
      minB = Math.min(minB, d);
      maxB = Math.max(maxB, d);
    }
    if (maxA <= minB + tolerance || maxB <= minA + tolerance) return false;
  }
  return true;
}

export interface Closest {
  dist: number;
  a: Vec2;
  b: Vec2;
}

/** أقصر مسافة بين مضلعين (حافة لحافة) مع نقطتي أقرب اقتراب */
export function polygonDistance(a: Vec2[], b: Vec2[]): Closest {
  let best: Closest = { dist: Infinity, a: a[0], b: b[0] };
  const test = (poly: Vec2[], other: Vec2[], swap: boolean) => {
    for (const p of poly) {
      for (let i = 0; i < other.length; i++) {
        const q = closestPointOnSegment(p, other[i], other[(i + 1) % other.length]);
        const d = dist(p, q);
        if (d < best.dist) best = swap ? { dist: d, a: q, b: p } : { dist: d, a: p, b: q };
      }
    }
  };
  test(a, b, false);
  test(b, a, true);
  return best;
}

export function shapesDistance(a: Vec2[][], b: Vec2[][]): Closest {
  let best: Closest = { dist: Infinity, a: { x: 0, y: 0 }, b: { x: 0, y: 0 } };
  for (const pa of a) {
    for (const pb of b) {
      if (convexIntersect(pa, pb, 0)) {
        const c = centroid(pa);
        return { dist: 0, a: c, b: c };
      }
      const d = polygonDistance(pa, pb);
      if (d.dist < best.dist) best = d;
    }
  }
  return best;
}

export function centroid(poly: Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

/** يحسب حواف الممر يميناً ويساراً مع وصلات Miter */
export function polylineOutline(points: Vec2[], width: number): { left: Vec2[]; right: Vec2[] } {
  const hw = width / 2;
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  const n = points.length;
  if (n < 2) return { left, right };
  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    let normal: Vec2;
    let m = hw;
    if (i === 0 || i === n - 1) {
      const d = norm(sub(next, prev));
      normal = { x: -d.y, y: d.x };
    } else {
      const d0 = norm(sub(points[i], prev));
      const d1 = norm(sub(next, points[i]));
      const n0 = { x: -d0.y, y: d0.x };
      const n1 = { x: -d1.y, y: d1.x };
      const sum = norm(add(n0, n1));
      if (len(sum) < 1e-6) {
        normal = n0;
      } else {
        normal = sum;
        const cosHalf = dot(sum, n1);
        m = Math.min(hw / Math.max(cosHalf, 0.25), hw * 4);
      }
    }
    left.push(add(points[i], scale(normal, m)));
    right.push(sub(points[i], scale(normal, m)));
  }
  return { left, right };
}

export function outlinePolygon(points: Vec2[], width: number): Vec2[] {
  const { left, right } = polylineOutline(points, width);
  return [...left, ...right.reverse()];
}

/** مستطيلات أجزاء الممر (مضلعات محدبة) */
export function segmentRects(points: Vec2[], width: number): Vec2[][] {
  const res: Vec2[][] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const d = norm(sub(b, a));
    if (len(d) === 0) continue;
    const nrm = scale({ x: -d.y, y: d.x }, width / 2);
    res.push([add(a, nrm), add(b, nrm), sub(b, nrm), sub(a, nrm)]);
  }
  return res;
}

/** الأشكال المحدبة التي تمثل مساحة العنصر على الأرض */
export function elementShapes(el: PlanElement): Vec2[][] {
  const geo = CATALOG_BY_KIND[el.kind].geometry;
  if (geo === 'polyline') {
    if (el.kind === 'path' && el.points && el.path) return segmentRects(el.points, el.path.width);
    return [];
  }
  if (geo === 'point') {
    return [rectCorners(el.x, el.y, Math.max(el.width, 0.1), Math.max(el.depth, 0.1), el.rotation)];
  }
  return [rectCorners(el.x, el.y, el.width, el.depth, el.rotation)];
}

export function elementBounds(el: PlanElement): Bounds {
  if (el.points && el.points.length) {
    const pad = el.kind === 'path' && el.path ? el.path.width / 2 : 0.15;
    const b = boundsOf(el.points);
    return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
  }
  return boundsOf(rectCorners(el.x, el.y, el.width, el.depth, el.rotation));
}

export function elementCenter(el: PlanElement): Vec2 {
  if (el.points && el.points.length) {
    const b = boundsOf(el.points);
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  }
  return { x: el.x, y: el.y };
}

/** مضلع منطقة أمان الملعب */
export function courtSafetyPolygon(el: PlanElement): Vec2[] {
  const m = el.court?.safetyMargin ?? 0;
  return rectCorners(el.x, el.y, el.width + 2 * m, el.depth + 2 * m, el.rotation);
}

// ——— الأرض ———

export function landPolygon(land: Land): Vec2[] {
  if (land.shape === 'polygon' && land.polygon && land.polygon.length >= 3) return land.polygon;
  const w = land.width;
  const d = land.shape === 'square' ? land.width : land.depth;
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: 0, y: d },
  ];
}

export function landBounds(land: Land): Bounds {
  return boundsOf(landPolygon(land));
}

export function landArea(land: Land): number {
  return polygonArea(landPolygon(land));
}

export interface EdgeInfo {
  a: Vec2;
  b: Vec2;
  length: number;
  dir: Vec2;
  /** العمودي باتجاه داخل الأرض */
  inward: Vec2;
}

function isClockwise(poly: Vec2[]): boolean {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p.x * q.y - q.x * p.y;
  }
  // في محاور y للأسفل يكون الترتيب مع عقارب الساعة بإشارة موجبة
  return s > 0;
}

export function landEdges(land: Land): EdgeInfo[] {
  const poly = landPolygon(land);
  const cw = isClockwise(poly);
  return poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const dir = norm(sub(b, a));
    // للمضلع مع عقارب الساعة (y للأسفل) يكون الداخل على يمين اتجاه الضلع
    const inward = cw ? { x: -dir.y, y: dir.x } : { x: dir.y, y: -dir.x };
    return { a, b, length: dist(a, b), dir, inward };
  });
}

export interface EntranceInfo {
  a: Vec2;
  b: Vec2;
  center: Vec2;
  inward: Vec2;
  dir: Vec2;
  width: number;
  edge: number;
}

export function entranceInfo(land: Land): EntranceInfo {
  const edges = landEdges(land);
  const edge = Math.min(Math.max(0, Math.round(land.entrance.edge)), edges.length - 1);
  const e = edges[edge];
  const w = Math.min(land.entrance.width, e.length);
  const off = Math.min(Math.max(land.entrance.offset, w / 2), e.length - w / 2);
  const center = add(e.a, scale(e.dir, off));
  return {
    a: add(e.a, scale(e.dir, off - w / 2)),
    b: add(e.a, scale(e.dir, off + w / 2)),
    center,
    inward: e.inward,
    dir: e.dir,
    width: w,
    edge,
  };
}

export function polygonInside(inner: Vec2[], outer: Vec2[], tolerance = 0.005): boolean {
  for (const p of inner) {
    if (pointInPolygon(p, outer)) continue;
    // نسمح بالنقاط الواقعة على الحد تماماً
    let onEdge = false;
    for (let i = 0; i < outer.length; i++) {
      const q = closestPointOnSegment(p, outer[i], outer[(i + 1) % outer.length]);
      if (dist(p, q) <= tolerance) {
        onEdge = true;
        break;
      }
    }
    if (!onEdge) return false;
  }
  for (let i = 0; i < inner.length; i++) {
    for (let j = 0; j < outer.length; j++) {
      if (segmentsIntersect(inner[i], inner[(i + 1) % inner.length], outer[j], outer[(j + 1) % outer.length])) {
        return false;
      }
    }
  }
  return true;
}

export function formatMeters(n: number, digits = 2): string {
  return `${round(n, digits).toLocaleString('en-US', { maximumFractionDigits: digits })} م`;
}

export function formatArea(n: number, digits = 1): string {
  return `${round(n, digits).toLocaleString('en-US', { maximumFractionDigits: digits })} م²`;
}

export function formatNumber(n: number, digits = 2): string {
  return round(n, digits).toLocaleString('en-US', { maximumFractionDigits: digits });
}

/** نقاط سلسلة معلقة (منحنى ترهل بسيط) بين نقطتين */
export function catenaryPoints(a: Vec2, b: Vec2, height: number, sag: number, segments: number): { p: Vec2; h: number }[] {
  const out: { p: Vec2; h: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    out.push({ p: lerp(a, b, t), h: height - sag * 4 * t * (1 - t) });
  }
  return out;
}

export function isFiniteBounds(b: Bounds): boolean {
  return [b.minX, b.minY, b.maxX, b.maxY].every(Number.isFinite);
}
