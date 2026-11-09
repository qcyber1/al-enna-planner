/** Meta Pixel (إعلانات فيسبوك/إنستقرام): أحداث البيع الأساسية — وكل حدث ينحسب بعد في «مسار البيع» باللوحة */
import { track } from './stats';
import { snapCheckout, snapPurchase, snapTrial } from './snap';
type Fbq = (cmd: 'track' | 'trackCustom' | 'init', event: string, params?: Record<string, unknown>, opts?: { eventID?: string }) => void;
export const PIXEL_ID = '29329924966644106';
const fbq = (): Fbq | null => {
  const f = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof f === 'function' ? f : null;
};

/** ضغط «ادفع الآن» */
const NAME = { enna: 'Al Enna Planner — lifetime', izba: 'i3enna Izba — lifetime' } as const;

export function trackCheckout(value: number, orderId?: string, product: 'enna' | 'izba' = 'enna') {
  // نفس رقم الحدث اللي يرسله السيرفر (Conversions API) عشان ميتا تحسبه مرة وحدة
  snapCheckout(value, orderId, product);
  fbq()?.('track', 'InitiateCheckout', { value, currency: 'QAR', content_name: NAME[product], content_ids: [product] }, orderId ? { eventID: 'chk-' + orderId } : undefined);
}

/** بدأ التجربة المجانية */
export function trackTrial() {
  track('trial_start');
  snapTrial();
  fbq()?.('track', 'StartTrial', { value: 0, currency: 'QAR', predicted_ltv: 0 });
}

/** اشترى فعلاً — مرة وحدة لكل طلب حتى لو حدّث الصفحة (eventID يمنع التكرار عند ميتا بعد) */
export function trackPurchase(orderRef: string, value: number, product: 'enna' | 'izba' = 'enna') {
  const key = `enna.px.purchase.${orderRef}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch {
    /* تجاهل */
  }
  snapPurchase(orderRef, value, product);
  fbq()?.('track', 'Purchase', { value, currency: 'QAR', content_name: NAME[product], content_type: 'product', content_ids: [product] }, { eventID: orderRef });
}

/**
 * المطابقة المتقدمة: لما العميل يكتب بياناته في نموذج الدفع نعطيها للبكسل
 * (البكسل يشفّرها SHA-256 بنفسه قبل ما ترسل) — ترفع «جودة المطابقة» في ميتا.
 */
export function setBuyer({ phone, email, name }: { phone?: string; email?: string; name?: string }) {
  const ud: Record<string, string> = { country: 'qa' };
  const ph = String(phone || '').replace(/\D/g, '');
  if (ph) ud.ph = ph.length === 8 ? '974' + ph : ph;
  const em = String(email || '').trim().toLowerCase();
  if (em.includes('@')) ud.em = em;
  const fn = String(name || '').trim().split(/\s+/)[0];
  if (fn) ud.fn = fn.toLowerCase();
  fbq()?.('init', PIXEL_ID, ud);
}

/** خلصت التجربة المجانية (للجمهور: جرّبوا وما اشتروا) */
export function trackTrialEnded() {
  track('trial_end');
  fbq()?.('trackCustom', 'TrialEnded');
}

/** حاول يصدّر صورة/تقرير وهو في التجربة — أقوى مؤشر إنه يبي يشتري */
export function trackExportBlocked(what: string) {
  track('export_blocked');
  fbq()?.('trackCustom', 'ExportBlocked', { what });
}

/** ضغط «اشترِ الآن» من شريط التجربة */
export function trackDemoBuyClick() {
  track('demo_buy_click');
  fbq()?.('trackCustom', 'DemoBuyClick');
}
