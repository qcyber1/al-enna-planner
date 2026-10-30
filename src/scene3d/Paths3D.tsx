import { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PlanElement, Vec2 } from '../types/plan';
import { pathRibbonGeometry } from './geometry3d';
import { useMat } from './common';
import { pathTexture, woodTexture } from './textures';
import { pathEdgeLights, stringBulbs, LIGHT_HEX } from '../lib/lighting';
import { dist } from '../lib/geometry';

const THICK: Record<string, number> = {
  turf: 0.035,
  'wood-turf': 0.13,
  tiles: 0.05,
  sand: 0.012,
  stone: 0.045,
};

/** ممر ثلاثي الأبعاد (إحداثيات المخطط مباشرة داخل مجموعة مزاحة) */
export const Path3D = memo(function Path3D({ el, lampsOn }: { el: PlanElement; lampsOn: boolean }) {
  const p = el.path!;
  const pts = el.points ?? [];
  const { tex, tile } = pathTexture(p.material);
  const t = THICK[p.material] ?? 0.04;
  const geo = useMemo(() => pathRibbonGeometry(pts, p.width, t, tile), [pts, p.width, t, tile]);
  useEffect(
    () => () => {
      geo.top.dispose();
      geo.sides.dispose();
    },
    [geo],
  );
  const topMat = useMat({ color: p.material === 'sand' ? '#f0dcae' : p.material === 'turf' || p.material === 'wood-turf' ? '#c4f59a' : '#ffffff', map: tex, roughness: p.material === 'tiles' ? 0.7 : 1, side: THREE.DoubleSide });
  const sideMat = useMat({
    color: p.material === 'wood-turf' ? '#ffffff' : p.material === 'turf' ? '#2f6a22' : '#a89a86',
    map: p.material === 'wood-turf' ? woodTexture() : null,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const lights = useMemo(() => pathEdgeLights(el), [el]);
  return (
    <group>
      <mesh geometry={geo.top} material={topMat} receiveShadow castShadow={p.material === 'wood-turf'} />
      <mesh geometry={geo.sides} material={sideMat} receiveShadow />
      {lights.length > 0 && <Bollards points={lights} on={lampsOn} />}
    </group>
  );
});

function Bollards({ points, on }: { points: Vec2[]; on: boolean }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4();
    points.forEach((p, i) => {
      m.makeTranslation(p.x, 0.2, p.y);
      body.current?.setMatrixAt(i, m);
      m.makeTranslation(p.x, 0.44, p.y);
      head.current?.setMatrixAt(i, m);
    });
    if (body.current) body.current.instanceMatrix.needsUpdate = true;
    if (head.current) head.current.instanceMatrix.needsUpdate = true;
  }, [points]);
  return (
    <>
      <instancedMesh ref={body} args={[undefined, undefined, points.length]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.4, 8]} />
        <meshStandardMaterial color="#2d2a26" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, points.length]}>
        <cylinderGeometry args={[0.07, 0.07, 0.08, 10]} />
        <meshStandardMaterial
          color={on ? '#fff0c8' : '#cfc6b4'}
          emissive={on ? LIGHT_HEX.warm : '#000000'}
          emissiveIntensity={on ? 2.5 : 0}
          toneMapped={!on}
        />
      </instancedMesh>
    </>
  );
}

/** سلسلة ليتات معلقة مع أعمدة تلقائية */
export const StringLights3D = memo(function StringLights3D({
  el,
  lampsOn,
  poleSpots,
}: {
  el: PlanElement;
  lampsOn: boolean;
  poleSpots: Vec2[];
}) {
  const bulbs = useMemo(() => stringBulbs(el), [el]);
  const on = lampsOn && !!el.light?.on;
  const color = LIGHT_HEX[el.light?.color ?? 'warm'];
  const wire = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr: number[] = [];
    for (const b of bulbs) arr.push(b.p.x, b.h + 0.06, b.p.y);
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }, [bulbs]);
  useEffect(() => () => wire.dispose(), [wire]);
  const inst = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4();
    bulbs.forEach((b, i) => {
      m.makeTranslation(b.p.x, b.h, b.p.y);
      inst.current?.setMatrixAt(i, m);
    });
    if (inst.current) inst.current.instanceMatrix.needsUpdate = true;
  }, [bulbs]);
  const h = el.light?.mountHeight ?? el.height;
  const autoPoles = el.string?.autoPoles
    ? (el.points ?? []).filter((p) => !poleSpots.some((q) => dist(p, q) < 0.45))
    : [];
  return (
    <group>
      <line>
        <primitive object={wire} attach="geometry" />
        <lineBasicMaterial color="#2a2018" />
      </line>
      <instancedMesh ref={inst} args={[undefined, undefined, Math.max(1, bulbs.length)]} count={bulbs.length}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshStandardMaterial
          color={on ? '#fff3d6' : '#d8d2c4'}
          emissive={on ? color : '#000000'}
          emissiveIntensity={on ? 3 : 0}
          toneMapped={!on}
          roughness={0.3}
        />
      </instancedMesh>
      {autoPoles.map((p, i) => (
        <mesh key={i} position={[p.x, (h + 0.25) / 2, p.y]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, h + 0.25, 8]} />
          <meshStandardMaterial color="#5a3d26" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
});
