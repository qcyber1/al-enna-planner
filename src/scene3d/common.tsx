import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export interface MatOpts {
  color?: string;
  map?: THREE.Texture | null;
  roughness?: number;
  metalness?: number;
  side?: THREE.Side;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  alphaTest?: number;
}

/** مادة قياسية تُنشأ مرة وتُحرر عند التغيير */
export function useMat(o: MatOpts): THREE.MeshStandardMaterial {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: o.color ?? '#ffffff',
        map: o.map ?? null,
        roughness: o.roughness ?? 0.9,
        metalness: o.metalness ?? 0,
        side: o.side ?? THREE.FrontSide,
        emissive: o.emissive ?? '#000000',
        emissiveIntensity: o.emissiveIntensity ?? 0,
        transparent: o.transparent ?? false,
        opacity: o.opacity ?? 1,
        alphaTest: o.alphaTest ?? 0,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [o.color, o.map, o.roughness, o.metalness, o.side, o.emissive, o.emissiveIntensity, o.transparent, o.opacity, o.alphaTest],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

/** مستطيل مسطح بإحداثيات UV مضبوطة بالمتر */
export function scaledPlane(w: number, h: number, tileU: number, tileV: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tileU), uv.getY(i) * (h / tileV));
  return g;
}

export function useGeometry<T extends THREE.BufferGeometry>(make: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g = useMemo(make, deps);
  useEffect(() => () => g.dispose(), [g]);
  return g;
}

export const WOOD = '#6b4a2b';
export const METAL = '#3a3a3a';

/** عمود أسطواني بسيط */
export function Pole({
  x,
  z,
  h,
  r = 0.05,
  color = WOOD,
  y0 = 0,
}: {
  x: number;
  z: number;
  h: number;
  r?: number;
  color?: string;
  y0?: number;
}) {
  return (
    <mesh position={[x, y0 + h / 2, z]} castShadow>
      <cylinderGeometry args={[r, r * 1.1, h, 8]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

/** حبال شد (خطوط رفيعة) */
export function Ropes({ segments, color = '#cbb894' }: { segments: [number, number, number][]; color?: string }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(segments.flat(), 3));
    return g;
  }, [segments]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
}
