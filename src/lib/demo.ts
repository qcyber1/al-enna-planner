/** تجربة مجانية بدون تسجيل: 10 دقائق، والتصدير بعد الشراء */
const KEY = 'enna.demo.start';
export const DEMO_MS = 10 * 60 * 1000;

const read = (): number => {
  try {
    return Number(sessionStorage.getItem(KEY) || 0);
  } catch {
    return 0;
  }
};
export function startDemo() {
  try {
    if (!read()) sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* تجاهل */
  }
}
export function endDemo() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* تجاهل */
  }
}
/** كم باقي من التجربة (0 = خلصت أو ما بدت) */
export function demoLeft(): number {
  const s = read();
  return s ? Math.max(0, s + DEMO_MS - Date.now()) : 0;
}
let active = false;
export const isDemo = () => active;
export const setDemoActive = (v: boolean) => {
  active = v;
};
