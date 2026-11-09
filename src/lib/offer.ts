// عرض «خلصت التجربة»: السيرفر يعطي عرض موقّع بوقت محدود، ونحفظه في المتصفح لين ينتهي
export interface TrialOffer {
  token: string;
  price: number;
  exp: number;
}
const KEY = 'enna.offer';

export function getOffer(now = Date.now()): TrialOffer | null {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null') as TrialOffer | null;
    if (!o || typeof o.token !== 'string' || !(o.exp > now) || !(o.price > 0)) return null;
    return o;
  } catch {
    return null;
  }
}

/** نطلب العرض مرة وحدة (لو عنده عرض شغال نرجعه) */
export async function claimOffer(): Promise<TrialOffer | null> {
  const cur = getOffer();
  if (cur) return cur;
  try {
    if (localStorage.getItem(KEY)) return null; // أخذ عرض قبل وخلص — ما نعطيه ثاني
  } catch {
    /* تجاهل */
  }
  try {
    const r = await fetch('/api/offer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const d = (await r.json()) as { ok?: boolean } & Partial<TrialOffer>;
    if (!d.ok || !d.token || !d.price || !d.exp) return null;
    const o = { token: d.token, price: d.price, exp: d.exp };
    localStorage.setItem(KEY, JSON.stringify(o));
    return o;
  } catch {
    return null;
  }
}

/** المتبقي بصيغة دقائق:ثواني */
export function leftLabel(exp: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((exp - now) / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
