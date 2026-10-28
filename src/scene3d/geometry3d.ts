import * as THREE from 'three';
import type { Vec2 } from '../types/plan';
import { dist, polylineOutline } from '../lib/geometry';

type V3 = [number, number, number];

/** يبني هندسة من مثلثات مع نواظم مسطحة وإحداثيات UV بالمتر */
export function trianglesGeometry(tris: V3[][], uvScale = 1, uvMode: 'xz' | 'slope' = 'xz'): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  for (const t of tris) {
    for (const p of t) {
      pos.push(p[0], p[1], p[2]);
      if (uvMode === 'xz') uv.push(p[0] / uvScale, p[2] / uvScale);
      else uv.push((p[0] + p[2]) / uvScale, p[1] / uvScale);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** سقف جملوني منحدر (Hip) أو هرمي عند apex=true */
export function hipRoofGeometry(w: number, d: number, eave: number, peak: number, overhang: number, apex = false): THREE.BufferGeometry {
  const W = w / 2 + overhang;
  const D = d / 2 + overhang;
  const A: V3 = [-W, eave, -D];
  const B: V3 = [W, eave, -D];
  const C: V3 = [W, eave, D];
  const E: V3 = [-W, eave, D];
  let R1: V3;
  let R2: V3;
  if (apex) {
    R1 = [0, peak, 0];
    R2 = [0, peak, 0];
  } else if (w >= d) {
    R1 = [-W + D, peak, 0];
    R2 = [W - D, peak, 0];
  } else {
    R1 = [0, peak, -D + W];
    R2 = [0, peak, D - W];
  }
  const tris: V3[][] = [];
  if (apex || w >= d) {
    tris.push([A, R1, R2], [A, R2, B]); // الخلف
    tris.push([C, R2, R1], [C, R1, E]); // الأمام
    tris.push([E, R1, A]); // اليسار
    tris.push([B, R2, C]); // اليمين
  } else {
    tris.push([A, R1, B]);
    tris.push([C, R2, E]);
    tris.push([E, R2, R1], [E, R1, A]);
    tris.push([B, R1, R2], [B, R2, C]);
  }
  return trianglesGeometry(tris, 2, 'slope');
}

/** سقف بيت الشعر: سطح مشدود بقمم عند الأعمدة الوسطى */
export function bedouinRoofGeometry(w: number, d: number, edgeH: number, peakH: number): THREE.BufferGeometry {
  const W = w + 0.6;
  const D = d + 0.6;
  const g = new THREE.PlaneGeometry(W, D, Math.max(8, Math.round(W * 4)), Math.max(6, Math.round(D * 4)));
  g.rotateX(-Math.PI / 2);
  const n = Math.max(1, Math.round(w / 3));
  const poles = Array.from({ length: n }, (_, i) => -w / 2 + (w / n) * (i + 0.5));
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const tz = 1 - Math.pow(Math.min(1, Math.abs(z) / (D / 2)), 1.5);
    let pk = 0;
    for (const px of poles) pk = Math.max(pk, Math.exp(-(((x - px) / 1.1) ** 2)));
    const tx = 1 - Math.pow(Math.min(1, Math.abs(x) / (W / 2)), 6) * 0.35;
    const h = edgeH - 0.25 + (peakH - edgeH + 0.25) * tz * (0.72 + 0.28 * pk) * tx;
    p.setY(i, h);
  }
  g.computeVertexNormals();
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (W / 3), uv.getY(i) * (D / 3));
  return g;
}

/** شريط الممر مع السماكة والجوانب. UV بالمتر على طول وعرض الممر */
export function pathRibbonGeometry(
  points: Vec2[],
  width: number,
  thickness: number,
  tile: number,
): { top: THREE.BufferGeometry; sides: THREE.BufferGeometry } {
  const { left, right } = polylineOutline(points, width);
  const top: number[] = [];
  const topUv: number[] = [];
  const side: number[] = [];
  const sideUv: number[] = [];
  let acc = 0;
  const along: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    acc += dist(points[i - 1], points[i]);
    along.push(acc);
  }
  for (let i = 1; i < points.length; i++) {
    const l0 = left[i - 1];
    const l1 = left[i];
    const r0 = right[i - 1];
    const r1 = right[i];
    const u0 = along[i - 1] / tile;
    const u1 = along[i] / tile;
    const vL = width / tile;
    // سطح علوي
    top.push(l0.x, thickness, l0.y, r0.x, thickness, r0.y, r1.x, thickness, r1.y);
    topUv.push(0, u0, vL, u0, vL, u1);
    top.push(l0.x, thickness, l0.y, r1.x, thickness, r1.y, l1.x, thickness, l1.y);
    topUv.push(0, u0, vL, u1, 0, u1);
    // جوانب
    for (const [a, b] of [
      [l0, l1],
      [r1, r0],
    ] as [Vec2, Vec2][]) {
      const L = dist(a, b);
      side.push(a.x, 0, a.y, a.x, thickness, a.y, b.x, thickness, b.y);
      sideUv.push(0, 0, 0, thickness, L, thickness);
      side.push(a.x, 0, a.y, b.x, thickness, b.y, b.x, 0, b.y);
      sideUv.push(0, 0, L, thickness, L, 0);
    }
  }
  // نهايات
  for (const [a, b] of [
    [right[0], left[0]],
    [left[left.length - 1], right[right.length - 1]],
  ] as [Vec2, Vec2][]) {
    side.push(a.x, 0, a.y, a.x, thickness, a.y, b.x, thickness, b.y);
    sideUv.push(0, 0, 0, 1, 1, 1);
    side.push(a.x, 0, a.y, b.x, thickness, b.y, b.x, 0, b.y);
    sideUv.push(0, 0, 1, 1, 1, 0);
  }
  const gt = new THREE.BufferGeometry();
  gt.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
  gt.setAttribute('uv', new THREE.Float32BufferAttribute(topUv, 2));
  gt.computeVertexNormals();
  // ضمان أن النواظم للأعلى
  const nrm = gt.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  const gs = new THREE.BufferGeometry();
  gs.setAttribute('position', new THREE.Float32BufferAttribute(side, 3));
  gs.setAttribute('uv', new THREE.Float32BufferAttribute(sideUv, 2));
  gs.computeVertexNormals();
  return { top: gt, sides: gs };
}

/** أجزاء الجدار حول فتحة الباب: يعيد مستطيلات [x0,x1,y0,y1] على طول الضلع */
export function wallPieces(
  length: number,
  height: number,
  door?: { center: number; width: number; height: number },
): [number, number, number, number][] {
  if (!door) return [[-length / 2, length / 2, 0, height]];
  const a = Math.max(-length / 2, door.center - door.width / 2);
  const b = Math.min(length / 2, door.center + door.width / 2);
  const res: [number, number, number, number][] = [];
  if (a - -length / 2 > 0.02) res.push([-length / 2, a, 0, height]);
  if (length / 2 - b > 0.02) res.push([b, length / 2, 0, height]);
  if (height - door.height > 0.02) res.push([a, b, door.height, height]);
  return res;
}
