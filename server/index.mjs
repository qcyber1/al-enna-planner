// خادم مخطط العنة: يقدم التطبيق + نظام أكواد الشراء + لوحة الإدارة
// بدون أي مكتبات خارجية (Node.js فقط)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { adminPage } from './admin.mjs';
import { validateBuyer, parsePhone } from './buyer.mjs';
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
// الأسعار: من لوحة الإدارة (محفوظة في البيانات) وإلا من متغيرات Railway
if (!db.settings) db.settings = {};
const envNum = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' && Number.isFinite(Number(process.env[k])) ? Number(process.env[k]) : d);
const setNum = (k, d) => (Number.isFinite(db.settings[k]) ? db.settings[k] : d);
const price = () => setNum('price', envNum('PRICE', 349));
const refDiscount = () => setNum('refDiscount', envNum('REF_DISCOUNT', 50));
const refReward = () => setNum('refReward', envNum('REF_REWARD', 50));
/** «السعر قبل الخصم» للعروض العامة (يطلع مشطوب) — 0 يعني ما في عرض */
const listPrice = () => setNum('listPrice', 0);
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
  if (rec.revoked) return { ok: false, error: 'هذا الكود موقوف — تواصل معنا' };
  if (!rec.devices.find((d) => d.id === device)) {
    if (rec.devices.length >= MAX_DEVICES)
      return { ok: false, error: `هذا الكود مفعّل على ${MAX_DEVICES} أجهزة (الحد الأقصى) — تواصل معنا ونفكّه لك` };
    rec.devices.push({ id: device, at: Date.now() });
    if (!rec.activatedAt) rec.activatedAt = Date.now();
    saveDb();
  }
  return { ok: true, rec };
}

// ——— الدخول برقم الجوال وكلمة المرور (بديل الكود على الأجهزة الثانية) ———
function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  return salt.toString('base64url') + ':' + crypto.scryptSync(String(pw), salt, 32).toString('base64url');
}
function checkPw(pw, stored) {
  const [salt, h] = String(stored || '').split(':');
  if (!salt || !h) return false;
  const a = crypto.scryptSync(String(pw), Buffer.from(salt, 'base64url'), 32);
  const b = Buffer.from(h, 'base64url');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function pwError(pw) {
  const s = String(pw ?? '');
  if (s.length < 6) return 'كلمة المرور 6 أحرف أو أرقام على الأقل';
  if (s.length > 100) return 'كلمة المرور طويلة وايد';
  return null;
}
const normPhone = (ph) => parsePhone(ph).phone || null;
/** نسخة العميل للوحة الإدارة بدون كلمة المرور */
const publicRec = (r) => {
  const { pw, ...rest } = r;
  return { ...rest, hasPw: !!pw };
};

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
  return refId ? Math.max(0, price() - refDiscount()) : price();
}

/** يعلّم الطلب مدفوعاً ويولّد كود العميل (مرة واحدة فقط) */
function markPaid(o) {
  if (o.codeId) {
    o.status = 'paid';
    return;
  }
  const { id: cid, code } = makeCode();
  const amount = o.amount ?? price();
  db.codes[cid] = { id: cid, code, name: o.name, phone: o.phone, note: (o.online ? 'دفع إلكتروني (سكيب كاش)' : 'طلب من الموقع') + (o.ref ? ' • بإحالة' : ''), price: amount, createdAt: Date.now(), devices: [], revoked: false, ref: o.ref };
  o.codeId = cid;
  o.status = 'paid';
  o.paidAt = Date.now();
  if (o.ref && o.ref !== cid && !db.referrals.some((r) => r.orderId === o.id)) {
    db.referrals.push({ refId: o.ref, orderId: o.id, buyer: o.name, at: Date.now(), reward: refReward(), paidOut: false });
  }
  saveDb();
}

// ——— حماية بسيطة من التخمين ———
const attempts = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, a] of attempts) if (!a.some((t) => now - t < 10 * 60 * 1000)) attempts.delete(k);
}, 10 * 60 * 1000).unref();
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
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};
function serveStatic(req, res, urlPath) {
  let file = path.normalize(path.join(DIST, decodeURIComponent(urlPath)));
  if (!file.startsWith(DIST)) return send(res, 403, { error: 'forbidden' });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const ext = path.extname(file);
  const immutable = urlPath.startsWith('/assets/');
  const headers = {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    vary: 'Accept-Encoding',
  };
  // ضغط الملفات النصية (JS/CSS/HTML...) — يقلل التحميل الأول تقريباً للربع على الجوال
  const accept = String(req.headers['accept-encoding'] || '');
  const enc = !COMPRESSIBLE.has(ext) ? null : /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
  if (enc) {
    const body = compressed(file, enc);
    if (body) {
      res.writeHead(200, { ...headers, 'content-encoding': enc, 'content-length': body.length });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
  }
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json', '.webmanifest', '.txt']);
const zcache = new Map();
/** نسخة مضغوطة من الملف (محفوظة في الذاكرة ومربوطة بوقت التعديل) */
function compressed(file, enc) {
  try {
    const st = fs.statSync(file);
    const key = `${enc}:${file}`;
    const hit = zcache.get(key);
    if (hit && hit.mtime === st.mtimeMs) return hit.body;
    const raw = fs.readFileSync(file);
    const body =
      enc === 'br'
        ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } })
        : zlib.gzipSync(raw, { level: 9 });
    zcache.set(key, { mtime: st.mtimeMs, body });
    return body;
  } catch {
    return null;
  }
}

// ——— الخادم ———
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  // آخر عنوان في x-forwarded-for هو اللي أضافه بروكسي Railway (الأول ممكن العميل يزوّره)
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',').pop().trim();
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('content-security-policy', "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  if (req.headers['x-forwarded-proto'] === 'https') res.setHeader('strict-transport-security', 'max-age=31536000');

  try {
    if (p === '/api/status') {
      const refId = parseRef(url.searchParams.get('ref'));
      return send(res, 200, { licensing: LICENSING, price: priceFor(refId), basePrice: Math.max(price(), listPrice()), sale: !refId && listPrice() > price(), refValid: !!refId, refDiscount: refDiscount(), online: skipcashEnabled && LICENSING });
    }

    // رابط الإحالة الخاص بالعميل وإحصائياته
    if (p === '/api/myref' && req.method === 'POST') {
      if (!LICENSING) return send(res, 400, { ok: false });
      const t = readToken((await readBody(req)).token);
      if (!t) return send(res, 401, { ok: false, error: 'سجّل دخولك بالكود أولاً' });
      const mine = db.referrals.filter((r) => r.refId === t.c);
      return send(res, 200, { ok: true, ref: refFor(t.c), discount: refDiscount(), reward: refReward(), count: mine.length, earned: mine.reduce((s, r) => s + r.reward, 0), price: priceFor(t.c) });
    }

    // ——— الدفع الإلكتروني (سكيب كاش) ———
    if (p === '/api/checkout' && req.method === 'POST') {
      if (!skipcashEnabled || !LICENSING) return send(res, 400, { ok: false, error: 'الدفع الإلكتروني غير مفعّل' });
      if (limited(ip)) return send(res, 429, { ok: false, error: 'محاولات كثيرة — حاول بعد عشر دقائق' });
      const { name, phone, email, ref } = await readBody(req);
      const refId = parseRef(ref);
      const v = validateBuyer({ name, phone, email }, true);
      if (v.errors) return send(res, 400, { ok: false, error: Object.values(v.errors)[0], errors: v.errors });
      const nm = v.name;
      const full = v.phone;
      const em = v.email;
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
        });
        order.paymentId = pay.paymentId;
        db.orders.unshift(order);
        saveDb();
        return send(res, 200, { ok: true, payUrl: pay.payUrl, orderId: order.id });
      } catch (e) {
        console.error('[skipcash]', e.message);
        return send(res, 502, { ok: false, error: 'ما قدرنا نفتح صفحة الدفع الحين — حاول بعد شوي' });
      }
    }

    if (p === '/api/checkout/verify' && req.method === 'POST') {
      const { paymentId, orderId } = await readBody(req);
      const o = db.orders.find((x) => (orderId && x.id === orderId) || (paymentId && x.paymentId === paymentId));
      if (!o) return send(res, 404, { ok: false, error: 'ما لقينا الطلب' });
      let failed = false;
      if (o.status !== 'paid') {
        try {
          const st = await getPayment(o.paymentId || paymentId);
          o.skipcashStatus = st.statusId;
          o.lastCheck = Date.now();
          delete o.lastError;
          if (st.paid) markPaid(o);
          else if (st.failed) failed = true;
        } catch (e) {
          o.lastError = String(e.message).slice(0, 200);
          console.error('[skipcash verify]', e.message);
        }
        saveDb();
      }
      if (failed) return send(res, 200, { ok: false, failed: true, error: 'الدفع ما تم (انلغى أو انرفضت البطاقة) — ما انخصم شي، جرّب مرة ثانية' });
      if (o.status !== 'paid') return send(res, 200, { ok: false, pending: true, error: 'الدفع ما اكتمل للحين' });
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
      const v = validateBuyer({ name, phone }, false);
      if (v.errors) return send(res, 400, { ok: false, error: Object.values(v.errors)[0], errors: v.errors });
      const full = v.phone;
      db.orders.unshift({ id: crypto.randomBytes(6).toString('hex'), name: v.name, phone: full.slice(0, 20), createdAt: Date.now(), status: 'new', ref: refId || undefined, amount: priceFor(refId) });
      db.orders = db.orders.slice(0, 2000);
      saveDb();
      return send(res, 200, { ok: true });
    }

    if (p === '/api/activate' && req.method === 'POST') {
      if (!LICENSING) return send(res, 200, { ok: true, token: 'open' });
      if (limited(ip)) return send(res, 429, { ok: false, error: 'محاولات كثيرة — حاول بعد عشر دقائق' });
      const { code, device } = await readBody(req);
      const id = parseCode(code);
      if (!id) return send(res, 400, { ok: false, error: 'الكود غلط — تأكد إنك كتبته مثل ما وصلك بالضبط' });
      if (!device || String(device).length > 80) return send(res, 400, { ok: false, error: 'الطلب ناقص — حدّث الصفحة وحاول مرة ثانية' });
      const r = bindDevice(id, String(device));
      if (!r.ok) return send(res, 403, r);
      return send(res, 200, { ok: true, token: makeToken(id, String(device)), name: r.rec.name || '', hasPw: !!r.rec.pw, phone: r.rec.phone || '' });
    }

    if (p === '/api/login' && req.method === 'POST') {
      if (!LICENSING) return send(res, 200, { ok: true, token: 'open' });
      if (limited(ip)) return send(res, 429, { ok: false, error: 'محاولات كثيرة — حاول بعد عشر دقائق' });
      const { phone, password, device } = await readBody(req);
      const ph = parsePhone(phone);
      if (ph.error) return send(res, 400, { ok: false, errors: { phone: ph.error } });
      if (!password) return send(res, 400, { ok: false, errors: { password: 'اكتب كلمة المرور' } });
      if (!device || String(device).length > 80) return send(res, 400, { ok: false, error: 'الطلب ناقص — حدّث الصفحة وحاول مرة ثانية' });
      if (limited('ph:' + ph.phone)) return send(res, 429, { ok: false, error: 'محاولات كثيرة على هالرقم — حاول بعد عشر دقائق' });
      const rec = Object.values(db.codes).find((r) => r.pw && normPhone(r.phone) === ph.phone && checkPw(password, r.pw));
      if (!rec) return send(res, 401, { ok: false, errors: { password: 'الرقم أو كلمة المرور غلط — إذا أول مرة ادخل بالكود' } });
      const r = bindDevice(rec.id, String(device));
      if (!r.ok) return send(res, 403, r);
      return send(res, 200, { ok: true, token: makeToken(rec.id, String(device)), name: rec.name || '' });
    }

    if (p === '/api/account/password' && req.method === 'POST') {
      if (!LICENSING) return send(res, 400, { ok: false });
      if (limited(ip)) return send(res, 429, { ok: false, error: 'محاولات كثيرة — حاول بعد عشر دقائق' });
      const { token, phone, password } = await readBody(req);
      const t = readToken(token);
      if (!t || !db.codes[t.c] || db.codes[t.c].revoked) return send(res, 401, { ok: false, error: 'سجّل دخول من جديد' });
      const errors = {};
      const ph = parsePhone(phone);
      if (ph.error) errors.phone = ph.error;
      const pe = pwError(password);
      if (pe) errors.password = pe;
      if (Object.keys(errors).length) return send(res, 400, { ok: false, errors });
      const rec = db.codes[t.c];
      rec.phone = ph.phone;
      rec.pw = hashPw(password);
      rec.pwAt = Date.now();
      saveDb();
      return send(res, 200, { ok: true, phone: ph.phone });
    }

    if (p === '/api/check' && req.method === 'POST') {
      if (!LICENSING) return send(res, 200, { ok: true });
      const { token } = await readBody(req);
      const t = readToken(token);
      if (!t) return send(res, 401, { ok: false, error: 'انتهت صلاحية الدخول — أدخل الكود مرة أخرى' });
      const r = bindDevice(t.c, t.d);
      if (!r.ok) return send(res, 403, r);
      return send(res, 200, { ok: true, name: r.rec.name || '', hasPw: !!r.rec.pw, phone: r.rec.phone || '' });
    }

    // ——— الإدارة ———
    if (p === '/admin' || p.startsWith('/api/admin/')) {
      if (!ADMIN_PASSWORD) return send(res, 503, '<h1 dir="rtl">لوحة الإدارة معطلة: اضبط ADMIN_PASSWORD في Railway</h1>');
      // تخمين كلمة مرور الإدارة: بعد 20 محاولة غلط يتقفل العنوان 10 دقائق (حتى لو الكلمة صح)
      const admTries = (attempts.get('adm:' + ip) || []).filter((t) => Date.now() - t < 10 * 60 * 1000).length;
      if (admTries >= 20) return send(res, 429, 'محاولات كثيرة — حاول بعد عشر دقائق');
      if (!isAdmin(req)) {
        if (req.headers.authorization) limited('adm:' + ip);
        return send(res, 401, { error: 'unauthorized' }, { 'www-authenticate': 'Basic realm="enna-admin", charset="UTF-8"' });
      }
      if (p === '/admin') return send(res, 200, adminPage({ skipcash: skipcashEnabled ? skipcashEnv : '', licensing: LICENSING, maxDevices: MAX_DEVICES, persistent: DATA_DIR === '/data' || !!process.env.DATA_DIR }));
      if (p === '/api/admin/list') {
        const list = Object.values(db.codes).sort((a, b) => b.createdAt - a.createdAt).map(publicRec);
        return send(res, 200, { list, orders: db.orders, referrals: db.referrals, paymentLink: PAYMENT_LINK, price: price(), refReward: refReward(), settings: { price: price(), listPrice: listPrice(), refDiscount: refDiscount(), refReward: refReward() } });
      }
      if (p === '/api/admin/settings' && req.method === 'POST') {
        const b = await readBody(req);
        const num = (v, min, max) => {
          const n = Math.round(Number(v));
          return Number.isFinite(n) && n >= min && n <= max ? n : null;
        };
        const next = { price: num(b.price, 1, 100000), listPrice: num(b.listPrice ?? 0, 0, 100000), refDiscount: num(b.refDiscount, 0, 100000), refReward: num(b.refReward, 0, 100000) };
        if (next.price === null || next.listPrice === null || next.refDiscount === null || next.refReward === null)
          return send(res, 400, { error: 'تأكد من الأرقام (السعر 1 أو أكثر)' });
        if (next.refDiscount >= next.price) return send(res, 400, { error: 'خصم الإحالة لازم يكون أقل من السعر' });
        db.settings = next;
        saveDb();
        return send(res, 200, { ok: true, settings: next });
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
        if (action === 'resetpw') delete rec.pw;
        saveDb();
        return send(res, 200, { ok: true, rec: publicRec(rec) });
      }
      return send(res, 404, { error: 'not found' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method' });
    return serveStatic(req, res, p);
  } catch (e) {
    console.error(e);
    return send(res, 500, { ok: false, error: 'صار خطأ عندنا — حاول بعد شوي' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`[enna] يعمل على المنفذ ${PORT} — البيانات في ${DATA_DIR}`));
