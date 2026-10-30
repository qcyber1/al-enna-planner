// نماذج ثلاثية الأبعاد للعناصر القطرية الإضافية
import { memo } from 'react';
import * as THREE from 'three';
import type { PlanElement } from '../types/plan';
import { Pole, scaledPlane, useGeometry, useMat, WOOD } from './common';
import { carpetTexture, corrugatedTexture, fabricTexture, labelTexture } from './textures';
import { shade } from '../lib/color';

interface P {
  el: PlanElement;
  night: boolean;
  lampsOn: boolean;
}

function Cabin({ el, night, lampsOn, kitchen }: P & { kitchen: boolean }) {
  const w = el.width;
  const d = el.depth;
  const h = el.height;
  const body = useMat({ color: el.color, map: corrugatedTexture(), roughness: 0.6, metalness: 0.15 });
  const lit = night && lampsOn;
  return (
    <group>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[w - 0.2, 0.3, d - 0.2]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh position={[0, 0.3 + (h - 0.45) / 2, 0]} material={body} castShadow receiveShadow>
        <boxGeometry args={[w, h - 0.45, d]} />
      </mesh>
      <mesh position={[0, h - 0.07, 0]} castShadow>
        <boxGeometry args={[w + 0.15, 0.14, d + 0.15]} />
        <meshStandardMaterial color={shade(el.color, -0.12)} />
      </mesh>
      {/* الباب */}
      <mesh position={[-w / 2 + 0.4 + Math.min(0.9, w * 0.25) / 2, 0.3 + 1.0, d / 2 + 0.01]}>
        <boxGeometry args={[Math.min(0.9, w * 0.25), 2.0, 0.04]} />
        <meshStandardMaterial color={el.accent} />
      </mesh>
      <mesh position={[-w / 2 + 0.4 + Math.min(0.9, w * 0.25) / 2, 2.55, d / 2 + 0.06]}>
        <boxGeometry args={[0.2, 0.12, 0.1]} />
        <meshStandardMaterial color={lit ? '#fff1c9' : '#ccc'} emissive={lit ? '#ffb347' : '#000'} emissiveIntensity={lit ? 2.5 : 0} toneMapped={!lit} />
      </mesh>
      {/* الشباك */}
      <mesh position={[w * 0.15, 1.5, d / 2 + 0.01]}>
        <planeGeometry args={[Math.min(1.2, w * 0.3), 0.8]} />
        <meshStandardMaterial color={lit ? '#ffd79a' : '#9fc3d8'} emissive={lit ? '#ffb35c' : '#000'} emissiveIntensity={lit ? 0.9 : 0} metalness={lit ? 0 : 0.5} roughness={0.2} />
      </mesh>
      {/* المكيف أو الشفاط */}
      {kitchen ? (
        <mesh position={[w / 2 - 0.6, h + 0.25, -d / 4]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.5, 10]} />
          <meshStandardMaterial color="#777" metalness={0.6} />
        </mesh>
      ) : (
        <mesh position={[w / 2 - 0.6, 1.9, d / 2 + 0.2]} castShadow>
          <boxGeometry args={[0.7, 0.5, 0.35]} />
          <meshStandardMaterial color="#e6e6e6" />
        </mesh>
      )}
      <mesh position={[0, h - 0.35, d / 2 + 0.01]}>
        <planeGeometry args={[Math.min(1.1, w * 0.3), 0.3]} />
        <meshBasicMaterial map={labelTexture(kitchen ? 'مطبخ' : 'رقدة', el.accent)} toneMapped={false} />
      </mesh>
    </group>
  );
}

const FirePit = memo(function FirePit({ el, night }: P) {
  const w = el.width;
  const d = el.depth;
  const r = Math.min(w, d) / 2;
  const fr = Math.min(0.55, r * 0.28);
  const ring = useGeometry(() => {
    const g = new THREE.RingGeometry(r - Math.min(0.7, r * 0.35), r, 48);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [r]);
  const rug = useMat({ color: '#ffffff', map: carpetTexture(el.color, '#1f3d2b'), roughness: 1 });
  const stones = Math.max(8, Math.round(fr * 30));
  return (
    <group scale={[w / (2 * r), 1, d / (2 * r)]}>
      <mesh geometry={ring} material={rug} position={[0, 0.02, 0]} receiveShadow />
      {/* مراكي حول الضو */}
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        const rr = r - Math.min(0.7, r * 0.35) / 2;
        return (
          <mesh key={i} position={[Math.cos(a) * (rr + 0.15), 0.35, Math.sin(a) * (rr + 0.15)]} rotation={[0, -a, 0]} castShadow>
            <boxGeometry args={[0.18, 0.4, 0.9]} />
            <meshStandardMaterial color={shade(el.color, -0.25)} />
          </mesh>
        );
      })}
      {Array.from({ length: stones }).map((_, i) => {
        const a = (i / stones) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * fr, 0.1, Math.sin(a) * fr]} castShadow>
            <dodecahedronGeometry args={[0.11, 0]} />
            <meshStandardMaterial color={el.accent} roughness={1} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[fr * 0.85, fr * 0.85, 0.06, 20]} />
        <meshStandardMaterial color="#ff6a1a" emissive="#ff4d00" emissiveIntensity={night ? 2.2 : 0.6} toneMapped={false} />
      </mesh>
      {/* اللهب */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.cos(i * 2.1) * 0.12, 0.3 + i * 0.05, Math.sin(i * 2.1) * 0.12]}>
          <coneGeometry args={[0.13, 0.5 - i * 0.08, 8]} />
          <meshBasicMaterial color={i === 0 ? '#ffb347' : '#ff7a1a'} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      ))}
      {/* الدلال */}
      {[0, 1].map((i) => (
        <group key={i} position={[fr + 0.25, 0.03, (i - 0.5) * 0.35]}>
          <mesh position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.04, 0.08, 0.2, 10]} />
            <meshStandardMaterial color="#d4b15a" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.27, 0]}>
            <coneGeometry args={[0.05, 0.09, 10]} />
            <meshStandardMaterial color="#d4b15a" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

function Prayer({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const g = useGeometry(() => scaledPlane(w, d, 0.8, 1.2), [w, d]);
  const mat = useMat({ color: '#ffffff', map: carpetTexture(el.color, shade(el.color, -0.3)), roughness: 1 });
  return (
    <group>
      <mesh geometry={g} material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow />
      <mesh position={[0, 0.6, -d / 2 - 0.05]} castShadow>
        <boxGeometry args={[1.2, 1.2, 0.08]} />
        <meshStandardMaterial color={el.accent} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.3, -d / 2 - 0.05]}>
        <sphereGeometry args={[0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={el.accent} metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Screen({ el, night, lampsOn }: P) {
  const w = el.width;
  const h = el.height;
  const on = night && lampsOn;
  const sh = Math.min(w * 0.58, h * 0.6);
  return (
    <group>
      {[-1, 1].map((s) => (
        <Pole key={s} x={s * w * 0.35} z={0} h={h - sh / 2} r={0.05} color={el.accent} />
      ))}
      <mesh position={[0, h - sh / 2, 0]} castShadow>
        <boxGeometry args={[w, sh, 0.12]} />
        <meshStandardMaterial color={el.color} />
      </mesh>
      <mesh position={[0, h - sh / 2, 0.065]}>
        <planeGeometry args={[w - 0.12, sh - 0.12]} />
        <meshStandardMaterial
          color={on ? '#2f7a3a' : '#0d0f12'}
          emissive={on ? '#3fae4f' : '#000'}
          emissiveIntensity={on ? 1.2 : 0}
          roughness={0.15}
          metalness={0.4}
        />
      </mesh>
      {on && (
        <mesh position={[0, h - sh / 2, 0.07]}>
          <planeGeometry args={[(w - 0.12) * 0.02, sh - 0.2]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function Kids({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const ground = useGeometry(() => scaledPlane(w, d, 1, 1), [w, d]);
  return (
    <group>
      <mesh geometry={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} receiveShadow>
        <meshStandardMaterial color="#5aa36a" roughness={0.9} />
      </mesh>
      {/* برج وزحليقة */}
      <group position={[-w / 2 + 1.1, 0, -d / 2 + 1.1]}>
        {[
          [-0.6, -0.6],
          [0.6, -0.6],
          [0.6, 0.6],
          [-0.6, 0.6],
        ].map(([x, z], i) => (
          <Pole key={i} x={x} z={z} h={2.2} r={0.05} color={el.color} />
        ))}
        <mesh position={[0, 1.2, 0]} castShadow>
          <boxGeometry args={[1.4, 0.1, 1.4]} />
          <meshStandardMaterial color={el.color} />
        </mesh>
        <mesh position={[0, 2.35, 0]} castShadow>
          <coneGeometry args={[1.05, 0.6, 4]} />
          <meshStandardMaterial color={el.accent} />
        </mesh>
        <mesh position={[1.75, 0.65, 0.25]} rotation={[0, 0, -0.5]} castShadow>
          <boxGeometry args={[2.4, 0.06, 0.6]} />
          <meshStandardMaterial color={el.accent} />
        </mesh>
      </group>
      {/* مرجيحة */}
      <group position={[w / 2 - 1.5, 0, d / 2 - 1.2]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.1, 1.0, 0]} rotation={[0, 0, s * 0.15]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 2.1, 8]} />
            <meshStandardMaterial color="#555" />
          </mesh>
        ))}
        <mesh position={[0, 2.0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 2.4, 8]} />
          <meshStandardMaterial color="#555" />
        </mesh>
        {[-0.45, 0.45].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 1.25, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 1.5, 4]} />
              <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[0.45, 0.05, 0.2]} />
              <meshStandardMaterial color="#e05a47" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Partition({ el }: P) {
  const w = el.width;
  const h = el.height;
  const fab = useMat({ color: el.color, map: fabricTexture(), side: THREE.DoubleSide, roughness: 0.95 });
  const n = Math.max(1, Math.round(w / 2));
  return (
    <group>
      <mesh position={[0, h / 2 + 0.05, 0]} material={fab} castShadow receiveShadow>
        <planeGeometry args={[w, h - 0.1]} />
      </mesh>
      {Array.from({ length: n + 1 }).map((_, i) => (
        <Pole key={i} x={-w / 2 + (w / n) * i} z={0} h={h + 0.05} r={0.04} color={WOOD} />
      ))}
      <mesh position={[0, h - 0.12, 0.005]}>
        <planeGeometry args={[w, 0.18]} />
        <meshStandardMaterial color={el.accent} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function Extra3D(props: P) {
  switch (props.el.kind) {
    case 'sleep-cabin':
      return <Cabin {...props} kitchen={false} />;
    case 'kitchen-cabin':
      return <Cabin {...props} kitchen />;
    case 'fire-pit':
      return <FirePit {...props} />;
    case 'prayer-area':
      return <Prayer {...props} />;
    case 'screen':
      return <Screen {...props} />;
    case 'kids-area':
      return <Kids {...props} />;
    case 'partition':
      return <Partition {...props} />;
    default:
      return null;
  }
}
