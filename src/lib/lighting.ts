import type { LightColor, Plan, PlanElement, Vec2 } from '../types/plan';
import { DEG, add, catenaryPoints, dist, lerp, localToWorld, polylineLength, polylineOutline, rotate, scale } from './geometry';
import { isLightKind } from './catalog';

/** مصدر إضاءة موحد يستخدمه المشهد ثلاثي الأبعاد وخريطة الإضاءة ثنائية الأبعاد */
export interface Emitter {
  key: string;
  sourceId: string;
  kind: 'spot' | 'point';
  /** موضع المصدر (x,y في المخطط + الارتفاع) */
  pos: Vec2;
  height: number;
  /** اتجاه الإضاءة للكشافات (متجه ثلاثي: x,y في المخطط، z للأسفل موجب) */
  dir?: { x: number; y: number; down: number };
  /** نصف زاوية المخروط بالراديان */
  halfAngle: number;
  /** الشدة الضوئية التقديرية (كانديلا) */
  candela: number;
  lumens: number;
  color: LightColor;
  /** أولوية الحصول على مصدر ضوء حقيقي في 3D */
  priority: number;
  category: 'flood' | 'pole' | 'entrance' | 'lantern' | 'string' | 'ground' | 'tent';
}

export const LIGHT_HEX: Record<LightColor, string> = {
  warm: '#ffc77a',
  white: '#f4f7ff',
};

const EFFICACY = 100; // لومن لكل واط تقريباً لمصابيح LED

function coneCandela(lumens: number, fullAngleDeg: number): number {
  const half = Math.min(Math.max(fullAngleDeg / 2, 5), 179) * DEG;
  const solid = 2 * Math.PI * (1 - Math.cos(half));
  return lumens / solid;
}

function pointCandela(lumens: number): number {
  return lumens / (4 * Math.PI);
}

/** نقاط اللمبات على طول السلسلة */
export function stringBulbs(el: PlanElement): { p: Vec2; h: number }[] {
  const pts = el.points ?? [];
  const spacing = Math.max(0.2, el.string?.bulbSpacing ?? 0.6);
  const sag = el.string?.sag ?? 0.4;
  const h = el.light?.mountHeight ?? el.height;
  const out: { p: Vec2; h: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const segLen = dist(a, b);
    const n = Math.max(1, Math.floor(segLen / spacing));
    const curve = catenaryPoints(a, b, h, Math.min(sag, h - 0.5), n);
    for (let k = i === 1 ? 0 : 1; k < curve.length; k++) out.push(curve[k]);
  }
  return out;
}

/** مواضع إنارة جوانب الممر */
export function pathEdgeLights(el: PlanElement): Vec2[] {
  if (!el.path?.edgeLights || !el.points || el.points.length < 2) return [];
  const spacing = Math.max(0.5, el.path.edgeLightSpacing);
  const { left, right } = polylineOutline(el.points, el.path.width + 0.3);
  const out: Vec2[] = [];
  for (const side of [left, right]) {
    const total = polylineLength(side);
    const count = Math.max(1, Math.floor(total / spacing));
    const step = total / count;
    for (let k = 0; k <= count; k++) {
      out.push(pointAlong(side, k * step));
    }
  }
  return out;
}

function pointAlong(points: Vec2[], distance: number): Vec2 {
  let remaining = distance;
  for (let i = 1; i < points.length; i++) {
    const l = dist(points[i - 1], points[i]);
    if (remaining <= l || i === points.length - 1) {
      return lerp(points[i - 1], points[i], l === 0 ? 0 : Math.min(1, remaining / l));
    }
    remaining -= l;
  }
  return points[points.length - 1];
}

/** موضع فانوس مدخل الخيمة ومركز الإضاءة الداخلية */
export function tentLightPositions(el: PlanElement): { entrance: Vec2; outward: Vec2; interior: Vec2 } | null {
  if (!el.tent) return null;
  const t = el.tent;
  let local: Vec2;
  let out: Vec2;
  const off = t.entranceOffset;
  const edgeOffset = t.entranceWidth / 2 + 0.25;
  switch (t.entranceSide) {
    case 'front':
      local = { x: off + edgeOffset, y: el.depth / 2 + 0.2 };
      out = { x: 0, y: 1 };
      break;
    case 'back':
      local = { x: off + edgeOffset, y: -el.depth / 2 - 0.2 };
      out = { x: 0, y: -1 };
      break;
    case 'left':
      local = { x: -el.width / 2 - 0.2, y: off + edgeOffset };
      out = { x: -1, y: 0 };
      break;
    case 'right':
      local = { x: el.width / 2 + 0.2, y: off + edgeOffset };
      out = { x: 1, y: 0 };
      break;
  }
  return {
    entrance: localToWorld(el, local),
    outward: rotate(out, el.rotation),
    interior: { x: el.x, y: el.y },
  };
}

export interface EmitterOptions {
  /** دمج لمبات السلاسل في مجموعات لكل X متر */
  clusterMeters?: number;
}

export function collectEmitters(plan: Plan, opts: EmitterOptions = {}): Emitter[] {
  const out: Emitter[] = [];
  const cluster = opts.clusterMeters ?? 4;

  for (const el of plan.elements) {
    // إنارة الخيام (الداخلية والمدخل)
    if (el.tent) {
      const pos = tentLightPositions(el);
      if (pos && el.tent.entranceLight) {
        const lm = 900;
        out.push({
          key: `${el.id}:ent`,
          sourceId: el.id,
          kind: 'point',
          pos: pos.entrance,
          height: Math.max(1.6, el.tent.wallHeight - 0.3),
          halfAngle: Math.PI,
          candela: pointCandela(lm),
          lumens: lm,
          color: 'warm',
          priority: 50,
          category: 'lantern',
        });
      }
      if (pos && el.tent.interiorLight) {
        const lm = 400 * Math.max(1, (el.width * el.depth) / 20);
        out.push({
          key: `${el.id}:int`,
          sourceId: el.id,
          kind: 'point',
          pos: pos.interior,
          height: el.tent.wallHeight * 0.9,
          halfAngle: Math.PI,
          candela: pointCandela(lm),
          lumens: lm,
          color: 'warm',
          priority: 30,
          category: 'tent',
        });
      }
    }

    // إنارة جوانب الممرات
    if (el.kind === 'path' && el.path?.edgeLights) {
      pathEdgeLights(el).forEach((p, i) => {
        const lm = 250;
        out.push({
          key: `${el.id}:edge${i}`,
          sourceId: el.id,
          kind: 'point',
          pos: p,
          height: 0.45,
          halfAngle: Math.PI,
          candela: pointCandela(lm),
          lumens: lm,
          color: 'warm',
          priority: 5,
          category: 'ground',
        });
      });
    }

    if (!isLightKind(el.kind) || !el.light || !el.light.on) continue;
    const L = el.light;
    const lumens = L.watts * EFFICACY * Math.max(0, Math.min(100, L.intensity)) / 100;
    if (lumens <= 0) continue;

    switch (el.kind) {
      case 'flood-light': {
        const yaw = el.rotation; // الاتجاه في المسقط: 0 = نحو الأسفل (الأمام)
        const fwd = rotate({ x: 0, y: 1 }, yaw);
        const tilt = Math.max(0, Math.min(90, L.tilt)) * DEG;
        out.push({
          key: el.id,
          sourceId: el.id,
          kind: 'spot',
          pos: { x: el.x, y: el.y },
          height: L.mountHeight,
          dir: { x: fwd.x * Math.cos(tilt), y: fwd.y * Math.cos(tilt), down: Math.sin(tilt) },
          halfAngle: (Math.max(10, Math.min(160, L.beam)) / 2) * DEG,
          candela: coneCandela(lumens, L.beam),
          lumens,
          color: L.color,
          priority: 100,
          category: 'flood',
        });
        break;
      }
      case 'light-pole': {
        out.push({
          key: el.id,
          sourceId: el.id,
          kind: 'spot',
          pos: { x: el.x, y: el.y },
          height: L.mountHeight,
          dir: { x: 0, y: 0, down: 1 },
          halfAngle: (Math.max(20, Math.min(170, L.beam)) / 2) * DEG,
          candela: coneCandela(lumens, L.beam),
          lumens,
          color: L.color,
          priority: 90,
          category: 'pole',
        });
        break;
      }
      case 'entrance-light':
      case 'lantern':
      case 'ground-light': {
        out.push({
          key: el.id,
          sourceId: el.id,
          kind: 'point',
          pos: { x: el.x, y: el.y },
          height: el.kind === 'ground-light' ? L.mountHeight : L.mountHeight - 0.2,
          halfAngle: Math.PI,
          candela: pointCandela(lumens),
          lumens,
          color: L.color,
          priority: el.kind === 'entrance-light' ? 70 : el.kind === 'lantern' ? 50 : 10,
          category: el.kind === 'entrance-light' ? 'entrance' : el.kind === 'lantern' ? 'lantern' : 'ground',
        });
        break;
      }
      case 'string-lights': {
        const bulbs = stringBulbs(el);
        if (!bulbs.length) break;
        const perBulb = lumens; // الواط هنا لكل لمبة
        // تجميع اللمبات في مجموعات لتقليل عدد مصادر الضوء
        let group: { p: Vec2; h: number }[] = [];
        let start = bulbs[0].p;
        let gi = 0;
        const flush = () => {
          if (!group.length) return;
          let sx = 0;
          let sy = 0;
          let sh = 0;
          for (const b of group) {
            sx += b.p.x;
            sy += b.p.y;
            sh += b.h;
          }
          const lm = perBulb * group.length;
          out.push({
            key: `${el.id}:s${gi++}`,
            sourceId: el.id,
            kind: 'point',
            pos: { x: sx / group.length, y: sy / group.length },
            height: sh / group.length,
            halfAngle: Math.PI,
            candela: pointCandela(lm),
            lumens: lm,
            color: L.color,
            priority: 20,
            category: 'string',
          });
          group = [];
        };
        for (const b of bulbs) {
          if (group.length && dist(start, b.p) > cluster) {
            flush();
            start = b.p;
          }
          group.push(b);
        }
        flush();
        break;
      }
    }
  }
  return out;
}

/** تقدير الإضاءة الأرضية (لوكس تقريبي) عند نقطة */
export function illuminanceAt(p: Vec2, emitters: Emitter[]): number {
  let e = 0;
  for (const em of emitters) {
    const dx = p.x - em.pos.x;
    const dy = p.y - em.pos.y;
    const dz = em.height;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 0.01) continue;
    const d = Math.sqrt(d2);
    const cosIncidence = dz / d;
    let I = em.candela;
    if (em.kind === 'spot' && em.dir) {
      const dl = Math.hypot(em.dir.x, em.dir.y, em.dir.down) || 1;
      const cosAng = (dx * em.dir.x + dy * em.dir.y + dz * em.dir.down) / (d * dl);
      const ang = Math.acos(Math.max(-1, Math.min(1, cosAng)));
      const edge = em.halfAngle;
      if (ang > edge * 1.15) continue;
      if (ang > edge) I *= 1 - (ang - edge) / (edge * 0.15);
    }
    e += (I * cosIncidence) / d2;
  }
  return e;
}

export interface LightGrid {
  cols: number;
  rows: number;
  cell: number;
  originX: number;
  originY: number;
  values: Float32Array;
  max: number;
}

export function computeLightGrid(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  emitters: Emitter[],
  cell = 0.5,
): LightGrid {
  const cols = Math.max(1, Math.ceil((maxX - minX) / cell));
  const rows = Math.max(1, Math.ceil((maxY - minY) / cell));
  const values = new Float32Array(cols * rows);
  let max = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = illuminanceAt({ x: minX + (c + 0.5) * cell, y: minY + (r + 0.5) * cell }, emitters);
      values[r * cols + c] = v;
      if (v > max) max = v;
    }
  }
  return { cols, rows, cell, originX: minX, originY: minY, values, max };
}

/** تدرج ألوان خريطة الإضاءة: مظلم ← خافت ← جيد ← ساطع */
export const LUX_STOPS: { lux: number; color: [number, number, number]; label: string }[] = [
  { lux: 0, color: [10, 14, 40], label: 'مظلم' },
  { lux: 2, color: [60, 40, 110], label: 'خافت جداً' },
  { lux: 8, color: [190, 70, 60], label: 'خافت' },
  { lux: 25, color: [240, 170, 50], label: 'جيد' },
  { lux: 80, color: [255, 245, 200], label: 'ساطع' },
];

export function luxColor(lux: number): [number, number, number] {
  const s = LUX_STOPS;
  if (lux <= s[0].lux) return s[0].color;
  for (let i = 1; i < s.length; i++) {
    if (lux <= s[i].lux) {
      const t = (lux - s[i - 1].lux) / (s[i].lux - s[i - 1].lux);
      const a = s[i - 1].color;
      const b = s[i].color;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
  }
  return s[s.length - 1].color;
}

/** نقطة هدف الكشاف على الأرض (لرسم اتجاهه) */
export function floodTarget(el: PlanElement): Vec2 {
  const tilt = Math.max(5, Math.min(90, el.light?.tilt ?? 45)) * DEG;
  const h = el.light?.mountHeight ?? el.height;
  const reach = Math.min(h / Math.tan(tilt), 40);
  return add({ x: el.x, y: el.y }, scale(rotate({ x: 0, y: 1 }, el.rotation), reach));
}

export function totalLightingWatts(plan: Plan): number {
  let w = 0;
  for (const el of plan.elements) {
    if (!el.light || !isLightKind(el.kind)) continue;
    if (el.kind === 'string-lights') w += el.light.watts * stringBulbs(el).length;
    else w += el.light.watts;
  }
  return w;
}
