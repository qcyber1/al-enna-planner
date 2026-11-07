// مسار البيع: عدّادات يومية مجهولة الهوية (معرّف عشوائي للمتصفح بس — بدون اسم أو جوال أو IP)
import crypto from 'node:crypto';

export const FUNNEL_EVENTS = ['visit', 'trial_start', 'trial_end', 'export_blocked', 'demo_buy_click', 'checkout_click'];
const KEEP_DAYS = 90;
// تاريخ اليوم بتوقيت قطر (UTC+3) عشان «اليوم» يطابق يومك
export const qaDay = (t = Date.now()) => new Date(t + 3 * 3600 * 1000).toISOString().slice(0, 10);
const hashSid = (sid) => crypto.createHash('sha256').update('funnel:' + sid).digest('base64url').slice(0, 12);

/** يسجّل حدث مرة وحدة لكل متصفح في اليوم (عدد أشخاص، مو عدد ضغطات) */
export function recordEvent(db, event, sid, now = Date.now()) {
  if (!FUNNEL_EVENTS.includes(event)) return false;
  const s = String(sid || '');
  if (s.length < 8 || s.length > 64) return false;
  if (!db.funnel) db.funnel = {};
  const day = qaDay(now);
  const d = (db.funnel[day] ??= {});
  const seen = (d[event] ??= []);
  const h = hashSid(s);
  if (seen.includes(h)) return false;
  seen.push(h);
  // نمسح الأيام القديمة
  const days = Object.keys(db.funnel).sort();
  for (const old of days.slice(0, Math.max(0, days.length - KEEP_DAYS))) delete db.funnel[old];
  return true;
}

/** ملخص لعدد أيام: عدد كل خطوة + بدء الدفع والمبيعات والإيراد من الطلبات الحقيقية (بدون التجارب) */
export function funnelSummary(db, days = 7, now = Date.now()) {
  const list = [];
  for (let i = days - 1; i >= 0; i--) list.push(qaDay(now - i * 86400000));
  const set = new Set(list);
  const rows = list.map((day) => {
    const f = db.funnel?.[day] || {};
    const r = { day };
    for (const e of FUNNEL_EVENTS) r[e] = (f[e] || []).length;
    r.checkout = 0;
    r.purchase = 0;
    r.revenue = 0;
    return r;
  });
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
  for (const o of db.orders || []) {
    if (o.test || !o.online) continue;
    const cd = qaDay(o.createdAt || 0);
    if (set.has(cd) && o.paymentId) byDay[cd].checkout++;
    if (o.status === 'paid' && o.paidAt) {
      const pd = qaDay(o.paidAt);
      if (set.has(pd)) {
        byDay[pd].purchase++;
        byDay[pd].revenue += Number(o.amount) || 0;
      }
    }
  }
  const total = { day: 'total' };
  for (const k of [...FUNNEL_EVENTS, 'checkout', 'purchase', 'revenue']) total[k] = rows.reduce((s, r) => s + r[k], 0);
  return { days: rows, total };
}
