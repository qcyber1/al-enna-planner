/** Meta Pixel (إعلانات فيسبوك/إنستقرام): أحداث البيع الأساسية */
type Fbq = (cmd: 'track' | 'trackCustom', event: string, params?: Record<string, unknown>, opts?: { eventID?: string }) => void;
const fbq = (): Fbq | null => {
  const f = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof f === 'function' ? f : null;
};

/** ضغط «ادفع الآن» */
export function trackCheckout(value: number, orderId?: string) {
  // نفس رقم الحدث اللي يرسله السيرفر (Conversions API) عشان ميتا تحسبه مرة وحدة
  fbq()?.('track', 'InitiateCheckout', { value, currency: 'QAR', content_name: 'Al Enna Planner — lifetime' }, orderId ? { eventID: 'chk-' + orderId } : undefined);
}

/** بدأ التجربة المجانية */
export function trackTrial() {
  fbq()?.('track', 'StartTrial', { value: 0, currency: 'QAR', predicted_ltv: 0 });
}

/** اشترى فعلاً — مرة وحدة لكل طلب حتى لو حدّث الصفحة (eventID يمنع التكرار عند ميتا بعد) */
export function trackPurchase(orderRef: string, value: number) {
  const key = `enna.px.purchase.${orderRef}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch {
    /* تجاهل */
  }
  fbq()?.('track', 'Purchase', { value, currency: 'QAR', content_name: 'Al Enna Planner — lifetime', content_type: 'product' }, { eventID: orderRef });
}
