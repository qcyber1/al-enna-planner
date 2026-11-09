/** Snap Pixel (إعلانات سناب شات): يشتغل بس إذا السيرفر عنده SNAP_PIXEL_ID. الشراء يتأكد من السيرفر بعد (Conversions API) */
type Snaptr = ((cmd: string, ...args: unknown[]) => void) & { queue?: unknown[]; handleRequest?: unknown };
const w = globalThis as unknown as { snaptr?: Snaptr };
const snap = (): Snaptr | null => (typeof w.snaptr === 'function' ? w.snaptr : null);

/** رقم الضغطة على إعلان سناب (ScCid) نحفظه كوكي عشان السيرفر يرسله مع الشراء */
export function saveSnapClick() {
  try {
    const id = new URLSearchParams(window.location.search).get('ScCid');
    if (id && /^[\w-]{6,200}$/.test(id)) document.cookie = `_sccid=${encodeURIComponent(id)}; Max-Age=${60 * 60 * 24 * 28}; Path=/; SameSite=Lax; Secure`;
  } catch {
    /* تجاهل */
  }
}

/** يحمّل البكسل (مرة وحدة) */
export async function initSnap() {
  saveSnapClick();
  if (snap()) return;
  try {
    const s = (await (await fetch('/api/status')).json()) as { snapPixel?: string };
    const id = s.snapPixel;
    if (!id || !/^[\w-]{8,64}$/.test(id)) return;
    const q: Snaptr = ((...a: unknown[]) => {
      q.queue!.push(a);
    }) as Snaptr;
    q.queue = [];
    w.snaptr = q;
    const el = document.createElement('script');
    el.async = true;
    el.src = 'https://sc-static.net/scevent.min.js';
    document.head.appendChild(el);
    q('init', id, {});
    q('track', 'PAGE_VIEW');
  } catch {
    /* تجاهل */
  }
}

export function snapCheckout(value: number, orderId?: string, product: 'enna' | 'izba' = 'enna') {
  snap()?.('track', 'START_CHECKOUT', { price: value, currency: 'QAR', item_ids: [product], ...(orderId ? { client_dedup_id: 'chk-' + orderId } : {}) });
}
export function snapPurchase(orderRef: string, value: number, product: 'enna' | 'izba' = 'enna') {
  snap()?.('track', 'PURCHASE', { price: value, currency: 'QAR', item_ids: [product], transaction_id: orderRef, client_dedup_id: orderRef });
}
export function snapTrial() {
  snap()?.('track', 'START_TRIAL', {});
}
