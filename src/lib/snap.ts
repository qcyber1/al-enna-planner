/** Snap Pixel (إعلانات سناب شات): الكود الأساسي في index.html — هنا الأحداث. الشراء يتأكد من السيرفر بعد (Conversions API) */
type Snaptr = (cmd: string, ...args: unknown[]) => void;
const w = globalThis as unknown as { snaptr?: Snaptr };
const snap = (): Snaptr | null => (typeof w.snaptr === 'function' ? w.snaptr : null);
const ITEM = { enna: 'i3enna-lifetime', izba: 'i3enna-izba-lifetime' } as const;

/** رقم الضغطة على إعلان سناب (ScCid) نحفظه كوكي عشان السيرفر يرسله مع الشراء */
export function saveSnapClick() {
  try {
    const id = new URLSearchParams(window.location.search).get('ScCid');
    if (id && /^[\w-]{6,200}$/.test(id)) document.cookie = `_sccid=${encodeURIComponent(id)}; Max-Age=${60 * 60 * 24 * 28}; Path=/; SameSite=Lax; Secure`;
  } catch {
    /* تجاهل */
  }
}

/** ضغط «ادفع» ووصل صفحة الدفع */
export function snapCheckout(value: number, orderId?: string, product: 'enna' | 'izba' = 'enna') {
  snap()?.('track', 'START_CHECKOUT', { price: value, currency: 'QAR', item_ids: [ITEM[product]], ...(orderId ? { client_dedup_id: 'chk-' + orderId } : {}) });
}
/** بعد نجاح الدفع فقط — رقم الطلب يمنع التكرار (ونفسه يرسله السيرفر) */
export function snapPurchase(orderRef: string, value: number, product: 'enna' | 'izba' = 'enna') {
  snap()?.('track', 'PURCHASE', { price: value, currency: 'QAR', item_ids: [ITEM[product]], number_items: 1, transaction_id: orderRef, client_dedup_id: orderRef });
}
export function snapTrial() {
  snap()?.('track', 'START_TRIAL', {});
}
