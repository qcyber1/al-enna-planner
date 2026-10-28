import { createContext, useContext } from 'react';
import type { Vec2 } from '../types/plan';

export interface WorldInfo {
  ox: number;
  oy: number;
}

export const WorldContext = createContext<WorldInfo>({ ox: 0, oy: 0 });

export function useWorld(): WorldInfo {
  return useContext(WorldContext);
}

/** تحويل إحداثيات المخطط إلى إحداثيات المشهد (X = x، Z = y) */
export function toXZ(w: WorldInfo, p: Vec2): [number, number] {
  return [p.x - w.ox, p.y - w.oy];
}
