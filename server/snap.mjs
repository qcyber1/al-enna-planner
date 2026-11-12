// Snapchat Conversions API: نرسل الشراء وبدء الدفع من السيرفر لسناب (مثل ميتا بالضبط)
// الإعداد في Railway: SNAP_CAPI_TOKEN (إلزامي للتشغيل)، SNAP_PIXEL_ID (افتراضي بكسل i3enna)، SNAP_TEST=1 للتجربة (يرسل لرابط التحقق بس)
import crypto from 'node:crypto';

const PIXEL_ID = process.env.SNAP_PIXEL_ID || '63105547-dd58-4b4d-ab27-10e2f401b043'; // رقم البكسل عام (يطلع في الصفحة)، التوكن هو السري
const TOKEN = process.env.SNAP_CAPI_TOKEN || '';
const TEST = process.env.SNAP_TEST === '1';
const BASE = (process.env.SNAP_API_URL || 'https://tr.snapchat.com').replace(/\/$/, '');
export const snapEnabled = !!(TOKEN && PIXEL_ID);
export const snapPixelId = PIXEL_ID;

const ITEM = { enna: 'i3enna-lifetime', izba: 'i3enna-izba-lifetime' };
const sha = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');

/** بيانات العميل لسناب: الإيميل والجوال مشفّرين SHA-256، والباقي مثل ما هو */
export function snapUser({ email, phone, ip, ua, scid, sccid }) {
  const u = {};
  if (email && !/@i3enna\.qa$/i.test(email)) u.em = [sha(email)];
  let ph = String(phone || '').replace(/\D/g, '');
  if (ph.length === 8) ph = '974' + ph; // أرقام قطر بدون مفتاح الدولة
  if (ph) u.ph = [sha(ph)];
  if (ua) u.client_user_agent = String(ua).slice(0, 400);
  if (ip) u.client_ip_address = ip;
  if (sccid) u.sc_click_id = sccid;
  if (scid) u.sc_cookie1 = scid;
  return u;
}

/** يبني الحدث بنفس شكل سناب (يتجرّب بدون شبكة) */
export function snapPayload({ name, eventId, value, url, user, product, now = Date.now() }) {
  const p = product === 'izba' ? 'izba' : 'enna';
  return {
    data: [
      {
        event_name: name,
        event_id: eventId, // نفس client_dedup_id في البكسل → سناب يحسبها مرة وحدة
        action_source: 'website',
        event_source_url: url || (p === 'izba' ? 'https://www.i3enna.qa/izba' : 'https://www.i3enna.qa/'),
        event_time: Math.floor(now / 1000),
        user_data: user,
        custom_data: {
          value: Number(value) || 0,
          currency: 'QAR',
          content_ids: [ITEM[p]],
          content_category: [p === 'izba' ? 'izba-planner' : 'camp-planner'],
          num_items: 1,
          order_id: eventId,
        },
      },
    ],
  };
}

/** يرسل لسناب. ما يوقف أي شي لو فشل (ما يأثر على الدفع أبداً) — بس يسجل الخطأ */
export async function sendSnap(ev) {
  if (!snapEnabled) return { skipped: true };
  const body = snapPayload(ev);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${BASE}/v3/${encodeURIComponent(PIXEL_ID)}/events${TEST ? '/validate' : ''}?access_token=${encodeURIComponent(TOKEN)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const txt = await r.text().catch(() => '');
    if (!r.ok) {
      console.error('[snap capi]', ev.name, r.status, txt.slice(0, 300));
      return { ok: false, status: r.status };
    }
    if (TEST) console.log('[snap capi test]', ev.name, txt.slice(0, 300));
    return { ok: true };
  } catch (e) {
    console.error('[snap capi]', ev.name, e.message);
    return { ok: false };
  }
}

/** كوكيز سناب: _scid (من بكسل سناب) و _sccid (رقم الضغطة على الإعلان ScCid — نحفظه نحن من الرابط) */
export function snapCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === '_scid') out.scid = decodeURIComponent(v.join('=')).slice(0, 200);
    if (k === '_sccid') out.sccid = decodeURIComponent(v.join('=')).slice(0, 200);
  }
  return out;
}
