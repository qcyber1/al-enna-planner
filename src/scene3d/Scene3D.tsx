import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { CameraControls, PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraPreset, Plan, PlanElement } from '../types/plan';
import { activeDesign, useEditor, usePlan } from '../store/editorStore';
import { DEG, entranceInfo, landBounds, isFiniteBounds } from '../lib/geometry';
import { isLightKind, isTentKind } from '../lib/catalog';
import { collectEmitters } from '../lib/lighting';
import { WorldContext, type WorldInfo } from './world';
import { Ground3D, Fence3D, SceneLighting } from './Environment3D';
import { Tent3D } from './Tent3D';
import {
  BBQ3D,
  Canopy3D,
  Court3D,
  Generator3D,
  Kitchen3D,
  Parking3D,
  Rug3D,
  Seating3D,
  Sink3D,
  Storage3D,
  TableSet3D,
  Toilet3D,
  WaterTank3D,
} from './Facilities3D';
import { Path3D, StringLights3D } from './Paths3D';
import { LightFixture3D, LightRig } from './Lights3D';
import { Camera3DOverlay } from './Camera3DOverlay';
import { Extra3D } from './Extras3D';
import { Surroundings3D } from './Surroundings3D';
import { canvasToBlob } from '../render2d/exportImage';
import { safeFileName, shareOrDownload, stamp } from '../lib/files';
import { saveThumbs } from '../lib/storage';

const BUDGET = { low: 8, medium: 20, high: 40 };
const PROMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('promo');

interface ElProps {
  el: PlanElement;
  night: boolean;
  lampsOn: boolean;
  selected: boolean;
  showSafety: boolean;
  poleSpots: { x: number; y: number }[];
  onSelect: (id: string, e: ThreeEvent<MouseEvent>) => void;
}

const Element3D = memo(function Element3D({ el, night, lampsOn, selected, showSafety, poleSpots, onSelect }: ElProps) {
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return;
    e.stopPropagation();
    onSelect(el.id, e);
  };
  if (el.kind === 'path') return <group onClick={click}><Path3D el={el} lampsOn={lampsOn} /></group>;
  if (el.kind === 'string-lights') return <group onClick={click}><StringLights3D el={el} lampsOn={lampsOn} poleSpots={poleSpots} /></group>;
  let body: React.ReactNode = null;
  if (isTentKind(el.kind) && el.tent) body = <Tent3D el={el} glow={lampsOn && el.tent.interiorLight} lampsOn={lampsOn && el.tent.entranceLight} />;
  else if (isLightKind(el.kind) && el.light) body = <LightFixture3D el={el} lampsOn={lampsOn} />;
  else {
    switch (el.kind) {
      case 'volleyball':
        body = <Court3D el={el} showSafety={showSafety} />;
        break;
      case 'canopy':
        body = <Canopy3D el={el} />;
        break;
      case 'majlis-rug':
        body = <Rug3D el={el} />;
        break;
      case 'toilet':
        body = <Toilet3D el={el} />;
        break;
      case 'sink':
        body = <Sink3D el={el} />;
        break;
      case 'outdoor-kitchen':
        body = <Kitchen3D el={el} />;
        break;
      case 'storage':
        body = <Storage3D el={el} />;
        break;
      case 'parking':
        body = <Parking3D el={el} />;
        break;
      case 'water-tank':
        body = <WaterTank3D el={el} />;
        break;
      case 'generator':
        body = <Generator3D el={el} />;
        break;
      case 'bbq':
        body = <BBQ3D el={el} night={night} />;
        break;
      case 'table-set':
        body = <TableSet3D el={el} />;
        break;
      case 'seating':
        body = <Seating3D el={el} />;
        break;
      default:
        body = <Extra3D el={el} night={night} lampsOn={lampsOn} />;
    }
  }
  return (
    <group onClick={click}>
      {body}
      {selected && (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(el.width, el.depth) * 0.62, Math.max(el.width, el.depth) * 0.62 + 0.12, 48]} />
          <meshBasicMaterial color="#1d6fd8" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
});

/** يضع العناصر المستطيلة في موضعها (العناصر الخطية تستخدم إحداثيات المخطط مباشرة) */
function Placed({ el, w, children }: { el: PlanElement; w: WorldInfo; children: React.ReactNode }) {
  if (el.points) return <group position={[-w.ox, 0, -w.oy]}>{children}</group>;
  return (
    <group position={[el.x - w.ox, 0, el.y - w.oy]} rotation={[0, -el.rotation * DEG, 0]}>
      {children}
    </group>
  );
}

function presetPose(preset: CameraPreset, plan: Plan, w: WorldInfo): { pos: [number, number, number]; target: [number, number, number] } {
  const b = landBounds(plan.land);
  const W = b.maxX - b.minX;
  const D = b.maxY - b.minY;
  const M = Math.max(W, D);
  const ent = entranceInfo(plan.land);
  const E = { x: ent.center.x - w.ox, z: ent.center.y - w.oy };
  const inn = ent.inward;
  const main =
    plan.elements.find((e) => e.kind === 'main-tent') ??
    [...plan.elements].filter((e) => isTentKind(e.kind)).sort((a, c) => c.width * c.depth - a.width * a.depth)[0];
  switch (preset) {
    case 'top':
      return { pos: [0, M * 1.45, 0.01], target: [0, 0, 0] };
    case 'human':
      return {
        pos: [E.x + inn.x * 2.5, 1.7, E.z + inn.y * 2.5],
        target: main ? [main.x - w.ox, 1.6, main.y - w.oy] : [E.x + inn.x * 12, 1.6, E.z + inn.y * 12],
      };
    case 'entrance':
      return { pos: [E.x - inn.x * 9, 2.4, E.z - inn.y * 9], target: [E.x + inn.x * 8, 1.4, E.z + inn.y * 8] };
    case 'main-tent': {
      if (!main) return presetPose('oblique', plan, w);
      const f = { x: -Math.sin(main.rotation * DEG), y: Math.cos(main.rotation * DEG) };
      const dd = Math.max(main.width, main.depth) * 1.05 + 4;
      return {
        pos: [main.x - w.ox + f.x * dd + 2, 3.4, main.y - w.oy + f.y * dd],
        target: [main.x - w.ox, main.height * 0.45, main.y - w.oy],
      };
    }
    case 'oblique':
    default: {
      const back = { x: -inn.x, z: -inn.y };
      return {
        pos: [back.x * M * 0.95 + inn.y * M * 0.45, M * 0.8, back.z * M * 0.95 - inn.x * M * 0.45],
        target: [0, 0, 0],
      };
    }
  }
}

function CameraRig({ plan, w, walking }: { plan: Plan; w: WorldInfo; walking: boolean }) {
  const ref = useRef<CameraControls>(null);
  const camera = useEditor((s) => s.camera);
  const first = useRef(true);
  useEffect(() => {
    const c = ref.current;
    if (!c || walking) return;
    const p = presetPose(camera.preset === 'walk' || camera.preset === 'orbit' ? 'oblique' : camera.preset, plan, w);
    c.setLookAt(...p.pos, ...p.target, !first.current);
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.nonce, walking]);
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => {
    if (PROMO) Object.assign(window as unknown as Record<string, unknown>, { __ennaCam: ref.current, __ennaInvalidate: invalidate });
  });
  if (walking) return null;
  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={1.5}
      maxDistance={600}
      maxPolarAngle={Math.PI * 0.495}
      dollySpeed={0.6}
      smoothTime={0.35}
    />
  );
}

/** وضع التجول بالكيبورد والماوس */
function WalkControls({ plan, w, move }: { plan: Plan; w: WorldInfo; move: React.MutableRefObject<{ f: number; s: number; turn: number }> }) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const b = landBounds(plan.land);
  useEffect(() => {
    const p = presetPose('human', plan, w);
    camera.position.set(...p.pos);
    camera.lookAt(...p.target);
    const down = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFrame((_, dt) => {
    const k = keys.current;
    const run = k.ShiftLeft || k.ShiftRight ? 2.2 : 1;
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + move.current.f;
    const s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + move.current.s;
    const turn = (k.ArrowLeft || k.KeyQ ? 1 : 0) - (k.ArrowRight || k.KeyE ? 1 : 0) + move.current.turn;
    if (turn) camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), turn * dt * 1.4);
    if (f || s) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.y = 0;
      dir.normalize();
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
      camera.position.addScaledVector(dir, f * 3.2 * run * dt).addScaledVector(right, s * 3.2 * run * dt);
    }
    camera.position.x = Math.max(b.minX - w.ox - 15, Math.min(b.maxX - w.ox + 15, camera.position.x));
    camera.position.z = Math.max(b.minY - w.oy - 15, Math.min(b.maxY - w.oy + 15, camera.position.z));
    camera.position.y = 1.7;
  });
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;
  return isTouch ? null : <PointerLockControls selector="#walk-start" />;
}

/** التقاط صورة المشهد عند الطلب */
function CaptureHandler() {
  const { gl, scene, camera } = useThree();
  const capture = useEditor((s) => s.capture3d);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    gl.render(scene, camera);
    const st = useEditor.getState();
    const design = activeDesign(st.project);
    if (capture.mode === 'thumb') {
      const small = document.createElement('canvas');
      small.width = 640;
      small.height = Math.round((640 * gl.domElement.height) / gl.domElement.width);
      small.getContext('2d')?.drawImage(gl.domElement, 0, 0, small.width, small.height);
      const ok = saveThumbs(design.id, { d3: small.toDataURL('image/jpeg', 0.8) });
      st.toast(ok ? 'تم حفظ لقطة 3D لهذا التصميم للمقارنة' : 'تعذر حفظ اللقطة (المساحة ممتلئة)', ok ? 'success' : 'warning');
      return;
    }
    canvasToBlob(gl.domElement)
      .then((blob) =>
        capture.mode === 'share'
          ? shareOrDownload(blob, `al-enna-3d-${safeFileName(design.name)}-${stamp()}.png`, `${st.project.name} — ${design.name}`)
          : shareOrDownload(blob, `al-enna-3d-${safeFileName(design.name)}-${stamp()}.png`, design.name).then(() => 'downloaded' as const),
      )
      .then((r) => r !== 'cancelled' && st.toast('تم تصدير صورة المشهد 3D', 'success'))
      .catch(() => st.toast('تعذر تصدير الصورة', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture.nonce]);
  return null;
}

export default function Scene3D() {
  const plan = usePlan();
  const time = useEditor((s) => s.time);
  const lightsMaster = useEditor((s) => s.lightsMaster);
  const quality = useEditor((s) => s.lightQuality);
  const selection = useEditor((s) => s.selection);
  const showSafety = useEditor((s) => s.overlays.safety);
  const preset = useEditor((s) => s.camera.preset);
  const walking = preset === 'walk';
  const move = useRef({ f: 0, s: 0, turn: 0 });
  const [ready, setReady] = useState(false);

  const b = landBounds(plan.land);
  const w: WorldInfo = useMemo(
    () => (isFiniteBounds(b) ? { ox: (b.minX + b.maxX) / 2, oy: (b.minY + b.maxY) / 2 } : { ox: 0, oy: 0 }),
    [b.minX, b.minY, b.maxX, b.maxY],
  );
  const size = Math.max(b.maxX - b.minX, b.maxY - b.minY);
  const night = time !== 'day';
  const lampsOn = night && lightsMaster;
  const emitters = useMemo(() => (lampsOn ? collectEmitters(plan) : []), [plan, lampsOn]);
  const poleSpots = useMemo(
    () => plan.elements.filter((e) => e.kind === 'light-pole' || e.kind === 'entrance-light' || e.kind === 'flood-light').map((e) => ({ x: e.x, y: e.y })),
    [plan.elements],
  );
  const onSelect = useMemo(
    () => (id: string, e: ThreeEvent<MouseEvent>) => {
      const st = useEditor.getState();
      if (e.nativeEvent.shiftKey) st.toggleSelect(id);
      else st.select([id]);
    },
    [],
  );

  return (
    <div className="relative h-full w-full bg-[#cfd9e3]" data-testid="scene-3d">
      <Canvas
        shadows
        dpr={PROMO ? 1 : [1, 2]}
        frameloop={PROMO ? 'demand' : 'always'}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        camera={{ fov: 50, near: 0.1, far: 4000, position: [30, 30, 40] }}
        onCreated={() => setReady(true)}
        onPointerMissed={() => useEditor.getState().clearSelection()}
      >
        <WorldContext.Provider value={w}>
          <SceneLighting time={time} land={plan.land} size={size} />
          <Ground3D land={plan.land} w={w} />
          <Fence3D land={plan.land} w={w} />
          <Surroundings3D land={plan.land} w={w} />
          {plan.elements.map((el) => (
            <Placed key={el.id} el={el} w={w}>
              <Element3D
                el={el}
                night={night}
                lampsOn={lampsOn}
                selected={selection.includes(el.id)}
                showSafety={showSafety}
                poleSpots={poleSpots}
                onSelect={onSelect}
              />
            </Placed>
          ))}
          {lampsOn && <LightRig emitters={emitters} budget={BUDGET[quality]} w={w} />}
          <CameraRig plan={plan} w={w} walking={walking} />
          {walking && <WalkControls plan={plan} w={w} move={move} />}
          <CaptureHandler />
        </WorldContext.Provider>
      </Canvas>
      {!ready && <div className="absolute inset-0 flex items-center justify-center text-sand-800">جاري تجهيز المشهد ثلاثي الأبعاد…</div>}
      <Camera3DOverlay move={move} />
    </div>
  );
}
