// خصم «وصل الدفع وما كمّل»: السيرفر يعطي توكن موقّع (مربوط بالرقم) — نحفظه في المتصفح لين ينتهي
export interface Rescue {
  token: string;
  price: number;
  exp: number;
  product: 'enna' | 'izba';
}
const KEY = 'enna.rescue';

/** يقرأ السعر والانتهاء والمنتج من التوكن نفسه (السيرفر هو اللي يتحقق من التوقيع وقت الدفع) */
export function parseRescue(token: string): Rescue | null {
  const m = /^[0-9a-f]{8,32}\.(\d{10,15})\.(\d{1,6})\.(enna|izba)\.[\w-]{22}$/.exec(String(token || ''));
  if (!m) return null;
  return { token, exp: Number(m[1]), price: Number(m[2]), product: m[3] as Rescue['product'] };
}

export function getRescue(now = Date.now()): Rescue | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null') as Rescue | null;
    if (!r || typeof r.token !== 'string' || !(r.exp > now) || !(r.price > 0)) return null;
    return r;
  } catch {
    return null;
  }
}

export function saveRescue(r: Partial<Rescue> | null | undefined): Rescue | null {
  const x = r?.token ? parseRescue(r.token) : null;
  if (!x || !(x.exp > Date.now())) return null;
  try {
    localStorage.setItem(KEY, JSON.stringify(x));
  } catch {
    /* تجاهل */
  }
  return x;
}

export function clearRescue() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* تجاهل */
  }
}
