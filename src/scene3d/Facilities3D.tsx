import { memo, useMemo } from 'react';
import * as THREE from 'three';
import type { PlanElement } from '../types/plan';
import { Pole, scaledPlane, useGeometry, useMat, METAL, WOOD } from './common';
import { carpetTexture, corrugatedTexture, fabricTexture, groundTexture, labelTexture, netTexture, saduTexture, turfTexture } from './textures';
import { hipRoofGeometry } from './geometry3d';
import { shade } from '../lib/color';

interface P {
  el: PlanElement;
  night?: boolean;
  showSafety?: boolean;
}

// ——— ملعب الكرة الطائرة ———
export const Court3D = memo(function Court3D({ el, showSafety }: P) {
  const w = el.width;
  const d = el.depth;
  const c = el.court!;
  const surfaceTex = c.surface === 'sand' ? groundTexture('sand') : turfTexture();
  const surfaceGeo = useGeometry(() => scaledPlane(w + 1, d + 1, c.surface === 'sand' ? 5 : 1, c.surface === 'sand' ? 5 : 1), [w, d, c.surface]);
  const surface = useMat({ color: c.surface === 'sand' ? '#fff1d0' : '#ffffff', map: surfaceTex, roughness: 1 });
  const netGeo = useGeometry(() => scaledPlane(d + 1.6, 1, 0.1, 0.1), [d]);
  const netMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: netTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, color: '#111111' }),
    [],
  );
  const netTop = c.netHeight;
  const lw = 0.05;
  const lines: [number, number, number, number][] = [
    // x, z, sx, sz
    [0, -d / 2 + lw / 2, w, lw],
    [0, d / 2 - lw / 2, w, lw],
    [-w / 2 + lw / 2, 0, lw, d],
    [w / 2 - lw / 2, 0, lw, d],
    [0, 0, lw, d],
  ];
  if (c.attackLines) {
    const a = Math.min(3, w / 6);
    lines.push([-a, 0, lw, d], [a, 0, lw, d]);
  }
  const m = c.safetyMargin;
  return (
    <group>
      <mesh geometry={surfaceGeo} material={surface} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow />
      {lines.map(([x, z, sx, sz], i) => (
        <mesh key={i} position={[x, 0.025, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[sx, sz]} />
          <meshStandardMaterial color={c.surface === 'sand' ? '#2a5db0' : '#ffffff'} roughness={0.7} />
        </mesh>
      ))}
      {/* أعمدة الشبكة */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Pole x={0} z={s * (d / 2 + 0.8)} h={netTop + 0.15} r={0.05} color="#d8d8d8" />
          <mesh position={[0, 0.03, s * (d / 2 + 0.8)]}>
            <cylinderGeometry args={[0.18, 0.18, 0.06, 12]} />
            <meshStandardMaterial color="#555" />
          </mesh>
          {/* الهوائيات */}
          <mesh position={[0, netTop + 0.4, s * (d / 2)]}>
            <cylinderGeometry args={[0.01, 0.01, 1.8, 6]} />
            <meshStandardMaterial color="#e23b3b" />
          </mesh>
        </group>
      ))}
      <mesh geometry={netGeo} material={netMat} position={[0, netTop - 0.5, 0]} rotation={[0, Math.PI / 2, 0]} castShadow />
      <mesh position={[0, netTop - 0.035, 0]}>
        <boxGeometry args={[0.02, 0.07, d + 1.6]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      <mesh position={[0, netTop - 1, 0]}>
        <boxGeometry args={[0.015, 0.04, d + 1.6]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      {/* منطقة الأمان */}
      {showSafety && m > 0 && (
        <group position={[0, 0.012, 0]}>
          {[
            [0, -(d / 2 + m), w + 2 * m, 0.08],
            [0, d / 2 + m, w + 2 * m, 0.08],
            [-(w / 2 + m), 0, 0.08, d + 2 * m],
            [w / 2 + m, 0, 0.08, d + 2 * m],
          ].map(([x, z, sx, sz], i) => (
            <mesh key={i} position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[sx, sz]} />
              <meshBasicMaterial color="#e07b1a" transparent opacity={0.85} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
});

// ——— المظلة ———
export const Canopy3D = memo(function Canopy3D({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const H = el.height;
  const eave = H * 0.74;
  const roof = useGeometry(() => hipRoofGeometry(w, d, eave, H, 0.15), [w, d, eave, H]);
  const fab = useMat({ color: el.color, map: fabricTexture(), side: THREE.DoubleSide, roughness: 0.95 });
  const sadu = useMat({ color: '#ffffff', map: saduTexture(el.accent), side: THREE.DoubleSide });
  const nx = Math.max(1, Math.round(w / 3.5));
  const nz = Math.max(1, Math.round(d / 3.5));
  const poles: [number, number][] = [];
  for (let i = 0; i <= nx; i++) for (const z of [-d / 2, d / 2]) poles.push([-w / 2 + (w / nx) * i, z]);
  for (let j = 1; j < nz; j++) for (const x of [-w / 2, w / 2]) poles.push([x, -d / 2 + (d / nz) * j]);
  const vh = 0.3;
  return (
    <group>
      <mesh geometry={roof} material={fab} castShadow receiveShadow />
      {poles.map(([x, z], i) => (
        <Pole key={i} x={x} z={z} h={eave} r={0.045} color={WOOD} />
      ))}
      {[
        { p: [0, eave - vh / 2, d / 2 + 0.15], r: 0, l: w + 0.3 },
        { p: [0, eave - vh / 2, -d / 2 - 0.15], r: Math.PI, l: w + 0.3 },
        { p: [w / 2 + 0.15, eave - vh / 2, 0], r: Math.PI / 2, l: d + 0.3 },
        { p: [-w / 2 - 0.15, eave - vh / 2, 0], r: -Math.PI / 2, l: d + 0.3 },
      ].map((v, i) => (
        <Strip key={i} pos={v.p as [number, number, number]} rot={v.r} len={v.l} h={vh} mat={sadu} />
      ))}
    </group>
  );
});

function Strip({ pos, rot, len, h, mat }: { pos: [number, number, number]; rot: number; len: number; h: number; mat: THREE.Material }) {
  const g = useGeometry(() => scaledPlane(len, h, 1.2, h), [len, h]);
  return <mesh geometry={g} material={mat} position={pos} rotation={[0, rot, 0]} />;
}

// ——— الجلسة الشعبية ———
export const Rug3D = memo(function Rug3D({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const g = useGeometry(() => scaledPlane(w, d, 2, 2), [w, d]);
  const rug = useMat({ color: '#ffffff', map: carpetTexture(el.color, el.accent), roughness: 1 });
  const c = Math.min(0.7, Math.min(w, d) * 0.18);
  const cushion = el.accent;
  const backC = shade(el.accent, -0.25);
  return (
    <group>
      <mesh geometry={g} material={rug} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow />
      {/* مراكي على ثلاث جهات */}
      <mesh position={[0, 0.15, -d / 2 + c / 2 + 0.05]} castShadow>
        <boxGeometry args={[w - 0.1, 0.25, c]} />
        <meshStandardMaterial color={cushion} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.42, -d / 2 + 0.12]} castShadow>
        <boxGeometry args={[w - 0.1, 0.4, 0.16]} />
        <meshStandardMaterial color={backC} roughness={0.95} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (w / 2 - c / 2 - 0.05), 0.15, c / 2 - 0.25]} castShadow>
            <boxGeometry args={[c, 0.25, Math.max(0.3, d - c - 0.6)]} />
            <meshStandardMaterial color={cushion} roughness={0.95} />
          </mesh>
          <mesh position={[s * (w / 2 - 0.12), 0.42, c / 2 - 0.25]} castShadow>
            <boxGeometry args={[0.16, 0.4, Math.max(0.3, d - c - 0.6)]} />
            <meshStandardMaterial color={backC} roughness={0.95} />
          </mesh>
        </group>
      ))}
      {/* المساند */}
      {Array.from({ length: Math.max(2, Math.floor(w / 1.2)) }).map((_, i, arr) => (
        <mesh key={i} position={[-w / 2 + (w / arr.length) * (i + 0.5), 0.36, -d / 2 + c + 0.05]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.45, 10]} />
          <meshStandardMaterial color="#c9a24a" roughness={0.8} />
        </mesh>
      ))}
      {/* صينية القهوة والدلة */}
      <group position={[0, 0.03, d * 0.1]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.03, 20]} />
          <meshStandardMaterial color="#c9a24a" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.05, 0.09, 0.22, 12]} />
          <meshStandardMaterial color="#d4b15a" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <coneGeometry args={[0.06, 0.1, 12]} />
          <meshStandardMaterial color="#d4b15a" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
});

// ——— الحمام ———
export const Toilet3D = memo(function Toilet3D({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const h = el.height;
  return (
    <group>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[w + 0.1, 0.12, d + 0.1]} />
        <meshStandardMaterial color="#6f6f6f" />
      </mesh>
      <mesh position={[0, 0.12 + (h - 0.3) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h - 0.3, d]} />
        <meshStandardMaterial color={el.color} roughness={0.6} />
      </mesh>
      <mesh position={[0, h - 0.09, 0]} castShadow>
        <boxGeometry args={[w + 0.12, 0.18, d + 0.12]} />
        <meshStandardMaterial color={shade(el.color, -0.08)} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.12 + (h - 0.5) / 2, d / 2 + 0.01]}>
        <boxGeometry args={[w * 0.66, h - 0.5, 0.03]} />
        <meshStandardMaterial color={el.accent} roughness={0.5} />
      </mesh>
      <mesh position={[w * 0.22, 1.05, d / 2 + 0.03]}>
        <boxGeometry args={[0.05, 0.14, 0.04]} />
        <meshStandardMaterial color="#cccccc" metalness={0.6} />
      </mesh>
      <mesh position={[0, h - 0.42, d / 2 + 0.03]}>
        <planeGeometry args={[Math.min(0.5, w * 0.4), 0.22]} />
        <meshBasicMaterial map={labelTexture('WC', el.accent)} toneMapped={false} />
      </mesh>
      <mesh position={[0, h - 0.32, -d / 2 - 0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w * 0.5, 0.12]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
});

// ——— المغسلة ———
export const Sink3D = memo(function Sink3D({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const h = el.height;
  const n = w >= 1 ? 2 : 1;
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.84, d]} />
        <meshStandardMaterial color={el.color} roughness={0.6} />
      </mesh>
      {Array.from({ length: n }).map((_, i) => {
        const x = -w / 2 + (w / n) * (i + 0.5);
        return (
          <group key={i} position={[x, 0.86, 0.04]}>
            <mesh>
              <cylinderGeometry args={[Math.min(0.2, w / n / 2.6), 0.1, 0.12, 16]} />
              <meshStandardMaterial color="#ffffff" roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.16, -d / 2 + 0.12]}>
              <cylinderGeometry args={[0.015, 0.015, 0.28, 6]} />
              <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, (h + 0.84) / 2, -d / 2 + 0.03]} castShadow>
        <boxGeometry args={[w, h - 0.84, 0.05]} />
        <meshStandardMaterial color={el.accent} roughness={0.7} />
      </mesh>
      <mesh position={[0, h - 0.45, -d / 2 + 0.06]}>
        <planeGeometry args={[w * 0.8, 0.5]} />
        <meshStandardMaterial color="#cfe3ef" metalness={0.9} roughness={0.08} />
      </mesh>
    </group>
  );
});

// ——— المطبخ الخارجي ———
export const Kitchen3D = memo(function Kitchen3D({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const h = el.height;
  const fab = useMat({ color: '#efe4cc', map: fabricTexture(), side: THREE.DoubleSide });
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.9, d]} />
        <meshStandardMaterial color={el.color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.92, 0]}>
        <boxGeometry args={[w + 0.04, 0.04, d + 0.04]} />
        <meshStandardMaterial color={el.accent} roughness={0.4} />
      </mesh>
      {[0.4, 0.85].map((x) =>
        [-0.18, 0.2].map((z) => (
          <mesh key={`${x}${z}`} position={[-w / 2 + x, 0.96, z]}>
            <cylinderGeometry args={[0.14, 0.14, 0.04, 16]} />
            <meshStandardMaterial color="#1c1c1c" metalness={0.5} />
          </mesh>
        )),
      )}
      <mesh position={[w / 2 - 0.7, 0.93, 0]}>
        <boxGeometry args={[0.6, 0.03, d * 0.5]} />
        <meshStandardMaterial color="#b8c7cf" metalness={0.8} roughness={0.2} />
      </mesh>
      {h > 1.6 && (
        <>
          {[-1, 1].map((s) => (
            <Pole key={s} x={s * (w / 2)} z={-d / 2} h={h} r={0.04} color={METAL} />
          ))}
          {[-1, 1].map((s) => (
            <Pole key={`f${s}`} x={s * (w / 2)} z={d / 2 + 0.2} h={h - 0.2} r={0.04} color={METAL} />
          ))}
          <mesh position={[0, h - 0.1, 0.1]} rotation={[-0.08, 0, 0]} material={fab} castShadow>
            <boxGeometry args={[w + 0.3, 0.03, d + 0.7]} />
          </mesh>
        </>
      )}
    </group>
  );
});

// ——— المخزن ———
export const Storage3D = memo(function Storage3D({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const h = el.height;
  const g = useGeometry(() => new THREE.BoxGeometry(w, h, d), [w, h, d]);
  const tex = corrugatedTexture();
  const mat = useMat({ color: el.color, map: tex, roughness: 0.6, metalness: 0.3 });
  return (
    <group>
      <mesh geometry={g} material={mat} position={[0, h / 2, 0]} castShadow receiveShadow />
      <mesh position={[0, h / 2 - 0.05, d / 2 + 0.01]}>
        <boxGeometry args={[w * 0.6, h - 0.3, 0.02]} />
        <meshStandardMaterial color={shade(el.color, -0.15)} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, h / 2, d / 2 + 0.03]}>
        <boxGeometry args={[0.03, h - 0.4, 0.03]} />
        <meshStandardMaterial color={el.accent} />
      </mesh>
    </group>
  );
});

// ——— المواقف ———
const CAR_COLORS = ['#f5f5f2', '#2a2a2a', '#9aa3ab', '#7a2121', '#d9cfbf', '#1f3a5f'];

function Car({ x, color, len }: { x: number; color: string; len: number }) {
  const cw = 1.9;
  return (
    <group position={[x, 0, -0.1]}>
      <mesh position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[cw, 0.7, len]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.25, -0.2]} castShadow>
        <boxGeometry args={[cw - 0.15, 0.55, len * 0.55]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.25, -0.2]}>
        <boxGeometry args={[cw - 0.1, 0.42, len * 0.5]} />
        <meshStandardMaterial color="#1d2633" metalness={0.8} roughness={0.15} />
      </mesh>
      {[
        [-cw / 2, len * 0.32],
        [cw / 2, len * 0.32],
        [-cw / 2, -len * 0.32],
        [cw / 2, -len * 0.32],
      ].map(([wx, wz], i) => (
        <mesh key={i} position={[wx, 0.36, wz]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.26, 16]} />
          <meshStandardMaterial color="#151515" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export const Parking3D = memo(function Parking3D({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const slots = Math.max(1, el.parking?.slots ?? 1);
  const sw = w / slots;
  const g = useGeometry(() => scaledPlane(w, d, 4, 4), [w, d]);
  const ground = useMat({ color: el.color, map: groundTexture('flat'), roughness: 1 });
  return (
    <group>
      <mesh geometry={g} material={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow />
      {Array.from({ length: slots + 1 }).map((_, i) => (
        <mesh key={i} position={[-w / 2 + sw * i, 0.02, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.1, d - 0.4]} />
          <meshStandardMaterial color={el.accent} />
        </mesh>
      ))}
      {el.parking?.showCars &&
        sw > 1.6 &&
        d > 3 &&
        Array.from({ length: slots }).map((_, i) => (
          <Car key={i} x={-w / 2 + sw * (i + 0.5)} color={CAR_COLORS[i % CAR_COLORS.length]} len={Math.min(4.6, d - 0.7)} />
        ))}
    </group>
  );
});

// ——— خزان الماء ———
export const WaterTank3D = memo(function WaterTank3D({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const h = el.height;
  const r = Math.min(w, d) / 2 * 0.92;
  const standH = Math.max(0.3, h * 0.4);
  const tankH = h - standH;
  return (
    <group>
      {[
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * r * 0.7, standH / 2, sz * r * 0.7]} castShadow>
          <boxGeometry args={[0.08, standH, 0.08]} />
          <meshStandardMaterial color={el.accent} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, standH, 0]}>
        <boxGeometry args={[r * 1.8, 0.06, r * 1.8]} />
        <meshStandardMaterial color={el.accent} metalness={0.4} />
      </mesh>
      <mesh position={[0, standH + tankH / 2 + 0.03, 0]} castShadow>
        <cylinderGeometry args={[r, r, tankH, 24]} />
        <meshStandardMaterial color={el.color} roughness={0.5} />
      </mesh>
      <mesh position={[0, standH + tankH + 0.06, 0]}>
        <cylinderGeometry args={[r * 0.3, r * 0.3, 0.08, 16]} />
        <meshStandardMaterial color={el.accent} />
      </mesh>
      {[0.25, 0.5, 0.75].map((f) => (
        <mesh key={f} position={[0, standH + tankH * f, 0]}>
          <torusGeometry args={[r + 0.005, 0.015, 6, 32]} />
          <meshStandardMaterial color={shade(el.color, -0.1)} />
        </mesh>
      ))}
    </group>
  );
});

// ——— المولد ———
export const Generator3D = memo(function Generator3D({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const h = el.height;
  return (
    <group>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[w + 0.1, 0.12, d + 0.1]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      <mesh position={[0, 0.12 + (h - 0.12) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h - 0.12, d]} />
        <meshStandardMaterial color={el.color} roughness={0.5} metalness={0.2} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-w * 0.2, h * 0.55, s * (d / 2 + 0.005)]}>
          <planeGeometry args={[w * 0.4, h * 0.5]} />
          <meshStandardMaterial color={el.accent} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[w / 2 - 0.2, h + 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
        <meshStandardMaterial color="#444" metalness={0.6} />
      </mesh>
    </group>
  );
});

// ——— الشواء ———
export const BBQ3D = memo(function BBQ3D({ el, night }: P) {
  const w = el.width;
  const d = el.depth;
  const gw = Math.min(1.4, w * 0.45);
  const gd = Math.min(0.6, d * 0.4);
  const tw = Math.min(1.2, w * 0.4);
  const g = useGeometry(() => scaledPlane(w, d, 1.2, 1.2), [w, d]);
  return (
    <group>
      <mesh geometry={g} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <meshStandardMaterial color="#cdbb9a" roughness={1} />
      </mesh>
      <group position={[-w / 2 + 0.2 + gw / 2, 0, 0]}>
        {[
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([sx, sz], i) => (
          <mesh key={i} position={[(sx * gw) / 2.3, 0.35, (sz * gd) / 2.3]}>
            <boxGeometry args={[0.04, 0.7, 0.04]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        ))}
        <mesh position={[0, 0.78, 0]} castShadow>
          <boxGeometry args={[gw, 0.2, gd]} />
          <meshStandardMaterial color={el.color} metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.885, 0]}>
          <boxGeometry args={[gw - 0.1, 0.02, gd - 0.1]} />
          <meshStandardMaterial color="#ff6a1a" emissive="#ff4d00" emissiveIntensity={night ? 1.6 : 0.5} />
        </mesh>
        {Array.from({ length: Math.floor(gw / 0.08) }).map((_, i) => (
          <mesh key={i} position={[-gw / 2 + 0.06 + i * 0.08, 0.9, 0]}>
            <boxGeometry args={[0.012, 0.012, gd - 0.06]} />
            <meshStandardMaterial color="#888" metalness={0.8} />
          </mesh>
        ))}
      </group>
      <mesh position={[w / 2 - 0.2 - tw / 2, 0.45, 0]} castShadow>
        <boxGeometry args={[tw, 0.9, d * 0.6]} />
        <meshStandardMaterial color={el.accent} roughness={0.8} />
      </mesh>
    </group>
  );
});

// ——— طاولة وكراسي ———
export const TableSet3D = memo(function TableSet3D({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const seats = Math.max(0, el.furniture?.seats ?? 6);
  const rx = w / 2 - 0.25;
  const rz = d / 2 - 0.25;
  return (
    <group>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[Math.min(w, d) * 0.3, Math.min(w, d) * 0.3, 0.05, 28]} />
        <meshStandardMaterial color={el.color} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.05, 0.2, 0.72, 10]} />
        <meshStandardMaterial color={shade(el.color, -0.3)} />
      </mesh>
      {Array.from({ length: seats }).map((_, i) => {
        const a = (i / seats) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * rx, 0, Math.sin(a) * rz]} rotation={[0, -a - Math.PI / 2, 0]}>
            <mesh position={[0, 0.45, 0]} castShadow>
              <boxGeometry args={[0.44, 0.06, 0.44]} />
              <meshStandardMaterial color={el.accent} />
            </mesh>
            <mesh position={[0, 0.72, 0.2]} castShadow>
              <boxGeometry args={[0.44, 0.5, 0.05]} />
              <meshStandardMaterial color={el.accent} />
            </mesh>
            {[
              [-0.18, -0.18],
              [0.18, -0.18],
              [-0.18, 0.18],
              [0.18, 0.18],
            ].map(([x, z], k) => (
              <mesh key={k} position={[x, 0.22, z]}>
                <boxGeometry args={[0.035, 0.44, 0.035]} />
                <meshStandardMaterial color="#3b2a1e" />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
});

// ——— كنب خارجي ———
export const Seating3D = memo(function Seating3D({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const s = Math.min(0.85, Math.min(w, d) * 0.3);
  const seg = (x: number, z: number, sx: number, sz: number, key: string) => (
    <group key={key}>
      <mesh position={[x, 0.2, z]} castShadow receiveShadow>
        <boxGeometry args={[sx, 0.4, sz]} />
        <meshStandardMaterial color={el.color} roughness={0.95} />
      </mesh>
    </group>
  );
  return (
    <group>
      {seg(0, -d / 2 + s / 2, w, s, 'b')}
      {seg(-w / 2 + s / 2, s / 2, s, d - s, 'l')}
      {seg(w / 2 - s / 2, s / 2, s, d - s, 'r')}
      <mesh position={[0, 0.6, -d / 2 + 0.1]} castShadow>
        <boxGeometry args={[w, 0.45, 0.2]} />
        <meshStandardMaterial color={el.accent} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.22, s / 2 + (d - s) * 0.05]} castShadow>
        <boxGeometry args={[w * 0.36, 0.06, (d - s) * 0.4]} />
        <meshStandardMaterial color="#8a6440" />
      </mesh>
      <mesh position={[0, 0.1, s / 2 + (d - s) * 0.05]}>
        <boxGeometry args={[w * 0.3, 0.2, (d - s) * 0.32]} />
        <meshStandardMaterial color="#6b4a2b" />
      </mesh>
    </group>
  );
});
