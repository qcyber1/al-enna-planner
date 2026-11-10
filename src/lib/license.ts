// المنتجات اللي اشتراها العميل (عنة / عزبة) — من رد السيرفر عند الدخول والتحقق
// العزبة منتج مستقل: تنفتح لصاحب ترخيص العزبة، أو خلال التجربة المجانية من صفحة العزبة.
import { isDemo } from './demo';

export type Product = 'enna' | 'izba';
const KEY = 'enna.products';
const DEMO_SITE = 'enna.demo.site';
const DEV = 'enna.izba';
const TOKEN = 'enna.license.token';

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* تجاهل */
    }
  },
};

export function saveProducts(list: unknown) {
  const arr = Array.isArray(list) ? list.filter((x): x is Product => x === 'enna' || x === 'izba') : [];
  ls.set(KEY, arr.length ? JSON.stringify(arr) : null);
}

export function getProducts(): Product[] {
  try {
    const v = JSON.parse(ls.get(KEY) || '[]');
    if (Array.isArray(v) && v.length) return v;
  } catch {
    /* تجاهل */
  }
  // عميل قديم مسجّل قبل هالتحديث: ترخيصه عنة
  return ls.get(TOKEN) ? ['enna'] : [];
}

/** صفحة البيع اللي فتحها الزائر: /izba = العزبة */
export function landingSite(): Product {
  try {
    return window.location.pathname.replace(/\/+$/, '').endsWith('/izba') ? 'izba' : 'enna';
  } catch {
    return 'enna';
  }
}

/** نحفظ إن التجربة المجانية بدأت من صفحة العزبة */
export function markDemoSite(site: Product) {
  ls.set(DEMO_SITE, site);
}
export function demoSite(): Product {
  return ls.get(DEMO_SITE) === 'izba' ? 'izba' : 'enna';
}

// رابط المعاينة القديم (?izba=1) انشال: العزبة صارت مدفوعة — الفريق ياخذ كود عزبة مجاني من الأدمن
ls.set(DEV, null);

/** العزبة مطلقة للعملاء؟ (من /api/status — الأدمن يشغّلها). قبل الإطلاق ما تطلع لأحد إلا صاحب كود عزبة */
let live = false;
export function setIzbaLive(v: unknown) {
  live = v === true;
}
export const izbaLive = () => live;

/**
 * وصول العزبة:
 * - full: اشترى العزبة، أو في التجربة المجانية من صفحة العزبة، أو الموقع بدون تراخيص
 * - locked: يقدر يشوفها ويرقّي، بس ما يستخدمها (بعد الإطلاق)
 * - hidden: قبل الإطلاق — ما تطلع له أبداً
 */
export function izbaAccess(): 'full' | 'locked' | 'hidden' {
  if (ls.get(TOKEN) === 'open') return 'full';
  if (getProducts().includes('izba')) return 'full';
  if (isDemo() && demoSite() === 'izba') return 'full';
  return live ? 'locked' : 'hidden';
}

/** يطلع له تبويب العزبة؟ */
export const izbaVisible = () => izbaAccess() !== 'hidden';
