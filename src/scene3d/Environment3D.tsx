import { memo, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { Land, TimeOfDay } from '../types/plan';
import { DEG, entranceInfo, landBounds, landEdges, landPolygon, lerp, rotate } from '../lib/geometry';
import { groundTexture, fabricTexture } from './textures';
import { useMat, scaledPlane, useGeometry } from './common';
import { shade } from '../lib/color';
import type { WorldInfo } from './world';

/** اتجاه الشمس: عصر شتوي في قطر (سمت ~220°، ارتفاع ~32°) مع مراعاة اتجاه الشمال */
export function sunDirection(northAngle: number, time: TimeOfDay): THREE.Vector3 {
  const az = time === 'sunset' ? 245 : 215;
  const el = time === 'sunset' ? 4 : time === 'night' ? 25 : 34;
  const h = rotate({ x: 0, y: -1 }, northAngle + az);
  const ce = Math.cos(el * DEG);
  return new THREE.Vector3(h.x * ce, Math.sin(el * DEG), h.y * ce).normalize();
}

export function SceneLighting({ time, land, size }: { time: TimeOfDay; land: Land; size: number }) {
  const { scene, gl } = useThree();
  const sun = useMemo(() => sunDirection(land.northAngle, time), [land.northAngle, time]);
  const moon = useMemo(() => sunDirection(land.northAngle + 160, 'night'), [land.northAngle]);
  const shadowExtent = size / 2 + 12;

  useEffect(() => {
    const cfg = {
      day: { fog: '#e8dcc4', near: 140, far: 1100, exposure: 1.0, bg: null as string | null },
      sunset: { fog: '#d49a72', near: 90, far: 800, exposure: 1.05, bg: null },
      night: { fog: '#070b16', near: 50, far: 520, exposure: 1.15, bg: '#04060d' },
    }[time];
    scene.fog = new THREE.Fog(cfg.fog, cfg.near, cfg.far);
    scene.background = cfg.bg ? new THREE.Color(cfg.bg) : null;
    gl.toneMappingExposure = cfg.exposure;
  }, [time, scene, gl]);

  const dist = 260;
  if (time === 'night') {
    return (
      <>
        <NightSky />
        <Stars radius={600} depth={80} count={4500} factor={5} saturation={0} fade speed={0} />
        <mesh position={moon.clone().multiplyScalar(700).toArray()}>
          <sphereGeometry args={[14, 24, 16]} />
          <meshBasicMaterial color="#f2efe2" toneMapped={false} fog={false} />
        </mesh>
        <hemisphereLight args={['#33415e', '#1a140f', 0.32]} />
        <directionalLight
          position={moon.clone().multiplyScalar(dist).toArray()}
          intensity={0.22}
          color="#9fb2e8"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-shadowExtent}
          shadow-camera-right={shadowExtent}
          shadow-camera-top={shadowExtent}
          shadow-camera-bottom={-shadowExtent}
          shadow-camera-far={dist * 2}
          shadow-bias={-0.0006}
        />
      </>
    );
  }
  const sunset = time === 'sunset';
  return (
    <>
      <Sky
        distance={4500}
        sunPosition={sun.clone().multiplyScalar(100).toArray()}
        turbidity={sunset ? 9 : 5}
        rayleigh={sunset ? 2.6 : 1.1}
        mieCoefficient={sunset ? 0.012 : 0.005}
        mieDirectionalG={0.85}
      />
      <hemisphereLight args={[sunset ? '#ffcf9e' : '#cfe4ff', sunset ? '#6b4a3a' : '#d8b585', sunset ? 0.55 : 1.05]} />
      <directionalLight
        position={sun.clone().multiplyScalar(dist).toArray()}
        intensity={sunset ? 1.4 : 2.7}
        color={sunset ? '#ffa45c' : '#fff3df'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-far={dist * 2}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
    </>
  );
}

function NightSky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color('#02040c') },
          mid: { value: new THREE.Color('#0b1430') },
          bottom: { value: new THREE.Color('#1c1a24') },
        },
        vertexShader: `varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vPos;
          void main(){ float h = vPos.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.5, h)) : mix(mid, bottom, smoothstep(0.0, -0.2, h));
          gl_FragColor = vec4(c, 1.0); }`,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[1500, 32, 16]} />
    </mesh>
  );
}

/** الأرض: أرضية العنة + الصحراء المحيطة + كثبان بعيدة */
export const Ground3D = memo(function Ground3D({ land, w }: { land: Land; w: WorldInfo }) {
  const poly = landPolygon(land);
  const landGeo = useGeometry(() => {
    const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x - w.ox, -(p.y - w.oy))));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / 8;
      uv[i * 2 + 1] = pos.getZ(i) / 8;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  }, [JSON.stringify(poly), w.ox, w.oy]);
  const landMat = useMat({ color: '#ffffff', map: groundTexture(land.ground), roughness: 1 });
  const desertGeo = useGeometry(() => scaledPlane(3000, 3000, 14, 14), []);
  const desertMat = useMat({ color: '#f2e2c2', map: groundTexture('desert'), roughness: 1 });

  const dunes = useMemo(() => {
    const arr: { x: number; z: number; sx: number; sy: number; sz: number; r: number }[] = [];
    let s = 3;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const d = 180 + rnd() * 380;
      arr.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, sx: 40 + rnd() * 90, sy: 6 + rnd() * 16, sz: 25 + rnd() * 50, r: rnd() * Math.PI });
    }
    return arr;
  }, []);

  return (
    <group>
      <mesh geometry={desertGeo} material={desertMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow />
      <mesh geometry={landGeo} material={landMat} position={[0, 0.003, 0]} receiveShadow />
      {dunes.map((d, i) => (
        <mesh key={i} position={[d.x, -d.sy * 0.35, d.z]} rotation={[0, d.r, 0]} scale={[d.sx, d.sy, d.sz]} receiveShadow>
          <sphereGeometry args={[1, 18, 10]} />
          <meshStandardMaterial color="#e2c38e" roughness={1} />
        </mesh>
      ))}
    </group>
  );
});

/** السياج مع فتحة المدخل وبوابة */
export const Fence3D = memo(function Fence3D({ land, w }: { land: Land; w: WorldInfo }) {
  const edges = landEdges(land);
  const ent = entranceInfo(land);
  const f = land.fence;
  const fab = useMat({
    color: f.color,
    map: f.type === 'fabric' ? fabricTexture() : null,
    roughness: 0.95,
    side: THREE.DoubleSide,
    transparent: f.type === 'mesh',
    opacity: f.type === 'mesh' ? 0.45 : 1,
  });
  const segs = useMemo(() => {
    const out: { a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
    edges.forEach((e, i) => {
      if (i === ent.edge) {
        out.push({ a: e.a, b: ent.a }, { a: ent.b, b: e.b });
      } else out.push({ a: e.a, b: e.b });
    });
    return out.filter((s) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) > 0.05);
  }, [edges, ent]);
  const posts = useMemo(() => {
    const p: { x: number; y: number }[] = [];
    for (const s of segs) {
      const L = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
      const n = Math.max(1, Math.round(L / 2.5));
      for (let i = 0; i <= n; i++) p.push(lerp(s.a, s.b, i / n));
    }
    return p;
  }, [segs]);
  const b = landBounds(land);
  void b;
  if (!f.enabled) {
    return <Gate land={land} w={w} />;
  }
  const h = f.height;
  return (
    <group>
      {segs.map((s, i) => {
        const L = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
        const ang = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x);
        const mx = (s.a.x + s.b.x) / 2 - w.ox;
        const mz = (s.a.y + s.b.y) / 2 - w.oy;
        if (f.type === 'block') {
          return (
            <mesh key={i} position={[mx, h / 2, mz]} rotation={[0, -ang, 0]} castShadow receiveShadow>
              <boxGeometry args={[L, h, 0.2]} />
              <meshStandardMaterial color={f.color} roughness={0.95} />
            </mesh>
          );
        }
        return (
          <group key={i} position={[mx, 0, mz]} rotation={[0, -ang, 0]}>
            <mesh position={[0, h / 2 + 0.05, 0]} material={fab} castShadow receiveShadow>
              <planeGeometry args={[L, h - 0.1]} />
            </mesh>
            {f.type === 'fabric' && (
              <mesh position={[0, h - 0.18, 0.006]}>
                <planeGeometry args={[L, 0.16]} />
                <meshStandardMaterial color={shade(f.color, -0.45)} side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        );
      })}
      {f.type !== 'block' &&
        posts.map((p, i) => (
          <mesh key={i} position={[p.x - w.ox, h / 2 + 0.05, p.y - w.oy]} castShadow>
            <boxGeometry args={[0.07, h + 0.1, 0.07]} />
            <meshStandardMaterial color="#5c4033" roughness={0.8} />
          </mesh>
        ))}
      <Gate land={land} w={w} />
    </group>
  );
});

function Gate({ land, w }: { land: Land; w: WorldInfo }) {
  const ent = entranceInfo(land);
  const h = Math.max(2.6, land.fence.height + 0.8);
  const ang = Math.atan2(ent.dir.y, ent.dir.x);
  const cx = ent.center.x - w.ox;
  const cz = ent.center.y - w.oy;
  return (
    <group position={[cx, 0, cz]} rotation={[0, -ang, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * ent.width) / 2, h / 2, 0]} castShadow>
          <boxGeometry args={[0.35, h, 0.35]} />
          <meshStandardMaterial color="#7a4a24" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, h + 0.15, 0]} castShadow>
        <boxGeometry args={[ent.width + 0.6, 0.3, 0.3]} />
        <meshStandardMaterial color="#7a4a24" roughness={0.8} />
      </mesh>
      <mesh position={[0, h + 0.15, 0.16]}>
        <planeGeometry args={[Math.min(ent.width, 3.2), 0.22]} />
        <meshStandardMaterial color="#d4a24c" metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}
