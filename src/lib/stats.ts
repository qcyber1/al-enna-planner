/** إحصائيات مسار البيع الداخلية — مجهولة: رقم عشوائي للمتصفح بس، بدون اسم أو جوال */
import { landingSite } from './license';

export type FunnelEvent = 'visit' | 'trial_start' | 'trial_end' | 'export_blocked' | 'demo_buy_click' | 'checkout_click';

export function statsSid(): string {
  try {
    let s = localStorage.getItem('enna.sid');
    if (!s || s.length < 8) {
      s = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('enna.sid', s);
    }
    return s;
  } catch {
    return '';
  }
}

export function track(e: FunnelEvent): void {
  if (import.meta.env.DEV && !import.meta.env.VITEST) return;
  const sid = statsSid();
  if (!sid) return;
  // المنتج حسب صفحة البيع اللي جا منها (/izba = عزبة)
  const body = JSON.stringify({ e, sid, p: landingSite() });
  try {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon?.('/api/track', blob)) return;
  } catch {
    /* نكمل بالطريقة الثانية */
  }
  try {
    void fetch('/api/track', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch {
    /* تجاهل */
  }
}
