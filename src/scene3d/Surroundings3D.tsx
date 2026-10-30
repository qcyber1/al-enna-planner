// ما يحيط بالعنة في المشهد ثلاثي الأبعاد: بحر، طعوس، حزم
import { memo, useMemo } from 'react';
import * as THREE from 'three';
import type { Land } from '../types/plan';
import { add, landEdges, lerp, scale } from '../lib/geometry';
import type { WorldInfo } from './world';

function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export const Surroundings3D = memo(function Surroundings3D({ land, w }: { land: Land; w: WorldInfo }) {
  const items = useMemo(() => {
    const kinds = land.surroundings ?? [];
    const edges = landEdges(land);
    const sea: { pos: [number, number, number]; rot: number; len: number }[] = [];
    const mounds: { pos: [number, number, number]; scale: [number, number, number]; rot: number; rock: boolean }[] = [];
    edges.forEach((e, i) => {
      const kind = kinds[i] ?? 'open';
      if (kind === 'open') return;
      const out = scale(e.inward, -1);
      const ang = Math.atan2(e.dir.y, e.dir.x);
      if (kind === 'sea') {
        const c = add(lerp(e.a, e.b, 0.5), scale(out, 8 + 600));
        sea.push({ pos: [c.x - w.ox, 0.06, c.y - w.oy], rot: -ang, len: e.length + 1400 });
        return;
      }
      const r = rnd(i * 97 + 13);
      const n = Math.max(4, Math.round(e.length / 7));
      for (let k = 0; k < n + 4; k++) {
        const t = (k - 2 + r() * 0.8) / n;
        const d = (kind === 'dunes' ? 16 : 14) + r() * 22;
        const p = add(add(e.a, scale(e.dir, t * e.length)), scale(out, d));
        if (kind === 'dunes') {
          mounds.push({ pos: [p.x - w.ox, -1.5, p.y - w.oy], scale: [7 + r() * 8, 4 + r() * 5, 5 + r() * 6], rot: -ang + (r() - 0.5) * 0.6, rock: false });
        } else {
          mounds.push({ pos: [p.x - w.ox, 0, p.y - w.oy], scale: [6 + r() * 7, 2.5 + r() * 4, 4 + r() * 5], rot: r() * Math.PI, rock: true });
        }
      }
    });
    return { sea, mounds };
  }, [land, w]);

  const water = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2d8ea6', roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.95 }),
    [],
  );
  if (!items.sea.length && !items.mounds.length) return null;
  return (
    <group>
      {items.sea.map((s, i) => (
        <group key={i} position={s.pos} rotation={[0, s.rot, 0]}>
          {/* شاطئ رطب ثم ماء */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 591]} receiveShadow>
            <planeGeometry args={[s.len, 18]} />
            <meshStandardMaterial color="#cbb58c" roughness={0.9} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={water}>
            <planeGeometry args={[s.len, 1200]} />
          </mesh>
        </group>
      ))}
      {items.mounds.map((m, i) =>
        m.rock ? (
          <mesh key={i} position={m.pos} rotation={[0, m.rot, 0]} scale={m.scale} castShadow receiveShadow>
            <cylinderGeometry args={[0.8, 1, 1, 7, 1]} />
            <meshStandardMaterial color="#9c8466" roughness={1} flatShading />
          </mesh>
        ) : (
          <mesh key={i} position={m.pos} rotation={[0, m.rot, 0]} scale={m.scale} castShadow receiveShadow>
            <sphereGeometry args={[1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#e2c08a" roughness={1} />
          </mesh>
        ),
      )}
    </group>
  );
});
