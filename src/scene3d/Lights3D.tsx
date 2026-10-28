import { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { PlanElement } from '../types/plan';
import { DEG } from '../lib/geometry';
import { LIGHT_HEX, type Emitter } from '../lib/lighting';
import { glowTexture } from './textures';
import type { WorldInfo } from './world';

function LampMat({ on, color }: { on: boolean; color: string }) {
  return (
    <meshStandardMaterial
      color={on ? '#fff6e0' : '#bdb5a5'}
      emissive={on ? color : '#000000'}
      emissiveIntensity={on ? 3 : 0}
      toneMapped={!on}
      roughness={0.3}
    />
  );
}

/** هيكل وحدة الإنارة (العمود والرأس) — الضوء الفعلي في LightRig */
export const LightFixture3D = memo(function LightFixture3D({ el, lampsOn }: { el: PlanElement; lampsOn: boolean }) {
  const L = el.light!;
  const on = lampsOn && L.on;
  const color = LIGHT_HEX[L.color];
  const h = L.mountHeight;
  switch (el.kind) {
    case 'light-pole':
      return (
        <group>
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.2, 0.5, 10]} />
            <meshStandardMaterial color="#8d8478" roughness={0.9} />
          </mesh>
          <mesh position={[0, h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.075, h, 10]} />
            <meshStandardMaterial color={el.color} metalness={0.5} roughness={0.45} />
          </mesh>
          <mesh position={[0, h + 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.18, 0.14, 16]} />
            <meshStandardMaterial color={el.color} metalness={0.5} roughness={0.45} />
          </mesh>
          <mesh position={[0, h - 0.03, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.03, 16]} />
            <LampMat on={on} color={color} />
          </mesh>
          <mesh position={[0, h + 0.18, 0]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshStandardMaterial color={el.accent} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      );
    case 'flood-light': {
      const tilt = Math.max(0, Math.min(90, L.tilt)) * DEG;
      return (
        <group>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.15, 0.18, 0.4, 8]} />
            <meshStandardMaterial color="#8d8478" />
          </mesh>
          <mesh position={[0, h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, h, 8]} />
            <meshStandardMaterial color={el.color} metalness={0.5} roughness={0.5} />
          </mesh>
          {/* الرأس موجه نحو +Z المحلي ومائل للأسفل */}
          <group position={[0, h, 0]} rotation={[tilt, 0, 0]}>
            <mesh position={[0, 0, 0.08]} castShadow>
              <boxGeometry args={[0.5, 0.36, 0.14]} />
              <meshStandardMaterial color={el.accent} metalness={0.4} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0, 0.152]}>
              <planeGeometry args={[0.42, 0.28]} />
              <LampMat on={on} color={color} />
            </mesh>
          </group>
        </group>
      );
    }
    case 'ground-light':
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, h, 8]} />
            <meshStandardMaterial color={el.color} roughness={0.5} />
          </mesh>
          <mesh position={[0, h + 0.04, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.08, 10]} />
            <LampMat on={on} color={color} />
          </mesh>
        </group>
      );
    case 'entrance-light':
      return (
        <group>
          <mesh position={[0, (h - 0.4) / 2, 0]} castShadow>
            <boxGeometry args={[0.28, h - 0.4, 0.28]} />
            <meshStandardMaterial color={el.color} roughness={0.8} />
          </mesh>
          <mesh position={[0, h - 0.4, 0]}>
            <boxGeometry args={[0.36, 0.06, 0.36]} />
            <meshStandardMaterial color={el.accent} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, h - 0.2, 0]}>
            <boxGeometry args={[0.26, 0.34, 0.26]} />
            <LampMat on={on} color={color} />
          </mesh>
          <mesh position={[0, h + 0.05, 0]}>
            <coneGeometry args={[0.24, 0.2, 4]} />
            <meshStandardMaterial color={el.accent} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      );
    case 'lantern':
      return (
        <group>
          <mesh position={[0, (h - 0.3) / 2, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.03, h - 0.3, 6]} />
            <meshStandardMaterial color={el.color} />
          </mesh>
          <mesh position={[0, h - 0.15, 0]}>
            <boxGeometry args={[0.2, 0.28, 0.2]} />
            <LampMat on={on} color={color} />
          </mesh>
          <mesh position={[0, h + 0.03, 0]}>
            <coneGeometry args={[0.16, 0.14, 4]} />
            <meshStandardMaterial color={el.accent} metalness={0.5} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
});

// معامل تحويل الشدة الضوئية (كانديلا) إلى شدة العرض في المشهد
export const CD_SCALE = 0.016;

function Spot({ em, w }: { em: Emitter; w: WorldInfo }) {
  const target = useMemo(() => new THREE.Object3D(), []);
  const dir = em.dir ?? { x: 0, y: 0, down: 1 };
  const X = em.pos.x - w.ox;
  const Z = em.pos.y - w.oy;
  useEffect(() => {
    target.position.set(X + dir.x * 10, em.height - dir.down * 10, Z + dir.y * 10);
    target.updateMatrixWorld();
  }, [target, X, Z, dir.x, dir.y, dir.down, em.height]);
  const intensity = em.candela * CD_SCALE;
  return (
    <>
      <primitive object={target} />
      <spotLight
        position={[X, em.height - 0.1, Z]}
        target={target}
        color={LIGHT_HEX[em.color]}
        intensity={intensity}
        angle={Math.min(Math.PI / 2.05, em.halfAngle * 1.08)}
        penumbra={0.55}
        decay={2}
        distance={Math.min(90, Math.max(8, Math.sqrt(intensity / 0.004)))}
      />
    </>
  );
}

function Point({ em, w }: { em: Emitter; w: WorldInfo }) {
  const intensity = em.candela * CD_SCALE;
  return (
    <pointLight
      position={[em.pos.x - w.ox, em.height, em.pos.y - w.oy]}
      color={LIGHT_HEX[em.color]}
      intensity={intensity}
      decay={2}
      distance={Math.min(40, Math.max(3, Math.sqrt(intensity / 0.004)))}
    />
  );
}

/** مصادر الضوء الحقيقية + بقع الإضاءة على الأرض + هالات التوهج */
export function LightRig({ emitters, budget, w }: { emitters: Emitter[]; budget: number; w: WorldInfo }) {
  const sorted = useMemo(() => [...emitters].sort((a, b) => b.priority - a.priority || b.lumens - a.lumens), [emitters]);
  const real = sorted.slice(0, budget);
  const realKeys = useMemo(() => new Set(real.map((e) => e.key)), [real]);
  const glow = glowTexture();

  // بقع ضوء أرضية للمصادر خارج الميزانية
  const decals = sorted.filter((e) => !realKeys.has(e.key));

  return (
    <group>
      {real.map((em) => (em.kind === 'spot' ? <Spot key={em.key} em={em} w={w} /> : <Point key={em.key} em={em} w={w} />))}
      {decals.map((em) => {
        let cx = em.pos.x;
        let cy = em.pos.y;
        let r = Math.min(10, Math.max(0.8, Math.sqrt(em.candela * CD_SCALE * 3)));
        if (em.kind === 'spot' && em.dir) {
          const reach = em.dir.down > 0.05 ? em.height / em.dir.down : 20;
          cx += em.dir.x * Math.min(reach, 30);
          cy += em.dir.y * Math.min(reach, 30);
          r = Math.min(25, em.height * Math.tan(em.halfAngle) * 1.2 + 1);
        }
        return (
          <mesh key={`d${em.key}`} position={[cx - w.ox, 0.05, cy - w.oy]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <planeGeometry args={[r * 2, r * 2]} />
            <meshBasicMaterial
              map={glow}
              color={LIGHT_HEX[em.color]}
              transparent
              opacity={0.42}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
      <Halos emitters={sorted} w={w} />
    </group>
  );
}

/** هالات توهج حول مصادر الإضاءة (بديل خفيف عن تأثير Bloom) */
function Halos({ emitters, w }: { emitters: Emitter[]; w: WorldInfo }) {
  const groups = useMemo(() => {
    const byColor: Record<string, number[]> = { warm: [], white: [] };
    for (const e of emitters) {
      if (e.category === 'tent') continue;
      byColor[e.color].push(e.pos.x - w.ox, e.height, e.pos.y - w.oy);
    }
    return byColor;
  }, [emitters, w]);
  const glow = glowTexture();
  return (
    <>
      {(['warm', 'white'] as const).map((c) =>
        groups[c].length ? (
          <points key={c} renderOrder={3}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[new Float32Array(groups[c]), 3]} />
            </bufferGeometry>
            <pointsMaterial
              map={glow}
              color={LIGHT_HEX[c]}
              size={1.6}
              sizeAttenuation
              transparent
              opacity={0.75}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </points>
        ) : null,
      )}
    </>
  );
}
