// خيارات عرض المشهد 3D البسيطة (بدون ما نلمس المتجر الرئيسي)
import { create } from 'zustand';

interface ViewState {
  /** «شوف الداخل»: نشيل سقوف الغرف عشان يبين التصميم الداخلي */
  interior: boolean;
  toggleInterior: () => void;
}
export const useView3D = create<ViewState>((set) => ({
  interior: false,
  toggleInterior: () => set((s) => ({ interior: !s.interior })),
}));
