// خادم مخطط العنة: يقدم التطبيق + نظام أكواد الشراء + لوحة الإدارة
// بدون أي مكتبات خارجية (Node.js فقط)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { adminPage } from './admin.mjs';
import { createPayment, getPayment, verifyWebhook, skipcashEnabled, skipcashEnv } from './skipcash.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 4173);
const SECRET = process.env.LICENSE_SECRET || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const MAX_DEVICES = Math.max(1, Number(process.env.MAX_DEVICES || 3));
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(ROOT, 'data'));
const DATA_FILE = path.join(DATA_DIR, 'licenses.json');
const LICENSING = SECRET.length >= 16;

if (!LICENSING) console.warn('[enna] LICENSE_SECRET غير مضبوط (16 حرفاً على الأقل) — الحماية معطلة والتطبيق مفتوح للجميع');
if (!ADMIN_PASSWORD) console.warn('[enna] ADMIN_PASSWORD غير مضبوط — لوحة الإدارة معطلة');

// ——— التخزين (ملف JSON؛ يُفضّل ربط Volume على /data في Railway) ———
function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { codes: {}, orders: [] };
  }
}
let db = loadDb();
if (!db.orders) db.orders = [];
const PRICE = Number(process.env.PRICE || 349);
const REF_DISCOUNT = Number(process.env.REF_DISCOUNT || 50);
const REF_REWARD = Number(process.env.REF_REWARD || 50);
if (!db.referrals) db.referrals = [];
const PAYMENT_LINK = process.env.PAYMENT_LINK || '';
function saveDb() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(db, null, 2));
    fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
  } catch (e) {
    console.error('[enna] تعذر حفظ البيانات', e.message);
  }
}

// ——— الأكواد الموقّعة: صالحة حتى لو ضاعت البيانات ———
const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function b32(buf) {
  let bits = 0, val = 0, out = '';
  for (const byte of buf) {
    val = (val << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}
const hmac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest();
function makeCode() {
  const id = b32(crypto.randomBytes(5));
  const sig = b32(hmac('code:' + id).subarray(0, 5));
  const raw = id + sig;
  return { id, code: `ENNA-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}` };
}
function parseCode(input) {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^ENNA/, '');
  if (raw.length !== 16) return null;
  const id = raw.slice(0, 8);
  const sig = raw.slice(8);
  const expect = b32(hmac('code:' + id).subarray(0, 5));
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  return id;
}
function makeToken(id, device) {
  const body = Buffer.from(JSON.stringify({ c: id, d: device, t: Date.now() })).toString('base64url');
  return body + '.' + hmac('tok:' + body).toString('base64url');
}
function readToken(tok) {
  const [body, sig] = String(tok || '').split('.');
  if (!body || !sig) return null;
  const expect = hmac('tok:' + body).toString('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
}
function recordFor(id) {
  if (!db.codes[id]) db.codes[id] = { id, name: '', phone: '', note: '', createdAt: Date.now(), devices: [], revoked: false, recovered: true };
  return db.codes[id];
}
/** يسجل الجهاز على الكود ضمن الحد المسموح */
function bindDevice(id, device) {
  const rec = recordFor(id);
  if (rec.revoked) return { ok: false, error: 'هذا الكود موقوف — تواصل مع البائع' };
  if (!rec.devices.find((d) => d.id === device)) {
    if (rec.devices.length >= MAX_DEVICES)
      return { ok: false, error: `هذا الكود مستخدم على ${MAX_DEVICES} أجهزة (الحد الأقصى) — تواصل مع البائع لإعادة التعيين` };
    rec.devices.push({ id: device, at: Date.now() });
    if (!rec.activatedAt) rec.activatedAt = Date.now();
    saveDb();
  }
  return { ok: true, rec };
}

// ——— الإحالات: رابط خاص لكل عميل يعطي صديقه خصماً ويكسب مكافأة ———
function refFor(id) {
  return id + b32(hmac('ref:' + id).subarray(0, 3)).slice(0, 4);
}
function parseRef(ref) {
  const r = String(ref || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!LICENSING || r.length !== 12) return null;
  const id = r.slice(0, 8);
  if (refFor(id) !== r) return null;
  if (db.codes[id]?.revoked) return null;
  return id;
}
function priceFor(refId) {
  return refId ? Math.max(0, PRICE - REF_DISCOUNT) : PRICE;
}

/** يعلّم الطلب مدفوعاً ويولّد كود العميل (مرة واحدة فقط) */
function markPaid(o) {
  if (o.codeId) {
    o.status = 'paid';
    return;
  }
  const { id: cid, code } = makeCode();
  const amount = o.amount ?? PRICE;
  db.codes[cid] = { id: cid, code, name: o.name, phone: o.phone, note: (o.online ? 'دفع إلكتروني (سكيب كاش)' : 'طلب من الموقع') + (o.ref ? ' • بإحالة' : ''), price: amount, createdAt: Date.now(), devices: [], revoked: false, ref: o.ref };
  o.codeId = cid;
  o.status = 'paid';
  o.paidAt = Date.now();
  if (o.ref && o.ref !== cid && !db.referrals.some((r) => r.orderId === o.id)) {
    db.referrals.push({ refId: o.ref, orderId: o.id, buyer: o.name, at: Date.now(), reward: REF_REWARD, paidOut: false });
  }
  saveDb();
}

// ——— حماية بسيطة من التخمين ———
const attempts = new Map();
function limited(ip) {
  const now = Date.now();
  const a = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  a.push(now);
  attempts.set(ip, a);
  return a.length > 20;
}

// ——— أدوات HTTP ———
function send(res, status, data, headers = {}) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, {
    'content-type': typeof data === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => {
      s += c;
      if (s.length > 1e5) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(s || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const [, pass] = Buffer.from(h.slice(6), 'base64').toString().split(':');
  const a = Buffer.from(String(pass || ''));
  const b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
};
function serveStatic(req, res, urlPath) {
  let file = path.normalize(path.join(DIST, decodeURIComponent(urlPath)));
  if (!file.startsWith(DIST)) return send(res, 403, { error: 'forbidden' });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const ext = path.extname(file);
  const immutable = urlPath.startsWith('/assets/');
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

// ——— الخادم ———
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

  try {
    if (p === '/api/status') {
      const refId = parseRef(url.searchParams.get('ref'));
      return send(res, 200, { licensing: LICENSING, price: priceFor(refId), basePrice: PRICE, refValid: !!refId, refDiscount: REF_DISCOUNT, online: skipcashEnabled && LICENSING });
    }

    // رابط الإحالة الخاص بالعميل وإحصائياته
    if (p === '/api/myref' && req.method === 'POST') {
      if (!LICENSING) return send(res, 400, { ok: false });
      const t = readToken((await readBody(req)).token);
      if (!t) return send(res, 401, { ok: false, error: 'سجّل دخولك بالكود أولاً' });
      const mine = db.referrals.filter((r) => r.refId === t.c);
      return send(res, 200, { ok: true, ref: refFor(t.c), discount: REF_DISCOUNT, reward: REF_REWARD, count: mine.length, earned: mine.reduce((s, r) => s + r.reward, 0), price: priceFor(t.c) });
    }

    // ——— الدفع الإلكتروني (سكيب كاش) ———
    if (p === '/api/checkout' && req.method === 'POST') {
      if (!skipcashEnabled || !LICENSING) return send(res, 400, { ok: false, error: 'الدفع الإلكتروني غير مفعّل' });
      if (limited(ip)) return send(res, 429, { ok: false, error: 'محاولات كثيرة — حاول بعد عشر دقائق' });
      const { name, phone, email, ref } = await readBody(req);
      const refId = parseRef(ref);
      const nm = String(name || '').trim().slice(0, 60);
      const ph = String(phone || '').replace(/\D/g, '');
      const em = String(email || '').trim().slice(0, 100);
      if (!nm || ph.length < 8 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))
        return send(res, 400, { ok: false, error: 'اكتب الاسم ورقم الجوال والإيميل بشكل صحيح' });
      const full = ph.length === 8 ? '974' + ph : ph;
      const parts = nm.split(/\s+/);
      const order = { id: crypto.randomBytes(8).toString('hex'), name: nm, phone: full, email: em, createdAt: Date.now(), status: 'pending', online: true, ref: refId || undefined, amount: priceFor(refId) };
      try {
        const pay = await createPayment({
          uid: crypto.randomUUID(),
          amount: order.amount,
          firstName: parts[0],
          lastName: parts.slice(1).join(' ') || parts[0],
          phone: full,
          email: em,
          transactionId: order.id,
          custom1: order.id,
        });
        order.paymentId = pay.paymentId;
        db.orders.unshift(order);
        saveDb();
        return send(res, 200, { ok: true, payUrl: pay.payUrl, orderId: order.id });
      } catch (e) {
        console.error('[skipcash]', e.message);
        return send(res, 502, { ok: false, error: 'تعذر فتح صفحة الدفع الآن — حاول بعد قليل' });
      }
    }

    if (p === '/api/checkout/verify' && req.method === 'POST') {
      const { paymentId, orderId } = await readBody(req);
      const o = db.orders.find((x) => (orderId && x.id === orderId) || (paymentId && x.paymentId === paymentId));
      if (!o) return send(res, 404, { ok: false, error: 'لم يتم العثور على الطلب' });
      if (o.status !== 'paid') {
        try {
          const st = await getPayment(o.paymentId || paymentId);
          if (st.paid) markPaid(o);
        } catch (e) {
          console.error('[skipcash verify]', e.message);
        }
      }
      if (o.status !== 'paid') return send(res, 200, { ok: false, pending: true, error: 'لم يكتمل الدفع بعد' });
      return send(res, 200, { ok: true, code: db.codes[o.codeId]?.code });
    }

    if (p === '/api/skipcash/webhook' && req.method === 'POST') {
      const body = await readBody(req);
      if (!verifyWebhook(body, req.headers.authorization)) return send(res, 401, { ok: false });
      const o = db.orders.find((x) => x.id === body.Custom1 || x.id === body.TransactionId || x.paymentId === body.PaymentId);
      if (o && Number(body.StatusId) === 2) markPaid(o);
      return send(res, 200, { ok: true });
    }

    if (p === '/api/order' && req.method === 'POST') {
      if (limited(ip)) return send(res, 429, { ok: false, error: 'محاولات كثيرة — حاول بعد عشر دقائق' });
      const { name, phone, ref } = await readBody(req);
      const refId = parseRef(ref);
      const ph = String(phone || '').replace(/\D/g, '');
      if (!String(name || '').trim() || ph.length < 8) return send(res, 400, { ok: false, error: 'اكتب الاسم ورقم الجوال بشكل صحيح' });
      const full = ph.length === 8 ? '974' + ph : ph;
      db.orders.unshift({ id: crypto.randomBytes(6).toString('hex'), name: String(name).trim().slice(0, 80), phone: full.slice(0, 20), createdAt: Date.now(), status: 'new', ref: refId || undefined, amount: priceFor(refId) });
      db.orders = db.orders.slice(0, 2000);
      saveDb();
      return send(res, 200, { ok: true });
    }

    if (p === '/api/activate' && req.method === 'POST') {
      if (!LICENSING) return send(res, 200, { ok: true, token: 'open' });
      if (limited(ip)) return send(res, 429, { ok: false, error: 'محاولات كثيرة — حاول بعد عشر دقائق' });
      const { code, device } = await readBody(req);
      const id = parseCode(code);
      if (!id) return send(res, 400, { ok: false, error: 'الكود غير صحيح — تأكد من كتابته كما وصلك' });
      if (!device || String(device).length > 80) return send(res, 400, { ok: false, error: 'طلب غير صالح' });
      const r = bindDevice(id, String(device));
      if (!r.ok) return send(res, 403, r);
      return send(res, 200, { ok: true, token: makeToken(id, String(device)), name: r.rec.name || '' });
    }

    if (p === '/api/check' && req.method === 'POST') {
      if (!LICENSING) return send(res, 200, { ok: true });
      const { token } = await readBody(req);
      const t = readToken(token);
      if (!t) return send(res, 401, { ok: false, error: 'انتهت صلاحية الدخول — أدخل الكود مرة أخرى' });
      const r = bindDevice(t.c, t.d);
      if (!r.ok) return send(res, 403, r);
      return send(res, 200, { ok: true, name: r.rec.name || '' });
    }

    // ——— الإدارة ———
    if (p === '/admin' || p.startsWith('/api/admin/')) {
      if (!ADMIN_PASSWORD) return send(res, 503, '<h1 dir="rtl">لوحة الإدارة معطلة: اضبط ADMIN_PASSWORD في Railway</h1>');
      if (!isAdmin(req))
        return send(res, 401, { error: 'unauthorized' }, { 'www-authenticate': 'Basic realm="enna-admin", charset="UTF-8"' });
      if (p === '/admin') return send(res, 200, adminPage({ skipcash: skipcashEnabled ? skipcashEnv : '', licensing: LICENSING, maxDevices: MAX_DEVICES, persistent: DATA_DIR === '/data' || !!process.env.DATA_DIR }));
      if (p === '/api/admin/list') {
        const list = Object.values(db.codes).sort((a, b) => b.createdAt - a.createdAt);
        return send(res, 200, { list, orders: db.orders, referrals: db.referrals, paymentLink: PAYMENT_LINK, price: PRICE, refReward: REF_REWARD });
      }
      if (p === '/api/admin/referral' && req.method === 'POST') {
        const { refId, paidOut } = await readBody(req);
        for (const r of db.referrals) if (r.refId === refId && !r.paidOut && paidOut) r.paidOut = true, r.paidOutAt = Date.now();
        saveDb();
        return send(res, 200, { ok: true });
      }
      if (p === '/api/admin/order' && req.method === 'POST') {
        const { id, status } = await readBody(req);
        const o = db.orders.find((x) => x.id === id);
        if (!o) return send(res, 404, { error: 'غير موجود' });
        if (status === 'check' && o.paymentId && skipcashEnabled) {
          try {
            if ((await getPayment(o.paymentId)).paid) markPaid(o);
          } catch (e) {
            console.error('[skipcash check]', e.message);
          }
        } else if (['new', 'sent', 'paid', 'cancelled'].includes(status) && o.status !== 'paid') o.status = status;
        if (status === 'paid' && LICENSING) markPaid(o);
        saveDb();
        return send(res, 200, { ok: true, order: o, code: o.codeId ? db.codes[o.codeId] : null });
      }
      if (p === '/api/admin/create' && req.method === 'POST') {
        if (!LICENSING) return send(res, 400, { error: 'اضبط LICENSE_SECRET أولاً' });
        const body = await readBody(req);
        const count = Math.min(50, Math.max(1, Number(body.count) || 1));
        const out = [];
        for (let i = 0; i < count; i++) {
          const { id, code } = makeCode();
          db.codes[id] = {
            id,
            code,
            name: String(body.name || '').slice(0, 80),
            phone: String(body.phone || '').slice(0, 30),
            note: String(body.note || '').slice(0, 200),
            price: Number(body.price) || 0,
            createdAt: Date.now(),
            devices: [],
            revoked: false,
          };
          out.push(db.codes[id]);
        }
        saveDb();
        return send(res, 200, { created: out });
      }
      if (p === '/api/admin/update' && req.method === 'POST') {
        const { id, action } = await readBody(req);
        const rec = db.codes[id];
        if (!rec) return send(res, 404, { error: 'غير موجود' });
        if (action === 'revoke') rec.revoked = true;
        if (action === 'restore') rec.revoked = false;
        if (action === 'reset') rec.devices = [];
        saveDb();
        return send(res, 200, { ok: true, rec });
      }
      return send(res, 404, { error: 'not found' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method' });
    return serveStatic(req, res, p);
  } catch (e) {
    console.error(e);
    return send(res, 500, { ok: false, error: 'خطأ في الخادم' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`[enna] يعمل على المنفذ ${PORT} — البيانات في ${DATA_DIR}`));
