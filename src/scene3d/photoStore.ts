// حالة «الرندر الواقعي» — ملف صغير منفصل عشان ما يسحب مكتبة المحاكاة للحزمة الرئيسية
import { create } from 'zustand';

export type Status = 'idle' | 'preparing' | 'rendering' | 'done' | 'error';
interface PhotoState {
  status: Status;
  samples: number;
  target: number;
  url: string;
  start: (target: number) => void;
  progress: (n: number) => void;
  finish: (url: string) => void;
  fail: () => void;
  close: () => void;
}
export const usePhoto = create<PhotoState>((set) => ({
  status: 'idle',
  samples: 0,
  target: 200,
  url: '',
  start: (target) => set({ status: 'preparing', samples: 0, target, url: '' }),
  progress: (samples) => set({ status: 'rendering', samples }),
  finish: (url) => set({ status: 'done', url }),
  fail: () => set({ status: 'error' }),
  close: () => set({ status: 'idle', samples: 0, url: '' }),
}));
