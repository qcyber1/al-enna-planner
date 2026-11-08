// نماذج ثلاثية الأبعاد لعناصر العزبة (المركز 0،0 — المحور z = عمق المسقط، الأمام +z)
import { useMemo } from 'react';
import * as THREE from 'three';
import type { PlanElement } from '../types/plan';
import { Pole, useMat } from './common';
import { corrugatedTexture } from './textures';
import { shade } from '../lib/color';
import { Interior3D } from './Interior3D';

interface P {
  el: PlanElement;
  night: boolean;
  lampsOn: boolean;
}

/** رقم عشوائي ثابت حسب العنصر (عشان الحيوانات ما تتحرك كل رسم) */
function rng(seed: number) {
  let s = seed % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}
const seedOf = (el: PlanElement) => Math.round(el.width * 7 + el.depth * 13 + el.x * 3 + el.y * 5);

/** سياج مواسير حول حوش، مع فتحة بوابة من قدام */
function PipeFence({ w, d, h, color, gate = 2.4 }: { w: number; d: number; h: number; color: string; gate?: number }) {
  const rails = [h * 0.35, h * 0.68, h];
  const posts: [number, number][] = [];
  const nx = Math.max(1, Math.round(w / 2.5));
  const nz = Math.max(1, Math.round(d / 2.5));
  for (let i = 0; i <= nx; i++) {
    const x = -w / 2 + (w / nx) * i;
    posts.push([x, -d / 2]);
    if (Math.abs(x) > gate / 2 - 0.01) posts.push([x, d / 2]);
  }
  for (let j = 1; j < nz; j++) {
    const z = -d / 2 + (d / nz) * j;
    posts.push([-w / 2, z], [w / 2, z]);
  }
  const g = Math.min(gate, w * 0.25);
  const segs: { x: number; z: number; len: number; rotY: number }[] = [
    { x: 0, z: -d / 2, len: w, rotY: 0 },
    { x: -w / 2, z: 0, len: d, rotY: Math.PI / 2 },
    { x: w / 2, z: 0, len: d, rotY: Math.PI / 2 },
    { x: -(w / 2 + g / 2) / 2, z: d / 2, len: w / 2 - g / 2, rotY: 0 },
    { x: (w / 2 + g / 2) / 2, z: d / 2, len: w / 2 - g / 2, rotY: 0 },
  ];
  return (
    <group>
      {posts.map(([x, z], i) => (
        <Pole key={i} x={x} z={z} h={h} r={0.045} color={color} />
      ))}
      {segs.flatMap((s, si) =>
        rails.map((y, ri) => (
          <mesh key={`${si}-${ri}`} position={[s.x, y, s.z]} rotation={[0, s.rotY, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, s.len, 6]} />
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.5} />
          </mesh>
        )),
      )}
      {/* البوابة نص مفتوحة */}
      <mesh position={[-g / 2 + (g * 0.5) / 2, h * 0.55, d / 2 + g * 0.2]} rotation={[0, -0.6, 0]}>
        <boxGeometry args={[g * 0.55, h * 0.8, 0.04]} />
        <meshStandardMaterial color={shade(color, -0.2)} metalness={0.5} wireframe />
      </mesh>
    </group>
  );
}

/** سقف صاج مائل على أعمدة */
function ShedRoof({ w, d, h, color, poleColor, x = 0, z = 0 }: { w: number; d: number; h: number; color: string; poleColor: string; x?: number; z?: number }) {
  const mat = useMat({ color, map: corrugatedTexture(), roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide });
  const slope = Math.min(0.5, d * 0.08);
  const n = Math.max(1, Math.round(w / 4));
  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: n + 1 }).flatMap((_, i) => {
        const px = -w / 2 + 0.1 + ((w - 0.2) / n) * i;
        return [
          <Pole key={`a${i}`} x={px} z={-d / 2 + 0.1} h={h} r={0.06} color={poleColor} />,
          <Pole key={`b${i}`} x={px} z={d / 2 - 0.1} h={h - slope} r={0.06} color={poleColor} />,
        ];
      })}
      <mesh position={[0, h - slope / 2 + 0.03, 0]} rotation={[-Math.atan2(slope, d), 0, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[w + 0.3, 0.04, Math.hypot(d, slope) + 0.3]} />
      </mesh>
    </group>
  );
}

function Sheep({ x, z, rot, s = 1 }: { x: number; z: number; rot: number; s?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]} scale={s}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.8, 0.45, 0.42]} />
        <meshStandardMaterial color="#f1ece0" roughness={1} />
      </mesh>
      <mesh position={[0.48, 0.62, 0]} castShadow>
        <boxGeometry args={[0.24, 0.24, 0.2]} />
        <meshStandardMaterial color="#3a2f28" roughness={1} />
      </mesh>
      {[-0.28, 0.28].flatMap((lx) =>
        [-0.13, 0.13].map((lz) => (
          <mesh key={`${lx}${lz}`} position={[lx, 0.15, lz]}>
            <boxGeometry args={[0.08, 0.3, 0.08]} />
            <meshStandardMaterial color="#3a2f28" />
          </mesh>
        )),
      )}
    </group>
  );
}

function Camel({ x, z, rot }: { x: number; z: number; rot: number }) {
  const c = '#c49a6c';
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 1.55, 0]} castShadow>
        <boxGeometry args={[1.6, 0.7, 0.6]} />
        <meshStandardMaterial color={c} roughness={1} />
      </mesh>
      <mesh position={[0, 2.0, 0]} castShadow>
        <sphereGeometry args={[0.38, 10, 8]} />
        <meshStandardMaterial color={c} roughness={1} />
      </mesh>
      <mesh position={[1.0, 2.0, 0]} rotation={[0, 0, -0.5]} castShadow>
        <boxGeometry args={[0.25, 1.0, 0.25]} />
        <meshStandardMaterial color={c} roughness={1} />
      </mesh>
      <mesh position={[1.3, 2.45, 0]} castShadow>
        <boxGeometry args={[0.45, 0.25, 0.25]} />
        <meshStandardMaterial color={shade(c, -0.1)} roughness={1} />
      </mesh>
      {[-0.6, 0.6].flatMap((lx) =>
        [-0.2, 0.2].map((lz) => (
          <mesh key={`${lx}${lz}`} position={[lx, 0.62, lz]}>
            <boxGeometry args={[0.13, 1.25, 0.13]} />
            <meshStandardMaterial color={shade(c, -0.05)} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Pen({ el, camel }: P & { camel: boolean }) {
  const w = el.width;
  const d = el.depth;
  const sd = Math.min(d * 0.4, 5);
  const animals = useMemo(() => {
    const r = rng(seedOf(el));
    const per = camel ? 30 : 6;
    const n = Math.max(2, Math.min(camel ? 8 : 16, Math.round((w * (d - sd)) / per)));
    const m = camel ? 1.6 : 0.6;
    return Array.from({ length: n }, () => ({
      x: (r() - 0.5) * (w - 2 * m),
      z: -d / 2 + sd + m + r() * Math.max(0.1, d - sd - 2 * m),
      rot: r() * Math.PI * 2,
    }));
  }, [el, camel, w, d, sd]);
  return (
    <group>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={el.color} roughness={1} />
      </mesh>
      <PipeFence w={w} d={d} h={el.height} color={el.accent} />
      <ShedRoof w={w - 0.2} d={sd} h={camel ? 3.4 : 2.6} z={-d / 2 + sd / 2} color={el.roof ?? '#d6d3cc'} poleColor="#7d7f82" />
      <mesh position={[0, 0.3, -d / 2 + sd + 0.4]} castShadow>
        <boxGeometry args={[w * 0.7, 0.5, 0.5]} />
        <meshStandardMaterial color="#9aa3a8" metalness={0.4} />
      </mesh>
      {animals.map((a, i) => (camel ? <Camel key={i} {...a} /> : <Sheep key={i} {...a} />))}
    </group>
  );
}

function Stable({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const h = el.height;
  const n = Math.max(1, Math.round(w / 3.5));
  const bw = w / n;
  const wall = useMat({ color: el.color, roughness: 0.9 });
  return (
    <group>
      {/* الجدار الخلفي والجوانب */}
      <mesh position={[0, h / 2 - 0.2, -d / 2 + 0.1]} material={wall} castShadow receiveShadow>
        <boxGeometry args={[w, h - 0.4, 0.2]} />
      </mesh>
      {Array.from({ length: n + 1 }).map((_, i) => (
        <mesh key={i} position={[-w / 2 + bw * i, 1.1, -0.6]} material={wall} castShadow>
          <boxGeometry args={[0.15, 2.2, d - 1.2]} />
        </mesh>
      ))}
      {/* أبواب البوكسات (نص باب) */}
      {Array.from({ length: n }).map((_, i) => (
        <mesh key={i} position={[-w / 2 + bw * (i + 0.5), 0.65, d / 2 - 1.2]} castShadow>
          <boxGeometry args={[bw * 0.9, 1.3, 0.08]} />
          <meshStandardMaterial color={el.accent} roughness={0.8} />
        </mesh>
      ))}
      <ShedRoof w={w + 0.4} d={d} h={h} color={el.roof ?? shade(el.color, -0.05)} poleColor={el.accent} />
    </group>
  );
}

function AnimalShade({ el }: P) {
  return <ShedRoof w={el.width} d={el.depth} h={el.height} color={el.roof ?? el.color} poleColor={el.accent} />;
}

function FeedStore({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const bales = useMemo(() => {
    const out: [number, number, number][] = [];
    const cols = Math.max(1, Math.floor((w - 0.6) / 1.1));
    for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) for (let l = 0; l < 2; l++) out.push([-w / 2 + 0.6 + c * 1.1, 0.3 + l * 0.5, -d / 2 + 0.7 + r * 0.8]);
    return out;
  }, [w, d]);
  return (
    <group>
      {bales.map((b, i) => (
        <mesh key={i} position={b} castShadow>
          <boxGeometry args={[1, 0.48, 0.7]} />
          <meshStandardMaterial color={i % 3 ? '#d9b84e' : '#c9a63e'} roughness={1} />
        </mesh>
      ))}
      <ShedRoof w={w} d={d} h={el.height} color={el.roof ?? el.color} poleColor="#6b6b6b" />
    </group>
  );
}

function Trough({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const h = el.height;
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={el.color} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, h - 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.12, d - 0.12]} />
        <meshStandardMaterial color={el.accent} roughness={0.15} metalness={0.2} />
      </mesh>
    </group>
  );
}

/** سقف ساندوتش بانل (كيربي) مائل شوي مع بروز من كل جهة */
function KirbyRoof({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  const mat = useMat({ color, map: corrugatedTexture(), roughness: 0.5, metalness: 0.3 });
  const slope = Math.min(0.35, d * 0.05);
  return (
    <group>
      <mesh position={[0, h + 0.02, 0]}>
        <boxGeometry args={[w + 0.05, 0.08, d + 0.05]} />
        <meshStandardMaterial color="#d8d4cc" />
      </mesh>
      <mesh position={[0, h + 0.1 + slope / 2, 0]} rotation={[Math.atan2(slope, d), 0, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[w + 0.6, 0.07, Math.hypot(d, slope) + 0.6]} />
      </mesh>
    </group>
  );
}

function Room({ el, night, lampsOn, majlis }: P & { majlis: boolean }) {
  const w = el.width;
  const d = el.depth;
  const h = el.height;
  const lit = night && lampsOn;
  const dw = Math.min(1.2, w * 0.25);
  const wins = majlis ? Math.max(1, Math.floor(w / 3)) : 1;
  return (
    <group>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[w + 0.6, 0.2, d + 0.6]} />
        <meshStandardMaterial color="#cfc6b6" roughness={1} />
      </mesh>
      <mesh position={[0, 0.2 + (h - 0.2) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h - 0.2, d]} />
        <meshStandardMaterial color={el.color} roughness={0.9} />
      </mesh>
      {el.roof ? (
        <KirbyRoof w={w} d={d} h={h} color={el.roof} />
      ) : (
        /* إطار السطح */
        <mesh position={[0, h + 0.15, 0]} castShadow>
          <boxGeometry args={[w + 0.2, 0.3, d + 0.2]} />
          <meshStandardMaterial color={shade(el.color, -0.12)} />
        </mesh>
      )}
      {majlis && !el.roof && (
        <mesh position={[0, h + 0.36, 0]}>
          <boxGeometry args={[w + 0.25, 0.12, d + 0.25]} />
          <meshStandardMaterial color={el.accent} />
        </mesh>
      )}
      {/* الباب */}
      <mesh position={[0, 0.2 + 1.1, d / 2 + 0.01]}>
        <boxGeometry args={[dw, 2.2, 0.05]} />
        <meshStandardMaterial color={el.accent} roughness={0.6} />
      </mesh>
      {/* الشبابيك */}
      {Array.from({ length: wins }).map((_, i) => {
        const x = -w / 2 + (w / (wins + 1)) * (i + 1);
        if (Math.abs(x) < dw) return null;
        return (
          <mesh key={i} position={[x, 1.6, d / 2 + 0.01]}>
            <planeGeometry args={[1.2, 0.9]} />
            <meshStandardMaterial color={lit ? '#ffd79a' : '#9fc3d8'} emissive={lit ? '#ffb35c' : '#000'} emissiveIntensity={lit ? 0.9 : 0} metalness={lit ? 0 : 0.5} roughness={0.2} />
          </mesh>
        );
      })}
      {/* إنارة المدخل */}
      <mesh position={[0, 2.65, d / 2 + 0.08]}>
        <boxGeometry args={[0.25, 0.12, 0.12]} />
        <meshStandardMaterial color={lit ? '#fff1c9' : '#ccc'} emissive={lit ? '#ffb347' : '#000'} emissiveIntensity={lit ? 2.5 : 0} toneMapped={!lit} />
      </mesh>
      {/* مكيف */}
      <mesh position={[w / 2 - 0.6, 1.9, -d / 2 - 0.2]} castShadow>
        <boxGeometry args={[0.8, 0.5, 0.35]} />
        <meshStandardMaterial color="#e6e6e6" />
      </mesh>
    </group>
  );
}

function Palm({ el }: P) {
  const h = el.height;
  const r = Math.min(el.width, el.depth) / 2;
  const fronds = 12;
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.28, h, 8]} />
        <meshStandardMaterial color={el.accent} roughness={1} />
      </mesh>
      {Array.from({ length: fronds }).map((_, i) => {
        const a = (i / fronds) * Math.PI * 2;
        const droop = i % 2 ? 0.55 : 0.3;
        return (
          <group key={i} position={[0, h, 0]} rotation={[0, a, 0]}>
            <mesh position={[r * 0.48, -r * droop * 0.45, 0]} rotation={[0, 0, -droop]} castShadow>
              <boxGeometry args={[r, 0.04, 0.55]} />
              <meshStandardMaterial color={i % 2 ? el.color : shade(el.color, 0.12)} roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      {/* عذوق */}
      <mesh position={[0, h - 0.5, 0]}>
        <sphereGeometry args={[0.45, 8, 6]} />
        <meshStandardMaterial color="#b5772f" roughness={1} />
      </mesh>
    </group>
  );
}

function Tree({ el }: P) {
  const h = el.height;
  const r = Math.min(el.width, el.depth) / 2;
  const blobs = useMemo(() => {
    const g = rng(seedOf(el));
    return Array.from({ length: 6 }, () => [(g() - 0.5) * r, h * 0.62 + (g() - 0.3) * r * 0.5, (g() - 0.5) * r, r * (0.45 + g() * 0.25)] as const);
  }, [el, r, h]);
  return (
    <group>
      <mesh position={[0, h * 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, h * 0.6, 7]} />
        <meshStandardMaterial color={el.accent} roughness={1} />
      </mesh>
      {blobs.map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[s, 1]} />
          <meshStandardMaterial color={i % 2 ? el.color : shade(el.color, 0.1)} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function FarmBed({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const rows = Math.max(1, Math.floor(d / 1.2));
  const rh = d / rows;
  const plants = Math.max(1, Math.floor((w - 0.6) / 0.6));
  return (
    <group>
      {Array.from({ length: rows }).map((_, i) => {
        const z = -d / 2 + rh * (i + 0.45);
        return (
          <group key={i}>
            <mesh position={[0, 0.1, z]} receiveShadow>
              <boxGeometry args={[w - 0.4, 0.2, rh * 0.6]} />
              <meshStandardMaterial color={el.color} roughness={1} />
            </mesh>
            <instancedMesh
              args={[undefined, undefined, plants]}
              ref={(m) => {
                if (!m) return;
                const o = new THREE.Object3D();
                for (let k = 0; k < plants; k++) {
                  o.position.set(-w / 2 + 0.5 + k * 0.6, 0.32, z);
                  o.updateMatrix();
                  m.setMatrixAt(k, o.matrix);
                }
                m.instanceMatrix.needsUpdate = true;
              }}
              castShadow
            >
              <sphereGeometry args={[Math.min(0.24, rh * 0.22), 6, 5]} />
              <meshStandardMaterial color={el.accent} roughness={1} />
            </instancedMesh>
          </group>
        );
      })}
    </group>
  );
}

function Greenhouse({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const h = el.height;
  const geo = useMemo(() => {
    // نص أسطوانة مضغوطة: عرضها w وارتفاعها h وطولها d
    const g = new THREE.CylinderGeometry(1, 1, d, 24, 1, true, -Math.PI / 2, Math.PI);
    g.rotateX(Math.PI / 2);
    g.scale(w / 2, h, 1);
    return g;
  }, [w, d, h]);
  const n = Math.max(1, Math.round(d / 2));
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color={el.color} transparent opacity={0.55} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: n + 1 }).map((_, i) => (
        <mesh key={i} position={[0, 0, -d / 2 + (d / n) * i]} scale={[w / 2, h, 1]}>
          <torusGeometry args={[1, 0.012, 4, 24, Math.PI]} />
          <meshStandardMaterial color={el.accent} metalness={0.5} />
        </mesh>
      ))}
      {/* الزرع داخل */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[w * 0.7, 0.5, d * 0.9]} />
        <meshStandardMaterial color="#5f9a3e" roughness={1} />
      </mesh>
    </group>
  );
}

function Pool({ el, night, lampsOn }: P) {
  const w = el.width;
  const d = el.depth;
  const m = Math.min(1, w * 0.12, d * 0.15);
  const lit = night && lampsOn;
  return (
    <group>
      {/* الممشى حوله */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[w, 0.16, d]} />
        <meshStandardMaterial color={el.accent} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 2 * m, d - 2 * m]} />
        <meshStandardMaterial
          color={el.color}
          roughness={0.05}
          metalness={0.25}
          emissive={lit ? '#2a8fc4' : '#000'}
          emissiveIntensity={lit ? 0.7 : 0}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

export function Izba3D(props: P) {
  switch (props.el.kind) {
    case 'sheep-pen':
      return <Pen {...props} camel={false} />;
    case 'camel-pen':
      return <Pen {...props} camel />;
    case 'horse-stable':
      return <Stable {...props} />;
    case 'animal-shade':
      return <AnimalShade {...props} />;
    case 'feed-store':
      return <FeedStore {...props} />;
    case 'trough':
      return <Trough {...props} />;
    case 'worker-room':
      return <Room {...props} majlis={false} />;
    case 'majlis-room':
      return <Room {...props} majlis />;
    case 'palm':
      return <Palm {...props} />;
    case 'tree':
      return <Tree {...props} />;
    case 'farm-bed':
      return <FarmBed {...props} />;
    case 'greenhouse':
      return <Greenhouse {...props} />;
    case 'pool':
      return <Pool {...props} />;
    default:
      return <Interior3D {...props} />;
  }
}
