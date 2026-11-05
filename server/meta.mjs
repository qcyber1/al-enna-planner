// Meta Conversions API: نرسل الشراء من السيرفر لميتا (يوصل حتى لو العميل عنده مانع إعلانات أو آيفون مقفل فيه التتبع)
// الإعداد في Railway: META_CAPI_TOKEN (إلزامي للتشغيل)، META_PIXEL_ID (افتراضي بكسل مخطط العنة)، META_TEST_EVENT_CODE (اختياري للاختبار)
import crypto from 'node:crypto';

const PIXEL_ID = process.env.META_PIXEL_ID || '29329924966644106';
const TOKEN = process.env.META_CAPI_TOKEN || '';
const TEST_CODE = process.env.META_TEST_EVENT_CODE || '';
const GRAPH = (process.env.META_GRAPH_URL || 'https://graph.facebook.com').replace(/\/$/, '');
export const capiEnabled = !!TOKEN;

const sha = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');

/** بيانات العميل اللي تساعد ميتا تطابقه (كلها مشفّرة SHA-256 حسب شروط ميتا ما عدا IP والمتصفح والكوكيز) */
export function userData({ email, phone, name, ip, ua, fbp, fbc }) {
  const u = { country: [sha('qa')] };
  if (email && !/@i3enna\.qa$/i.test(email)) u.em = [sha(email)];
  if (phone) u.ph = [sha(String(phone).replace(/\D/g, ''))];
  const first = String(name || '').trim().split(/\s+/)[0];
  if (first) u.fn = [sha(first)];
  if (ip) u.client_ip_address = ip;
  if (ua) u.client_user_agent = String(ua).slice(0, 400);
  if (fbp) u.fbp = fbp;
  if (fbc) u.fbc = fbc;
  return u;
}

/**
 * يرسل حدث لميتا. ما يوقف أي شي لو فشل (ما يأثر على الدفع أبداً) — بس يسجل الخطأ.
 * eventId لازم يكون نفس eventID في البكسل عشان ميتا تحسبه مرة وحدة.
 */
export async function sendEvent({ name, eventId, value, url, user }) {
  if (!TOKEN) return { skipped: true };
  const body = {
    data: [
      {
        event_name: name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: url || 'https://www.i3enna.qa/',
        user_data: user,
        custom_data: { currency: 'QAR', value: Number(value) || 0, content_name: 'Al Enna Planner — lifetime', content_type: 'product' },
      },
    ],
  };
  if (TEST_CODE) body.test_event_code = TEST_CODE;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${GRAPH}/v19.0/${encodeURIComponent(PIXEL_ID)}/events?access_token=${encodeURIComponent(TOKEN)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      console.error('[meta capi]', name, r.status, j?.error?.message || '');
      return { ok: false, status: r.status };
    }
    return { ok: true };
  } catch (e) {
    console.error('[meta capi]', name, e.message);
    return { ok: false };
  }
}

/** يقرأ كوكيز البكسل (_fbp/_fbc) من الطلب */
export function metaCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === '_fbp' || k === '_fbc') out[k.slice(1)] = v.join('=').slice(0, 200);
  }
  return out;
}
