import { memo, useMemo } from 'react';
import * as THREE from 'three';
import type { PlanElement, Side } from '../types/plan';
import { bedouinRoofGeometry, hipRoofGeometry, wallPieces } from './geometry3d';
import { Pole, Ropes, scaledPlane, useGeometry, useMat, WOOD } from './common';
import { bedouinTexture, carpetTexture, fabricTexture, liningTexture, saduTexture } from './textures';
import { tentLightPositions } from '../lib/lighting';
import { worldToLocal } from '../lib/geometry';
import { shade } from '../lib/color';

interface Props {
  el: PlanElement;
  glow: boolean;
  lampsOn: boolean;
}

const SIDES: { side: Side; pos: (w: number, d: number) => [number, number, number]; rot: number }[] = [
  { side: 'front', pos: (_w, d) => [0, 0, d / 2], rot: 0 },
  { side: 'back', pos: (_w, d) => [0, 0, -d / 2], rot: Math.PI },
  { side: 'right', pos: (w) => [w / 2, 0, 0], rot: Math.PI / 2 },
  { side: 'left', pos: (w) => [-w / 2, 0, 0], rot: -Math.PI / 2 },
];

/** إزاحة الباب على محور الضلع المحلي بعد التدوير */
function sideDoorCenter(side: Side, off: number): number {
  return side === 'back' || side === 'right' ? -off : off;
}

function Valance({ len, h, y, material }: { len: number; h: number; y: number; material: THREE.Material }) {
  const geo = useGeometry(() => scaledPlane(len, h, 1.2, h), [len, h]);
  return <mesh position={[0, y, 0.035]} geometry={geo} material={material} />;
}

export const Tent3D = memo(function Tent3D({ el, glow, lampsOn }: Props) {
  const t = el.tent!;
  const w = el.width;
  const d = el.depth;
  const style = t.style;
  const H = Math.max(el.height, 1.2);
  const wh = Math.max(0.8, Math.min(t.wallHeight, H - (style === 'bedouin' ? 0.4 : 0.3)));
  const along = t.entranceSide === 'front' || t.entranceSide === 'back' ? w : d;
  const ew = Math.min(t.entranceWidth, along - 0.1);
  const off = Math.max(-along / 2 + ew / 2, Math.min(along / 2 - ew / 2, t.entranceOffset));
  const doorH = style === 'bedouin' ? wh : Math.min(wh - 0.12, 2.25);

  const outer = useMat({
    color: el.color,
    map: style === 'bedouin' ? bedouinTexture() : fabricTexture(),
    roughness: 0.95,
    side: THREE.DoubleSide,
    emissive: glow ? '#ffae55' : '#000000',
    emissiveIntensity: glow ? (style === 'bedouin' ? 0.05 : 0.32) : 0,
  });
  const lining = useMat({ color: '#ffffff', map: liningTexture(el.accent), roughness: 0.9, emissive: glow ? '#ffb060' : '#000000', emissiveIntensity: glow ? 0.25 : 0 });
  const sadu = useMat({ color: '#ffffff', map: saduTexture(el.accent), roughness: 0.85, side: THREE.DoubleSide });
  const carpet = useMat({ color: '#ffffff', map: carpetTexture(el.accent === '#9b2c2c' ? '#8e2a2a' : shade(el.accent, -0.1), '#1f3d2b'), roughness: 1 });
  const wallMats = useMemo(() => [outer, outer, outer, outer, outer, lining], [outer, lining]);

  const roof = useGeometry(() => {
    if (style === 'bedouin') return bedouinRoofGeometry(w, d, wh, H);
    return hipRoofGeometry(w, d, wh, H, 0.18, style === 'pyramid');
  }, [style, w, d, wh, H]);

  const floor = useGeometry(() => scaledPlane(Math.max(0.2, w - 0.12), Math.max(0.2, d - 0.12), 2, 2), [w, d]);

  // الجدران
  const walls = SIDES.map((s) => {
    const len = s.side === 'front' || s.side === 'back' ? w : d;
    const door = s.side === t.entranceSide ? { center: sideDoorCenter(s.side, off), width: ew, height: doorH } : undefined;
    const wallH = style === 'bedouin' ? wh - 0.15 : wh;
    return { ...s, len, door, pieces: wallPieces(len, wallH, door) };
  });

  // الأعمدة الداخلية
  const poles: { x: number; z: number; h: number }[] = [];
  if (style === 'pyramid') poles.push({ x: 0, z: 0, h: H });
  else if (style === 'bedouin') {
    const n = Math.max(1, Math.round(w / 3));
    for (let i = 0; i < n; i++) poles.push({ x: -w / 2 + (w / n) * (i + 0.5), z: 0, h: H - 0.05 });
  } else if (w >= d) {
    const r = w / 2 - d / 2;
    const n = Math.max(1, Math.round((2 * r) / 4));
    for (let i = 0; i <= n; i++) poles.push({ x: -r + ((2 * r) / n) * i, z: 0, h: H });
  } else {
    const r = d / 2 - w / 2;
    const n = Math.max(1, Math.round((2 * r) / 4));
    for (let i = 0; i <= n; i++) poles.push({ x: 0, z: -r + ((2 * r) / n) * i, h: H });
  }

  // حبال الشد
  const ropes = useMemo(() => {
    const segs: [number, number, number][] = [];
    const out = 1.3;
    const eave = style === 'bedouin' ? wh - 0.25 : wh;
    const stepsX = Math.max(1, Math.round(w / 2.5));
    const stepsZ = Math.max(1, Math.round(d / 2.5));
    for (let i = 0; i <= stepsX; i++) {
      const x = -w / 2 + (w / stepsX) * i;
      segs.push([x, eave, -d / 2 - 0.18], [x * 1.08, 0, -d / 2 - out]);
      if (t.entranceSide !== 'front' || Math.abs(x - off) > ew / 2 + 0.3)
        segs.push([x, eave, d / 2 + 0.18], [x * 1.08, 0, d / 2 + out]);
    }
    for (let j = 1; j < stepsZ; j++) {
      const z = -d / 2 + (d / stepsZ) * j;
      segs.push([-w / 2 - 0.18, eave, z], [-w / 2 - out, 0, z * 1.08]);
      segs.push([w / 2 + 0.18, eave, z], [w / 2 + out, 0, z * 1.08]);
    }
    return segs;
  }, [w, d, wh, style, t.entranceSide, off, ew]);

  // الأثاث الداخلي
  const interior = useMemo(() => {
    const items: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [];
    const cushion = el.accent;
    const back = shade(el.accent, -0.25);
    if (t.interior === 'majlis') {
      const depth = Math.min(0.75, Math.min(w, d) * 0.18);
      // على طول الجدار الخلفي
      items.push({ pos: [0, 0.17, -d / 2 + 0.1 + depth / 2], size: [w - 0.3, 0.34, depth], color: cushion });
      items.push({ pos: [0, 0.5, -d / 2 + 0.2], size: [w - 0.3, 0.45, 0.18], color: back });
      for (const sx of [-1, 1]) {
        const L = d - depth - 1.2;
        if (L <= 0.4) continue;
        items.push({ pos: [sx * (w / 2 - 0.1 - depth / 2), 0.17, -d / 2 + depth + 0.15 + L / 2], size: [depth, 0.34, L], color: cushion });
        items.push({ pos: [sx * (w / 2 - 0.2), 0.5, -d / 2 + depth + 0.15 + L / 2], size: [0.18, 0.45, L], color: back });
      }
    } else if (t.interior === 'dining') {
      const rows = Math.max(1, Math.floor(d / 2.6));
      for (let r = 0; r < rows; r++) {
        const z = -d / 2 + (d / rows) * (r + 0.5);
        items.push({ pos: [0, 0.74, z], size: [w * 0.7, 0.05, 0.9], color: '#7b5434' });
        items.push({ pos: [0, 0.37, z], size: [w * 0.66, 0.7, 0.08], color: '#5d3f27' });
        items.push({ pos: [0, 0.23, z - 0.75], size: [w * 0.66, 0.45, 0.4], color: cushion });
        items.push({ pos: [0, 0.23, z + 0.75], size: [w * 0.66, 0.45, 0.4], color: cushion });
      }
    } else if (t.interior === 'kitchen') {
      items.push({ pos: [0, 0.45, -d / 2 + 0.45], size: [w - 0.6, 0.9, 0.65], color: '#cbbfa8' });
      items.push({ pos: [-w / 2 + 0.45, 0.45, 0], size: [0.65, 0.9, d * 0.5], color: '#cbbfa8' });
      items.push({ pos: [w / 4, 0.92, -d / 2 + 0.45], size: [0.8, 0.04, 0.5], color: '#2d2d2d' });
    }
    return items;
  }, [t.interior, w, d, el.accent]);

  // فانوس المدخل
  const lantern = useMemo(() => {
    if (!t.entranceLight) return null;
    const pos = tentLightPositions(el);
    if (!pos) return null;
    const l = worldToLocal(el, pos.entrance);
    return { x: l.x, z: l.y, y: Math.max(1.6, wh - 0.3) };
  }, [el, t.entranceLight, wh]);

  const valanceH = Math.min(0.42, wh * 0.18);
  const doorSide = walls.find((s) => s.door);

  return (
    <group>
      {/* الجدران مع بطانة داخلية */}
      {walls.map((s) => (
        <group key={s.side} position={s.pos(w, d)} rotation={[0, s.rot, 0]}>
          {s.pieces.map(([x0, x1, y0, y1], i) => (
            <mesh key={i} position={[(x0 + x1) / 2, (y0 + y1) / 2, 0]} material={wallMats} castShadow receiveShadow>
              <boxGeometry args={[x1 - x0, y1 - y0, 0.05]} />
            </mesh>
          ))}
          {style !== 'bedouin' && (
            <Valance len={s.len} h={valanceH} y={wh - valanceH / 2} material={sadu} />
          )}
        </group>
      ))}

      {/* أطراف الباب المربوطة */}
      {doorSide?.door && (
        <group position={doorSide.pos(w, d)} rotation={[0, doorSide.rot, 0]}>
          {[-1, 1].map((sgn) => (
            <mesh
              key={sgn}
              position={[doorSide.door!.center + sgn * (ew / 2 + 0.12), doorH * 0.5, 0.18]}
              rotation={[0, sgn * 0.9, 0]}
              material={outer}
              castShadow
            >
              <planeGeometry args={[0.5, doorH * 0.98]} />
            </mesh>
          ))}
        </group>
      )}

      {/* السقف */}
      <mesh geometry={roof} material={outer} castShadow receiveShadow />
      {style === 'pyramid' && (
        <mesh position={[0, H + 0.12, 0]} castShadow>
          <sphereGeometry args={[0.1, 12, 8]} />
          <meshStandardMaterial color="#c9a24a" metalness={0.6} roughness={0.35} />
        </mesh>
      )}

      {/* الأرضية */}
      <mesh geometry={floor} material={carpet} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow />

      {/* الأعمدة */}
      {poles.map((p, i) => (
        <Pole key={i} x={p.x} z={p.z} h={p.h} r={0.06} color={WOOD} />
      ))}
      {[
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ].map(([x, z], i) => (
        <Pole key={`c${i}`} x={x * 1.004} z={z * 1.004} h={style === 'bedouin' ? wh - 0.2 : wh} r={0.05} color={WOOD} />
      ))}

      <Ropes segments={ropes} />

      {interior.map((it, i) => (
        <mesh key={i} position={it.pos} castShadow receiveShadow>
          <boxGeometry args={it.size} />
          <meshStandardMaterial color={it.color} roughness={0.95} />
        </mesh>
      ))}

      {lantern && (
        <group position={[lantern.x, 0, lantern.z]}>
          <mesh position={[0, lantern.y / 2, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.03, lantern.y, 6]} />
            <meshStandardMaterial color="#3b2a1e" />
          </mesh>
          <mesh position={[0, lantern.y + 0.12, 0]}>
            <boxGeometry args={[0.2, 0.28, 0.2]} />
            <meshStandardMaterial
              color={lampsOn ? '#ffe2a8' : '#b9a27a'}
              emissive={lampsOn ? '#ffb347' : '#000000'}
              emissiveIntensity={lampsOn ? 2.2 : 0}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0, lantern.y + 0.3, 0]}>
            <coneGeometry args={[0.16, 0.14, 4]} />
            <meshStandardMaterial color="#c9a24a" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      )}
    </group>
  );
});
