import { create } from 'zustand';
import type { Vec2 } from '../types/plan';

interface ViewportState {
  x: number;
  y: number;
  scale: number;
  cursor: Vec2 | null;
  /** طلب ملاءمة العرض (يزداد الرقم عند كل طلب) */
  fitNonce: number;
  zoomRequest: { factor: number; nonce: number };
  setView: (v: { x: number; y: number; scale: number }) => void;
  setCursor: (c: Vec2 | null) => void;
  requestFit: () => void;
  requestZoom: (factor: number) => void;
}

export const MIN_SCALE = 2;
export const MAX_SCALE = 260;

export const useViewport = create<ViewportState>()((set, get) => ({
  x: 0,
  y: 0,
  scale: 18,
  cursor: null,
  fitNonce: 0,
  zoomRequest: { factor: 1, nonce: 0 },
  setView: (v) => set(v),
  setCursor: (cursor) => set({ cursor }),
  requestFit: () => set({ fitNonce: get().fitNonce + 1 }),
  requestZoom: (factor) => set({ zoomRequest: { factor, nonce: get().zoomRequest.nonce + 1 } }),
}));

/** حالة الرسم الجارية (لتجنب تعارض اختصارات لوحة المفاتيح) */
export const drawingState = { active: false };
