// الغرف (جدران بفتحات حقيقية، تشطيب داخلي، سقف كيربي) والأثاث الداخلي ثلاثي الأبعاد
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { PlanElement, Side } from '../types/plan';
import { DOOR_H, SIDES, SILL_H, WALL, WIN_TOP, sidePoint, wallPieces } from '../lib/rooms';
import { useMat } from './common';
import { corrugatedTexture, marbleTexture, microcementTexture, stoneTexture, tilesTexture, woodTexture } from './textures';
import { shade } from '../lib/color';
import { useView3D } from './viewStore';

interface P {
  el: PlanElement;
  night: boolean;
  lampsOn: boolean;
}

function floorTex(f: string): { map: THREE.Texture | null; tile: number; color: string; rough: number } {
  switch (f) {
    case 'marble':
      return { map: marbleTexture(), tile: 1.2, color: '#ffffff', rough: 0.12 };
    case 'wood':
      return { map: woodTexture(), tile: 1.6, color: '#e6c9a6', rough: 0.55 };
    case 'microcement':
      return { map: microcementTexture(), tile: 3, color: '#ffffff', rough: 0.45 };
    case 'tiles':
      return { map: tilesTexture(), tile: 2.4, color: '#ffffff', rough: 0.4 };
    default:
      return { map: null, tile: 1, color: '#c8b89a', rough: 1 };
  }
}

/** مستطيل بخامة مكررة بالمتر (نسخة من الخامة عشان التكرار ما يأثر على عناصر ثانية) */
function useTiled(map: THREE.Texture | null, w: number, h: number, tile: number) {
  const t = useMemo(() => {
    if (!map) return null;
    const c = map.clone();
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(Math.max(0.2, w / tile), Math.max(0.2, h / tile));
    c.needsUpdate = true;
    return c;
  }, [map, w, h, tile]);
  useEffect(() => () => t?.dispose(), [t]);
  return t;
}

/** قطعة جدار: صندوق من الخارج + وجه داخلي بالتشطيب */
function WallBox({ el, side, a, b, y0, y1, outer, inner }: { el: PlanElement; side: Side; a: number; b: number; y0: number; y1: number; outer: THREE.Material; inner: THREE.Material }) {
  const len = b - a;
  const h = y1 - y0;
  if (len <= 0.001 || h <= 0.001) return null;
  const mid = sidePoint(el, side, (a + b) / 2, WALL / 2);
  const face = sidePoint(el, side, (a + b) / 2, WALL + 0.004);
  const along = side === 'front' || side === 'back';
  const rotY = side === 'front' ? Math.PI : side === 'back' ? 0 : side === 'left' ? Math.PI / 2 : -Math.PI / 2;
  return (
    <group>
      <mesh position={[mid.x, y0 + h / 2, mid.y]} material={outer} castShadow receiveShadow>
        <boxGeometry args={along ? [len, h, WALL] : [WALL, h, len]} />
      </mesh>
      <mesh position={[face.x, y0 + h / 2, face.y]} rotation={[0, rotY, 0]} material={inner} receiveShadow>
        <planeGeometry args={[len, h]} />
      </mesh>
    </group>
  );
}

function Room({ el, night, lampsOn }: P) {
  const r = el.room!;
  const H = el.height;
  const interior = useView3D((s) => s.interior);
  const outer = useMat({ color: el.color, roughness: 0.85 });
  const wallMap = r.wall === 'wood-panel' ? woodTexture() : r.wall === 'stone' ? stoneTexture() : r.wall === 'marble' ? marbleTexture() : null;
  const inner = useMat({ color: r.wall === 'paint' ? r.wallColor : r.wall === 'marble' ? '#ffffff' : r.wallColor, map: wallMap, roughness: r.wall === 'marble' ? 0.2 : 0.8 });
  const fl = floorTex(r.floor);
  const iw = el.width - 2 * WALL;
  const id = el.depth - 2 * WALL;
  const fmap = useTiled(fl.map, iw, id, fl.tile);
  const floorMat = useMat({ color: fl.color, map: fmap, roughness: fl.rough, metalness: r.floor === 'marble' ? 0.05 : 0 });
  const glass = useMat({ color: night && lampsOn ? '#ffd79a' : '#a9c7d8', roughness: 0.08, metalness: 0.4, emissive: night && lampsOn ? '#ffb35c' : '#000000', emissiveIntensity: night && lampsOn ? 0.6 : 0, transparent: true, opacity: 0.55 });
  const doorMat = useMat({ color: el.accent, roughness: 0.5 });
  const roofMat = useMat({ color: el.roof ?? shade(el.color, -0.08), map: el.roof ? corrugatedTexture() : null, roughness: 0.55, metalness: el.roof ? 0.3 : 0 });
  const lit = night && lampsOn;

  const pieces = SIDES.flatMap((side) => wallPieces(el, side).map((p) => ({ side, p })));
  return (
    <group>
      {/* الأرضية */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floorMat} receiveShadow>
        <planeGeometry args={[iw, id]} />
      </mesh>
      {/* الجدران */}
      {pieces.map(({ side, p }, i) => {
        if (p.kind === 'solid') return <WallBox key={i} el={el} side={side} a={p.a} b={p.b} y0={0} y1={H} outer={outer} inner={inner} />;
        if (p.kind === 'door') {
          const len = p.b - p.a;
          const hinge = sidePoint(el, side, p.a, WALL * 0.5);
          // زاوية الضلفة مفتوحة للداخل
          const base = side === 'front' ? 0 : side === 'back' ? Math.PI : side === 'left' ? -Math.PI / 2 : Math.PI / 2;
          const open = side === 'front' || side === 'left' ? 1.1 : -1.1;
          return (
            <group key={i}>
              <WallBox el={el} side={side} a={p.a} b={p.b} y0={DOOR_H} y1={H} outer={outer} inner={inner} />
              <group position={[hinge.x, 0, hinge.y]} rotation={[0, base + open, 0]}>
                <mesh position={[len / 2, DOOR_H / 2, 0]} material={doorMat} castShadow>
                  <boxGeometry args={[len, DOOR_H - 0.02, 0.05]} />
                </mesh>
              </group>
            </group>
          );
        }
        const c = sidePoint(el, side, (p.a + p.b) / 2, WALL / 2);
        const along = side === 'front' || side === 'back';
        return (
          <group key={i}>
            <WallBox el={el} side={side} a={p.a} b={p.b} y0={0} y1={SILL_H} outer={outer} inner={inner} />
            <WallBox el={el} side={side} a={p.a} b={p.b} y0={WIN_TOP} y1={H} outer={outer} inner={inner} />
            <mesh position={[c.x, (SILL_H + WIN_TOP) / 2, c.y]} material={glass}>
              <boxGeometry args={along ? [p.b - p.a, WIN_TOP - SILL_H, 0.03] : [0.03, WIN_TOP - SILL_H, p.b - p.a]} />
            </mesh>
          </group>
        );
      })}
      {/* إضاءة مخفية: شرايط رفيعة على أطراف السقف + ضوء خفيف داخل الغرفة بالليل */}
      {r.coveLight && lit && (
        <group>
          {[
            [0, -id / 2 + 0.12, iw - 0.3, 0.06],
            [0, id / 2 - 0.12, iw - 0.3, 0.06],
            [-iw / 2 + 0.12, 0, 0.06, id - 0.3],
            [iw / 2 - 0.12, 0, 0.06, id - 0.3],
          ].map(([x, z, sx, sz], k) => (
            <mesh key={k} position={[x, H - 0.3, z]}>
              <boxGeometry args={[sx, 0.04, sz]} />
              <meshStandardMaterial color="#ffe2b0" emissive="#ffb45a" emissiveIntensity={2} toneMapped={false} />
            </mesh>
          ))}
        </group>
      )}
      {lit && <pointLight position={[0, H - 0.6, 0]} intensity={Math.min(30, iw * id * 0.9)} distance={Math.max(iw, id) * 1.4} decay={2} color="#ffd9a6" />}
      {/* السقف */}
      {!interior && (
        <mesh position={[0, H + 0.08, 0]} material={roofMat} castShadow receiveShadow>
          <boxGeometry args={[el.width + (el.roof ? 0.5 : 0.1), el.roof ? 0.08 : 0.16, el.depth + (el.roof ? 0.5 : 0.1)]} />
        </mesh>
      )}
    </group>
  );
}

// ——— الأثاث ———
function SofaL({ el }: P) {
  const w = el.width;
  const d = el.depth;
  const t = Math.min(0.85, w / 3, d / 3);
  const mat = useMat({ color: el.color, roughness: 0.95 });
  const back = useMat({ color: shade(el.color, -0.08), roughness: 0.95 });
  const pil = useMat({ color: el.accent, roughness: 0.9 });
  const nb = Math.max(1, Math.floor((w - t) / 0.8));
  const ns = Math.max(1, Math.floor((d - t) / 0.8));
  return (
    <group>
      <mesh position={[0, 0.2, -d / 2 + t / 2]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[w, 0.4, t]} />
      </mesh>
      <mesh position={[-w / 2 + t / 2, 0.2, t / 2]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[t, 0.4, d - t]} />
      </mesh>
      <mesh position={[0, 0.62, -d / 2 + 0.1]} material={back} castShadow>
        <boxGeometry args={[w, 0.45, 0.2]} />
      </mesh>
      <mesh position={[-w / 2 + 0.1, 0.62, 0.1]} material={back} castShadow>
        <boxGeometry args={[0.2, 0.45, d - 0.2]} />
      </mesh>
      {Array.from({ length: nb }).map((_, i) => (
        <mesh key={`b${i}`} position={[-w / 2 + t + 0.4 + i * 0.8, 0.6, -d / 2 + 0.28]} rotation={[-0.25, 0, 0]} material={pil} castShadow>
          <boxGeometry args={[0.55, 0.38, 0.14]} />
        </mesh>
      ))}
      {Array.from({ length: ns }).map((_, i) => (
        <mesh key={`s${i}`} position={[-w / 2 + 0.28, 0.6, -d / 2 + t + 0.4 + i * 0.8]} rotation={[0, 0, 0.25]} material={pil} castShadow>
          <boxGeometry args={[0.14, 0.38, 0.55]} />
        </mesh>
      ))}
    </group>
  );
}

function TvUnit({ el, night, lampsOn }: P) {
  const w = el.width;
  const d = el.depth;
  const h = el.height;
  const wood = useMat({ color: el.color, map: woodTexture(), roughness: 0.6 });
  const on = night && lampsOn;
  return (
    <group>
      <mesh position={[0, 0.25, 0]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[w, 0.5, d]} />
      </mesh>
      {[-w / 2 + 0.2, w / 2 - 0.2].map((x) => (
        <mesh key={x} position={[x, h / 2, -d / 2 + 0.15]} material={wood} castShadow>
          <boxGeometry args={[0.4, h, 0.3]} />
        </mesh>
      ))}
      <mesh position={[0, h - 0.1, -d / 2 + 0.15]} material={wood} castShadow>
        <boxGeometry args={[w, 0.2, 0.3]} />
      </mesh>
      <mesh position={[0, 1.25, -d / 2 + 0.06]}>
        <boxGeometry args={[Math.min(1.6, w - 1), 0.9, 0.05]} />
        <meshStandardMaterial color={el.accent} emissive={on ? '#3a5f8a' : '#000'} emissiveIntensity={on ? 0.6 : 0} roughness={0.2} metalness={0.4} />
      </mesh>
    </group>
  );
}

function CoffeeTable({ el }: P) {
  const { width: w, depth: d, height: h } = el;
  const mat = useMat({ color: el.color, map: woodTexture(), roughness: 0.4 });
  return (
    <group>
      <mesh position={[0, h - 0.04, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[w, 0.08, d]} />
      </mesh>
      <mesh position={[0, (h - 0.08) / 2, 0]} material={mat} castShadow>
        <boxGeometry args={[w * 0.85, h - 0.08, d * 0.75]} />
      </mesh>
      <mesh position={[0, h + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.8, d * 0.7]} />
        <meshStandardMaterial color={el.accent} roughness={0.3} metalness={0.3} />
      </mesh>
    </group>
  );
}

function Bed({ el }: P) {
  const { width: w, depth: d } = el;
  const frame = useMat({ color: el.accent, roughness: 0.8 });
  const sheet = useMat({ color: el.color, roughness: 1 });
  const double = w > 1.3;
  return (
    <group>
      <mesh position={[0, 0.2, 0]} material={frame} castShadow receiveShadow>
        <boxGeometry args={[w, 0.4, d]} />
      </mesh>
      <mesh position={[0, 0.5, 0.05]} material={sheet} castShadow receiveShadow>
        <boxGeometry args={[w - 0.08, 0.22, d - 0.15]} />
      </mesh>
      <mesh position={[0, 0.6, -d / 2 + 0.05]} material={frame} castShadow>
        <boxGeometry args={[w + 0.1, 1.2, 0.1]} />
      </mesh>
      {Array.from({ length: double ? 2 : 1 }).map((_, i) => (
        <mesh key={i} position={[double ? (i ? 1 : -1) * (w / 4) : 0, 0.68, -d / 2 + 0.35]} castShadow>
          <boxGeometry args={[double ? w / 2 - 0.15 : w - 0.25, 0.14, 0.4]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 0.62, d * 0.18]} castShadow>
        <boxGeometry args={[w - 0.04, 0.05, d * 0.55]} />
        <meshStandardMaterial color={shade(el.accent, 0.25)} roughness={1} />
      </mesh>
    </group>
  );
}

function Wardrobe({ el }: P) {
  const { width: w, depth: d, height: h } = el;
  const mat = useMat({ color: el.color, roughness: 0.5 });
  const n = Math.max(1, Math.round(w / 0.5));
  return (
    <group>
      <mesh position={[0, h / 2, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {Array.from({ length: n - 1 }).map((_, i) => (
        <mesh key={i} position={[-w / 2 + (w / n) * (i + 1), h / 2, d / 2 + 0.005]}>
          <boxGeometry args={[0.01, h - 0.1, 0.01]} />
          <meshStandardMaterial color={el.accent} />
        </mesh>
      ))}
    </group>
  );
}

function Billiard({ el }: P) {
  const { width: w, depth: d, height: h } = el;
  const wood = useMat({ color: el.accent, map: woodTexture(), roughness: 0.4 });
  return (
    <group>
      <mesh position={[0, h - 0.08, 0]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[w, 0.16, d]} />
      </mesh>
      <mesh position={[0, h + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.24, d - 0.24]} />
        <meshStandardMaterial color={el.color} roughness={1} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (w / 2 - 0.2), (h - 0.16) / 2, sz * (d / 2 - 0.2)]} material={wood} castShadow>
            <boxGeometry args={[0.16, h - 0.16, 0.16]} />
          </mesh>
        )),
      )}
    </group>
  );
}

function KitchenCounter({ el }: P) {
  const { width: w, depth: d, height: h } = el;
  const body = useMat({ color: el.color, roughness: 0.5 });
  const top = useMat({ color: el.accent, roughness: 0.25, metalness: 0.1 });
  return (
    <group>
      <mesh position={[0, (h - 0.04) / 2, 0]} material={body} castShadow receiveShadow>
        <boxGeometry args={[w, h - 0.04, d]} />
      </mesh>
      <mesh position={[0, h - 0.02, 0]} material={top} castShadow>
        <boxGeometry args={[w + 0.02, 0.04, d + 0.02]} />
      </mesh>
      <mesh position={[w / 2 - 0.4, 0.95, -d / 2 + 0.35]} castShadow>
        <boxGeometry args={[0.75, 1.9, 0.7]} />
        <meshStandardMaterial color="#b9bcbf" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.9, -d / 2 + 0.18]} material={body} castShadow>
        <boxGeometry args={[w - 0.9, 0.7, 0.35]} />
      </mesh>
    </group>
  );
}

function BathSet({ el }: P) {
  const { width: w, depth: d } = el;
  const white = useMat({ color: '#ffffff', roughness: 0.15 });
  return (
    <group>
      {/* مرحاض */}
      <mesh position={[-w / 2 + 0.35, 0.22, -d / 2 + 0.45]} material={white} castShadow>
        <cylinderGeometry args={[0.2, 0.17, 0.44, 16]} />
      </mesh>
      <mesh position={[-w / 2 + 0.35, 0.6, -d / 2 + 0.15]} material={white} castShadow>
        <boxGeometry args={[0.38, 0.4, 0.16]} />
      </mesh>
      {/* مغسلة */}
      <mesh position={[-w / 2 + 0.35, 0.85, d / 2 - 0.27]} material={white} castShadow>
        <boxGeometry args={[0.6, 0.12, 0.45]} />
      </mesh>
      {/* دش بزجاج */}
      <mesh position={[w / 2 - 0.45, 0.02, -d / 2 + 0.45]} rotation={[-Math.PI / 2, 0, 0]} material={white}>
        <planeGeometry args={[0.9, 0.9]} />
      </mesh>
      <mesh position={[w / 2 - 0.9, 1, -d / 2 + 0.45]}>
        <boxGeometry args={[0.02, 2, 0.9]} />
        <meshStandardMaterial color={el.accent} transparent opacity={0.35} roughness={0.05} metalness={0.3} />
      </mesh>
    </group>
  );
}

export function Interior3D(props: P) {
  switch (props.el.kind) {
    case 'room':
      return props.el.room ? <Room {...props} /> : null;
    case 'sofa-l':
      return <SofaL {...props} />;
    case 'tv-unit':
      return <TvUnit {...props} />;
    case 'coffee-table':
      return <CoffeeTable {...props} />;
    case 'bed':
      return <Bed {...props} />;
    case 'wardrobe':
      return <Wardrobe {...props} />;
    case 'billiard':
      return <Billiard {...props} />;
    case 'kitchen-counter':
      return <KitchenCounter {...props} />;
    case 'bath-set':
      return <BathSet {...props} />;
    default:
      return null;
  }
}
