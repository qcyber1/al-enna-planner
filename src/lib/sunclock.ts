import type { TimeOfDay } from '../types/plan';

/**
 * ساعة الشمس في قطر خلال موسم العنن (نوفمبر–فبراير تقريباً):
 * الظهر ~11:30، المغرب ~4:45 م، ويظلم تماماً ~5:15 م.
 */
export const HOUR_MIN = 13;
export const HOUR_MAX = 20;
export const NOON = 11.5;
export const SUNSET = 16.75;
const MAX_ELEVATION = 42;

/** الساعة الافتراضية لكل زر من الأزرار الثلاثة */
export const PRESET_HOUR: Record<TimeOfDay, number> = { day: 13.5, sunset: 16.5, night: 19 };

/** ارتفاع الشمس بالدرجات (سالب = تحت الأفق) */
export function sunElevation(h: number): number {
  return MAX_ELEVATION * Math.cos((((h - NOON) / (SUNSET - NOON)) * Math.PI) / 2);
}

/** سمت الشمس بالدرجات من الشمال (العصر جهة الجنوب الغربي ← الغرب) */
export function sunAzimuth(h: number): number {
  return 180 + (65 * (h - NOON)) / (SUNSET - NOON);
}

/** وصف الوقت (للأزرار والإنارة): نهار / مغرب / ليل */
export function timeFromHour(h: number): TimeOfDay {
  if (h < 16.2) return 'day';
  if (h < 17.25) return 'sunset';
  return 'night';
}

export function clampHour(h: number): number {
  return Math.min(HOUR_MAX, Math.max(HOUR_MIN, Number.isFinite(h) ? h : PRESET_HOUR.day));
}

/** «4:45 م» */
export function formatHour(h: number): string {
  const total = Math.round(h * 60);
  let hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const en = typeof document !== 'undefined' && document.documentElement.lang === 'en';
  const suffix = en ? (hh >= 12 ? 'pm' : 'am') : hh >= 12 ? 'م' : 'ص';
  hh = hh % 12 || 12;
  return `${hh}:${String(mm).padStart(2, '0')} ${suffix}`;
}
