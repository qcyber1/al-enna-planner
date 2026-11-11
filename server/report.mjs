// التقرير اليومي / لأي فترة: المبيعات، التجارب، مسار البيع، اللي ما كمّلوا الدفع، والمقارنة بالفترة اللي قبلها
import { FUNNEL_EVENTS, qaDay } from './funnel.mjs';

const DAY = 86400000;
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
/** بداية يوم قطر بالـ UTC */
const dayStart = (d) => Date.parse(d + 'T00:00:00+03:00');

/** قائمة الأيام من..إلى (بتوقيت قطر) */
export function dayList(from, to) {
  const out = [];
  for (let t = dayStart(from); t <= dayStart(to) && out.length < 400; t += DAY) out.push(qaDay(t));
  return out;
}

/** يتحقق من الفترة: الافتراضي اليوم، وأقصى شي 366 يوم */
export function parseRange(fromIn, toIn, now = Date.now()) {
  const today = qaDay(now);
  let to = isDay(toIn) ? toIn : today;
  let from = isDay(fromIn) ? fromIn : to;
  if (from > to) [from, to] = [to, from];
  if (to > today) to = today;
  if (from > to) from = to;
  if ((dayStart(to) - dayStart(from)) / DAY > 365) from = qaDay(dayStart(to) - 365 * DAY);
  return { from, to };
}

const prodOf = (o) => (o.product === 'izba' ? 'izba' : 'enna');

function periodStats(db, days) {
  const set = new Set(days);
  // مسار البيع (أشخاص مختلفين كل يوم)
  const funnel = { enna: {}, izba: {} };
  for (const p of ['enna', 'izba']) for (const e of FUNNEL_EVENTS) funnel[p][e] = 0;
  const perDay = Object.fromEntries(days.map((d) => [d, { day: d, visit: 0, trial_start: 0, trial_end: 0, checkout_click: 0, purchase: 0, revenue: 0, attempts: 0 }]));
  for (const d of days) {
    const f = db.funnel?.[d] || {};
    for (const e of FUNNEL_EVENTS) {
      const a = (f[e] || []).length;
      const b = (f['izba:' + e] || []).length;
      funnel.enna[e] += a;
      funnel.izba[e] += b;
      if (e in perDay[d]) perDay[d][e] += a + b;
    }
  }
  // المبيعات المدفوعة (بتاريخ الدفع) — بدون طلبات التجربة من اللوحة
  const sales = [];
  for (const o of db.orders || []) {
    if (o.test || o.status !== 'paid') continue;
    const d = qaDay(o.paidAt || o.createdAt || 0);
    if (!set.has(d)) continue;
    sales.push({ no: o.no ? 'EN-' + o.no : '', at: o.paidAt || o.createdAt, name: o.name || '', phone: o.phone || '', product: prodOf(o), amount: Number(o.amount) || 0, method: o.online ? 'online' : 'manual', offer: !!o.offer, ref: !!o.ref, upgrade: !!o.upgradeOf });
    perDay[d].purchase++;
    perDay[d].revenue += Number(o.amount) || 0;
  }
  // أكواد يدوية مدفوعة (هدايا ودفع خارج الموقع) — اللي ما لها طلب
  const ordered = new Set((db.orders || []).map((o) => o.codeId).filter(Boolean));
  for (const c of Object.values(db.codes || {})) {
    if (c.test || ordered.has(c.id) || !(Number(c.price) > 0)) continue;
    const d = qaDay(c.createdAt || 0);
    if (!set.has(d)) continue;
    const prods = Array.isArray(c.products) ? c.products : ['enna'];
    sales.push({ no: '', at: c.createdAt, name: c.name || '', phone: c.phone || '', product: prods.includes('izba') ? 'izba' : 'enna', amount: Number(c.price) || 0, method: 'code', offer: false, ref: false, upgrade: false });
    perDay[d].purchase++;
    perDay[d].revenue += Number(c.price) || 0;
  }
  sales.sort((a, b) => a.at - b.at);
  // حاولوا يدفعون وما كمّلوا (مجمّعين حسب الرقم، وبدون اللي دفع بعدين)
  const paidPhones = new Set((db.orders || []).filter((o) => o.status === 'paid').map((o) => String(o.phone || '').replace(/\D/g, '')));
  const lostMap = new Map();
  for (const o of db.orders || []) {
    if (o.test || o.status === 'paid') continue;
    const d = qaDay(o.createdAt || 0);
    if (!set.has(d)) continue;
    perDay[d].attempts++;
    const k = String(o.phone || '').replace(/\D/g, '');
    if (!k || paidPhones.has(k)) continue;
    const x = lostMap.get(k) || { name: o.name || '', phone: o.phone || '', product: prodOf(o), tries: 0, last: 0, reason: '' };
    x.tries++;
    if ((o.createdAt || 0) > x.last) x.last = o.createdAt || 0;
    if (!x.reason) x.reason = o.lastError ? 'رفضه نظام الدفع' : o.status === 'pending' ? 'فتح صفحة الدفع وما كمّل' : o.status === 'cancelled' ? 'ملغي' : 'طلب ينتظر رابط الدفع';
    lostMap.set(k, x);
  }
  const lost = [...lostMap.values()].sort((a, b) => b.last - a.last);

  const revenue = sales.reduce((t, s) => t + s.amount, 0);
  const sum = (k) => funnel.enna[k] + funnel.izba[k];
  return {
    funnel,
    visits: sum('visit'),
    trials: sum('trial_start'),
    trialsEnded: sum('trial_end'),
    exportBlocked: sum('export_blocked'),
    buyClicks: sum('demo_buy_click'),
    checkoutClicks: sum('checkout_click'),
    sales,
    purchases: sales.length,
    revenue,
    revenueBy: {
      enna: sales.filter((s) => s.product === 'enna').reduce((t, s) => t + s.amount, 0),
      izba: sales.filter((s) => s.product === 'izba').reduce((t, s) => t + s.amount, 0),
    },
    avgOrder: sales.length ? Math.round(revenue / sales.length) : 0,
    offerSales: sales.filter((s) => s.offer).length,
    refSales: sales.filter((s) => s.ref).length,
    lost,
    perDay: days.map((d) => perDay[d]),
    feedback: (db.feedback || []).filter((f) => set.has(qaDay(f.at || 0))).length,
    referralsOwed: (db.referrals || []).filter((r) => !r.paidOut && set.has(qaDay(r.at || r.createdAt || 0))).reduce((t, r) => t + (Number(r.reward) || 0), 0),
  };
}

/** التقرير كامل: الفترة + نفس الطول قبلها للمقارنة */
/** عمولة سكيب كاش لعملية وحدة (الدفع الإلكتروني بس) */
export const feeOf = (s, fee) => (s.method === 'online' && fee ? Math.round(((s.amount * (fee.pct || 0)) / 100 + (s.amount > 0 ? fee.fixed || 0 : 0)) * 100) / 100 : 0);

export function buildReport(db, fromIn, toIn, now = Date.now(), fee = { pct: 0, fixed: 0 }) {
  const { from, to } = parseRange(fromIn, toIn, now);
  const days = dayList(from, to);
  const prevTo = qaDay(dayStart(from) - DAY);
  const prevFrom = qaDay(dayStart(from) - days.length * DAY);
  const cur = periodStats(db, days);
  for (const s of cur.sales) {
    s.fee = feeOf(s, fee);
    s.net = Math.round((s.amount - s.fee) * 100) / 100;
  }
  const fees = Math.round(cur.sales.reduce((t, s) => t + s.fee, 0) * 100) / 100;
  const prev = periodStats(db, dayList(prevFrom, prevTo));
  return {
    from,
    to,
    days: days.length,
    generatedAt: now,
    funnelKeptDays: 90,
    ...cur,
    fee,
    fees,
    net: Math.round((cur.revenue - fees) * 100) / 100,
    onlineRevenue: cur.sales.filter((s) => s.method === 'online').reduce((t, s) => t + s.amount, 0),
    prev: { from: prevFrom, to: prevTo, visits: prev.visits, trials: prev.trials, purchases: prev.purchases, revenue: prev.revenue },
    totals: allTime(db),
  };
}

/** من البداية لين اليوم: كل المبيعات (طلبات مدفوعة + أكواد يدوية مدفوعة) وعدد العملاء */
function allTime(db) {
  const paid = (db.orders || []).filter((o) => !o.test && o.status === 'paid');
  const ordered = new Set((db.orders || []).map((o) => o.codeId).filter(Boolean));
  const manual = Object.values(db.codes || {}).filter((c) => !c.test && !ordered.has(c.id) && Number(c.price) > 0);
  const codes = Object.values(db.codes || {});
  return {
    revenue: paid.reduce((t, o) => t + (Number(o.amount) || 0), 0) + manual.reduce((t, c) => t + (Number(c.price) || 0), 0),
    sales: paid.length + manual.length,
    customers: codes.filter((c) => !c.revoked).length,
    activated: codes.filter((c) => (c.devices || []).length).length,
  };
}
