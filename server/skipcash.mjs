// ربط بوابة الدفع سكيب كاش (SkipCash) — الإعدادات من متغيرات البيئة في Railway
import crypto from 'node:crypto';

const ENV = process.env.SKIPCASH_ENV === 'production' ? 'production' : 'sandbox';
const BASE = ENV === 'production' ? 'https://api.skipcash.app' : 'https://skipcashtest.azurewebsites.net';
const CLIENT_ID = process.env.SKIPCASH_CLIENT_ID || '';
const KEY_ID = process.env.SKIPCASH_KEY_ID || '';
const KEY_SECRET = process.env.SKIPCASH_KEY_SECRET || '';
const WEBHOOK_KEY = process.env.SKIPCASH_WEBHOOK_KEY || '';

export const skipcashEnabled = !!(CLIENT_ID && KEY_ID && KEY_SECRET);
export const skipcashEnv = ENV;

const sign = (data, key) => crypto.createHmac('sha256', key).update(data).digest('base64');

/** ينشئ عملية دفع ويعيد رابط صفحة الدفع */
export async function createPayment({ uid, amount, firstName, lastName, phone, email, transactionId, custom1 }) {
  const fields = [
    ['Uid', uid],
    ['KeyId', KEY_ID],
    ['Amount', Number(amount).toFixed(2)],
    ['FirstName', firstName],
    ['LastName', lastName],
    ['Phone', phone],
    ['Email', email],
    ['TransactionId', transactionId],
    ['Custom1', custom1],
  ].filter(([, v]) => v !== undefined && v !== null && String(v) !== '');
  const signature = sign(fields.map(([k, v]) => `${k}=${v}`).join(','), KEY_SECRET);
  const body = Object.fromEntries(fields);
  const r = await fetch(`${BASE}/api/v1/payments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json;charset=UTF-8', authorization: signature },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  const payUrl = j?.resultObj?.payUrl;
  const paymentId = j?.resultObj?.id;
  if (!r.ok || !payUrl) throw new Error(j?.errorMessage || `SkipCash ${r.status}`);
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
  return {
    paid: Number(o.statusId) === 2 || String(o.status || '').toLowerCase() === 'paid',
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
