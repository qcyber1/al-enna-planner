// ربط بوابة الدفع سكيب كاش (SkipCash) — الإعدادات من متغيرات البيئة في Railway
import crypto from 'node:crypto';

const ENV = process.env.SKIPCASH_ENV === 'production' ? 'production' : 'sandbox';
// SKIPCASH_BASE_URL اختياري (للاختبارات فقط)
const BASE = (process.env.SKIPCASH_BASE_URL || (ENV === 'production' ? 'https://api.skipcash.app' : 'https://skipcashtest.azurewebsites.net')).replace(/\/$/, '');
const CLIENT_ID = process.env.SKIPCASH_CLIENT_ID || '';
const KEY_ID = process.env.SKIPCASH_KEY_ID || '';
const KEY_SECRET = process.env.SKIPCASH_KEY_SECRET || '';
const WEBHOOK_KEY = process.env.SKIPCASH_WEBHOOK_KEY || '';

export const skipcashEnabled = !!(CLIENT_ID && KEY_ID && KEY_SECRET);
export const skipcashEnv = ENV;

const sign = (data, key) => crypto.createHmac('sha256', key).update(data).digest('base64');

/**
 * ينشئ عملية دفع ويعيد رابط صفحة الدفع.
 * مطابق لإضافة سكيب كاش الرسمية (WooCommerce): الحقول في الطلب بأسماء camelCase،
 * والتوقيع = HMAC-SHA256 (base64) لنص "Uid=..,KeyId=..,Amount=..,..." بنفس الترتيب
 * مع أول حرف كبير، بمفتاح Key Secret.
 */
export async function createPayment({ uid, amount, firstName, lastName, phone, email, transactionId }) {
  const fields = [
    ['uid', uid],
    ['keyId', KEY_ID],
    ['amount', Number(amount).toFixed(2)],
    ['firstName', String(firstName || '').slice(0, 59)],
    ['lastName', String(lastName || '').slice(0, 59)],
    ['phone', String(phone || '').slice(0, 15)],
    ['email', String(email || '').slice(0, 255)],
    ['transactionId', transactionId],
  ].filter(([, v]) => v !== undefined && v !== null && String(v) !== '');
  const signature = sign(fields.map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1)}=${v}`).join(','), KEY_SECRET);
  const body = Object.fromEntries(fields);
  const r = await fetch(`${BASE}/api/v1/payments`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', authorization: signature },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  const paymentId = j?.resultObj?.id;
  // بعض الردود فيها payUrl، والإضافة الرسمية تبني الرابط من الـ id
  const payUrl = j?.resultObj?.payUrl || (paymentId ? `${BASE}/pay/${paymentId}` : '');
  if (!r.ok || !paymentId) throw new Error(j?.errorMessage || `SkipCash ${r.status}`);
  return { payUrl, paymentId };
}

/** يستعلم عن حالة الدفع مباشرة من سكيب كاش (statusId 2 = مدفوع) */
export async function getPayment(paymentId) {
  const r = await fetch(`${BASE}/api/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { authorization: CLIENT_ID },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.errorMessage || `SkipCash ${r.status}`);
  const o = j?.resultObj || {};
  const statusId = Number(o.statusId);
  return {
    statusId,
    paid: statusId === 2 || String(o.status || '').toLowerCase() === 'paid',
    // 3 ملغي، 4 فشل، 5 مرفوض (حسب حالات سكيب كاش)
    failed: [3, 4, 5].includes(statusId),
    transactionId: o.transactionId,
    amount: Number(o.amount),
  };
}

/** التحقق من توقيع إشعار الدفع (Webhook) */
export function verifyWebhook(body, header) {
  if (!WEBHOOK_KEY) return false;
  const fields = ['PaymentId', 'Amount', 'StatusId', 'TransactionId', 'Custom1', 'VisaId']
    .filter((k) => body[k] !== undefined && body[k] !== null && String(body[k]) !== '')
    .map((k) => `${k}=${body[k]}`)
    .join(',');
  const expect = sign(fields, WEBHOOK_KEY);
  const a = Buffer.from(String(header || ''));
  const b = Buffer.from(expect);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
