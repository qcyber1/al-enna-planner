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
import { PRESET_HOUR, sunAzimuth, sunElevation } from '../lib/sunclock';

const SHADOW: [number, number] =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? [1024, 1024] : [2048, 2048];

/** اتجاه من سمت وارتفاع (درجات) مع مراعاة اتجاه الشمال */
function dirFrom(northAngle: number, az: number, el: number): THREE.Vector3 {
  const h = rotate({ x: 0, y: -1 }, northAngle + az);
  const ce = Math.cos(el * DEG);
  return new THREE.Vector3(h.x * ce, Math.sin(el * DEG), h.y * ce).normalize();
}

/** اتجاه الشمس (للتوافق): عصر شتوي في قطر */
export function sunDirection(northAngle: number, time: TimeOfDay): THREE.Vector3 {
  const h = PRESET_HOUR[time];
  return dirFrom(northAngle, sunAzimuth(h), time === 'night' ? 25 : Math.max(2, sunElevation(h)));
}

const C = (a: string) => new THREE.Color(a);
const mix = (a: string, b: string, t: number) => C(a).lerp(C(b), Math.min(1, Math.max(0, t)));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** إعدادات الإضاءة حسب الساعة: نهار ← مغرب ← غسق (قبل الليل) */
export function daylight(hour: number) {
  const el = sunElevation(hour);
  const warm = clamp01((18 - el) / 18); // 0 نهار كامل، 1 الشمس على الأفق
  const dusk = clamp01(-el / 6.5); // بعد المغرب
  const hemiSky = mix('#cfe4ff', '#ffcf9e', warm).lerp(C('#4a5574'), dusk);
  const hemiGround = mix('#d8b585', '#6b4a3a', warm).lerp(C('#1f1812'), dusk);
  const hemiI = THREE.MathUtils.lerp(THREE.MathUtils.lerp(1.05, 0.55, warm), 0.3, dusk);
  const sunI = THREE.MathUtils.lerp(THREE.MathUtils.lerp(2.7, 1.4, warm * warm), 0.08, dusk);
  const sunColor = mix('#fff3df', '#ffa45c', warm);
  const fog = mix('#e8dcc4', '#d49a72', warm).lerp(C('#2b2433'), dusk);
  return {
    el,
    warm,
    dusk,
    hemiSky,
    hemiGround,
    hemiI,
    sunI,
    sunColor,
    fog,
    fogNear: THREE.MathUtils.lerp(140, 90, warm),
    fogFar: THREE.MathUtils.lerp(THREE.MathUtils.lerp(1100, 800, warm), 600, dusk),
    exposure: THREE.MathUtils.lerp(1.0, 1.05, warm) + dusk * 0.1,
    turbidity: THREE.MathUtils.lerp(5, 9, warm),
    rayleigh: THREE.MathUtils.lerp(1.1, 2.6, warm),
    mie: THREE.MathUtils.lerp(0.005, 0.012, warm),
  };
}

export function SceneLighting({ time, hour, land, size }: { time: TimeOfDay; hour: number; land: Land; size: number }) {
  const { scene, gl } = useThree();
  const night = time === 'night';
  const L = useMemo(() => daylight(hour), [hour]);
  const az = sunAzimuth(hour);
  const skySun = useMemo(() => dirFrom(land.northAngle, az, L.el), [land.northAngle, az, L.el]);
  const sun = useMemo(() => dirFrom(land.northAngle, az, Math.max(2, L.el)), [land.northAngle, az, L.el]);
  const moon = useMemo(() => sunDirection(land.northAngle + 160, 'night'), [land.northAngle]);
  const shadowExtent = size / 2 + 12;

  useEffect(() => {
    if (night) {
      scene.fog = new THREE.Fog('#070b16', 50, 520);
      scene.background = new THREE.Color('#04060d');
      gl.toneMappingExposure = 1.15;
    } else {
      scene.fog = new THREE.Fog(L.fog, L.fogNear, L.fogFar);
      scene.background = null;
      gl.toneMappingExposure = L.exposure;
    }
  }, [night, L, scene, gl]);

  const dist = 260;
  if (night) {
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
  return (
    <>
      <Sky
        distance={4500}
        sunPosition={skySun.clone().multiplyScalar(100).toArray()}
        turbidity={L.turbidity}
        rayleigh={L.rayleigh}
        mieCoefficient={L.mie}
        mieDirectionalG={0.85}
      />
      <hemisphereLight args={[L.hemiSky, L.hemiGround, L.hemiI]} />
      <directionalLight
        position={sun.clone().multiplyScalar(dist).toArray()}
        intensity={L.sunI}
        color={L.sunColor}
        castShadow
        shadow-mapSize={SHADOW}
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
    // إخفاء الكثبان الواقعة في جهة البحر (حتى ما تطلع فوق الماء)
    const seaSides = landEdges(land)
      .map((e, i) => ({ e, k: land.surroundings?.[i] }))
      .filter((x) => x.k === 'sea')
      .map(({ e }) => {
        const mid = lerp(e.a, e.b, 0.5);
        return { mx: mid.x - w.ox, mz: mid.y - w.oy, ox: -e.inward.x, oz: -e.inward.y };
      });
    if (!seaSides.length) return arr;
    return arr.filter((d) => seaSides.every((sd) => (d.x - sd.mx) * sd.ox + (d.z - sd.mz) * sd.oz < -Math.max(d.sx, d.sz)));
  }, [land, w.ox, w.oy]);

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
