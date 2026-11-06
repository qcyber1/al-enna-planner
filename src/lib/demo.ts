/** تجربة مجانية بدون تسجيل: دقيقة وحدة، والتصدير بعد الشراء */
const KEY = 'enna.demo.start';
export const DEMO_MS = 60 * 1000; // دقيقة وحدة

// نحفظ بداية التجربة في localStorage (تبقى بين التبويبات وبعد ما يسكّر المتصفح)
// عشان التجربة ما تتجدد بفتح تبويب جديد. sessionStorage للتوافق مع النسخة القديمة.
function read(): number {
  try {
    const v = Number(localStorage.getItem(KEY) || 0);
    if (v) return v;
  } catch {
    /* تجاهل */
  }
  try {
    return Number(sessionStorage.getItem(KEY) || 0);
  } catch {
    return 0;
  }
}
export function startDemo(now = Date.now()) {
  if (read()) return;
  try {
    localStorage.setItem(KEY, String(now));
  } catch {
    try {
      sessionStorage.setItem(KEY, String(now));
    } catch {
      /* تجاهل */
    }
  }
}
/** كم باقي من التجربة (0 = خلصت أو ما بدت) */
export function demoLeft(now = Date.now()): number {
  const s = read();
  return s ? Math.max(0, s + DEMO_MS - now) : 0;
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
