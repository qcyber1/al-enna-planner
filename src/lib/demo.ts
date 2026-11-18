/** تجربة مجانية بدون تسجيل: العنة 30 ثانية، والعزبة تجربة منفصلة أطول (مدتها من الأدمن)، والتصدير بعد الشراء */
const KEY = 'enna.demo.start';
export const DEMO_MS = 30 * 1000; // العنة: 30 ثانية
/** مدة تجربة العزبة (افتراضي 3 دقايق) — تتحدث من /api/status */
let izbaMs = 180 * 1000;
export function setIzbaDemoSeconds(sec: unknown) {
  const n = Number(sec);
  if (Number.isFinite(n) && n >= 30 && n <= 3600) izbaMs = Math.round(n) * 1000;
}
type Site = 'enna' | 'izba';
const here = (): Site => {
  try {
    return window.location.pathname.replace(/\/+$/, '').endsWith('/izba') ? 'izba' : 'enna';
  } catch {
    return 'enna';
  }
};
const keyOf = (s: Site) => (s === 'izba' ? KEY + '.izba' : KEY);
const msOf = (s: Site) => (s === 'izba' ? izbaMs : DEMO_MS);
/** مدة التجربة للصفحة الحالية (بالثواني) — للنصوص */
export const demoSeconds = (site: Site = here()) => Math.round(msOf(site) / 1000);

// نحفظ بداية التجربة في localStorage (تبقى بين التبويبات وبعد ما يسكّر المتصفح)
// عشان التجربة ما تتجدد بفتح تبويب جديد. sessionStorage للتوافق مع النسخة القديمة.
// العزبة لها تجربة لحالها: اللي جرّب العنة يقدر يجرّب العزبة
function read(site: Site = here()): number {
  try {
    const v = Number(localStorage.getItem(keyOf(site)) || 0);
    if (v) return v;
  } catch {
    /* تجاهل */
  }
  if (site === 'izba') return 0;
  try {
    return Number(sessionStorage.getItem(KEY) || 0);
  } catch {
    return 0;
  }
}
export function startDemo(now = Date.now()) {
  const site = here();
  if (read(site)) return;
  try {
    localStorage.setItem(keyOf(site), String(now));
  } catch {
    try {
      sessionStorage.setItem(keyOf(site), String(now));
    } catch {
      /* تجاهل */
    }
  }
}
/** كم باقي من التجربة (0 = خلصت أو ما بدت) */
export function demoLeft(now = Date.now()): number {
  const site = here();
  const s = read(site);
  return s ? Math.max(0, s + msOf(site) - now) : 0;
}
/** التجربة انستخدمت وخلصت (حتى بعد إعادة تحميل الصفحة) */
export function demoUsed(now = Date.now()): boolean {
  return read() > 0 && demoLeft(now) === 0;
}
let active = false;
export const isDemo = () => active;
export const setDemoActive = (v: boolean) => {
  active = v;
};
