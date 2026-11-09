// خادم مخطط العنة: يقدم التطبيق + نظام أكواد الشراء + لوحة الإدارة
// بدون أي مكتبات خارجية (Node.js فقط)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { adminPage, adminLoginPage } from './admin.mjs';
import { privacyPage } from './privacy.mjs';
import { recordEvent, funnelSummary } from './funnel.mjs';
import { validateBuyer, parsePhone } from './buyer.mjs';
import { safeJoin, readBody as readBodyRaw } from './http-utils.mjs';
import { sendEvent, userData, metaCookies, capiEnabled } from './meta.mjs';
import { loadDbFile, latestBackup, writeDbFile, dailyBackup } from './datastore.mjs';
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
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
function loadDb() {
  const r = loadDbFile(DATA_FILE);
  if (r.db) return r.db;
  // الملف الأساسي خربان: نرجع لآخر نسخة احتياطية سليمة
  const b = latestBackup(BACKUP_DIR);
  if (b) console.error('[enna] رجعنا للنسخة الاحتياطية', b.file);
  return b ? b.db : { codes: {}, orders: [] };
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
// أرقام طلبات متسلسلة وواضحة للعميل (EN-1001، EN-1002…)
if (!Number.isFinite(db.orderSeq)) db.orderSeq = 1000;
const nextOrderNo = () => ++db.orderSeq;
const orderRef = (o) => (o.no ? `EN-${o.no}` : String(o.id).slice(0, 8).toUpperCase());
if (!db.feedback) db.feedback = [];
if (!db.content) db.content = {};
// نصوص صفحة الدخول اللي تتعدل من اللوحة (فاضي = النص الافتراضي)
const CONTENT_KEYS = { banner: 120, title: 40, tagline: 140, f1: 40, f2: 40, f3: 40, f4: 40, buyNote: 160, support: 20, sellerAddress: 160, sellerCR: 30 };
const cleanText = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const PAYMENT_LINK = process.env.PAYMENT_LINK || '';
let lastBackupDay = '';
// أحداث مسار البيع كثيرة: نجمع الحفظ كل 5 ثواني بدل كل طلب
let saveTimer = null;
function saveDbSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveDb();
  }, 5000);
  saveTimer.unref?.();
}
function saveDb() {
  try {
    writeDbFile(DATA_FILE, db);
    // نسخة احتياطية يومية (أول حفظ في كل يوم) — آخر 14 يوم في /data/backups
    const day = new Date().toISOString().slice(0, 10);
    if (day !== lastBackupDay && dailyBackup(DATA_FILE, BACKUP_DIR)) lastBackupDay = day;
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
// الكود الجديد: ENNA-XXXX-XXXX-XXXX (12 حرف: 6 للمعرّف + 6 توقيع ≈ 30 بت — مع حد المحاولات ما ينخمّن)
// الأكواد القديمة (16 حرف) تظل شغالة. الحروف بدون O/0/I/1 عشان ما تتلخبط.
const sig6 = (id) => b32(hmac('code2:' + id).subarray(0, 4)).slice(0, 6);
function makeCode() {
  let id;
  do id = b32(crypto.randomBytes(4)).slice(0, 6);
  while (db.codes[id]);
  const raw = id + sig6(id);
  return { id, code: `ENNA-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}` };
}
function parseCode(input) {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^ENNA/, '');
  let id, sig, expect;
  if (raw.length === 12) {
    id = raw.slice(0, 6);
    sig = raw.slice(6);
    expect = sig6(id);
  } else if (raw.length === 16) {
    // الشكل القديم
    id = raw.slice(0, 8);
    sig = raw.slice(8);
    expect = b32(hmac('code:' + id).subarray(0, 5));
  } else return null;
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  return id;
}
// «جيل» الدخول: تصفير الأجهزة من اللوحة يرفع الرقم، فكل الدخولات القديمة تبطل (الدخولات قبل هالميزة = جيل 0)
const epochOf = (id) => db.codes[id]?.epoch || 0;
function makeToken(id, device) {
  const body = Buffer.from(JSON.stringify({ c: id, d: device, t: Date.now(), e: epochOf(id) })).toString('base64url');
  return body + '.' + hmac('tok:' + body).toString('base64url');
}
function readToken(tok) {
  const t = readTokenSig(tok);
  if (!t) return null;
  // دخول من جيل قديم (قبل تصفير الأجهزة) ما يعتبر
  if ((t.e || 0) !== epochOf(t.c)) return null;
  return t;
}
function readTokenSig(tok) {
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
  // رابط الإحالة = المعرّف (6 للأكواد الجديدة أو 8 للقديمة) + 4 حروف توقيع
  if (!LICENSING || (r.length !== 10 && r.length !== 12)) return null;
  const id = r.slice(0, r.length - 4);
  if (refFor(id) !== r) return null;
  if (db.codes[id]?.revoked) return null;
  return id;
}
function priceFor(refId) {
  return refId ? Math.max(0, price() - refDiscount()) : price();
}

/**
 * قبل ما نعتبر الطلب مدفوع: الدفعة اللي رجعت من سكيب كاش لازم تكون لنفس الطلب وبمبلغ ما يقل عن المطلوب.
 * (المبلغ الأعلى أو بصيغة ثانية ما يوقف البيع — نوقف بس لو أقل، ونحفظ اللي رجع للمراجعة)
 */
function paymentProblem(o, st) {
  if (st.transactionId && String(st.transactionId) !== String(o.id)) return 'رقم العملية من سكيب كاش ما يطابق الطلب';
  const want = Number(o.amount ?? price());
  if (Number.isFinite(st.amount) && st.amount > 0 && st.amount + 0.01 < want) return `المبلغ المدفوع (${st.amount}) أقل من سعر الطلب (${want})`;
  return null;
}
/** يطبّق حالة الدفع اللي رجعت من سكيب كاش على الطلب */
function applyPayment(o, st) {
  if (Number.isFinite(st.amount)) o.skipcashAmount = st.amount;
  if (!st.paid) return;
  const prob = paymentProblem(o, st);
  if (prob) {
    o.review = prob;
    console.error('[skipcash] ⚠ طلب يحتاج مراجعة', o.id, prob);
    return;
  }
  delete o.review;
  markPaid(o);
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
  // ميتا: نفس رقم الحدث حق البكسل (رقم الطلب) عشان ينحسب مرة وحدة. التجربة من اللوحة ما تنرسل
  if (capiEnabled && !o.test && o.online) void sendEvent({ name: 'Purchase', eventId: orderRef(o), value: amount, user: userData({ ...o, ...(o.meta || {}) }) });
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
function limited(ip, max = 20) {
  const now = Date.now();
  const a = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  a.push(now);
  attempts.set(ip, a);
  return a.length > max;
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
/** جسم الطلب كـ JSON — الجسم الكبير (أكثر من 100KB) يرجع {} فيرفضه التحقق العادي بدل ما يعلّق الطلب */
async function readBody(req) {
  const b = await readBodyRaw(req);
  // جسم مب كائن (null أو رقم أو مصفوفة) = فاضي، عشان ما يطيح الطلب بخطأ 500
  if (!b || typeof b !== 'object' || Array.isArray(b)) return {};
  return b.__tooLarge ? {} : b;
}
// ——— دخول لوحة الإدارة: اسم مستخدم + كلمة مرور (+ رمز 2FA اختياري) وجلسة بكوكي آمن ———
// إيميل يوصله إيصال سكيب كاش لما العميل ما يكتب إيميله (حط إيميلك في Railway: RECEIPT_EMAIL)
const RECEIPT_FALLBACK = String(process.env.RECEIPT_EMAIL || 'receipts@i3enna.qa').trim();
const ADMIN_USER = String(process.env.ADMIN_USER || 'admin').trim().toLowerCase();
const ADMIN_TOTP = String(process.env.ADMIN_TOTP_SECRET || '').replace(/[\s=-]/g, '').toUpperCase();
const ADMIN_COOKIE = 'enna_admin';
const ADMIN_TTL = 12 * 3600 * 1000;
// المفتاح مربوط بكلمة المرور: تغييرها في Railway يطلّع كل الجلسات القديمة
const admKey = () => crypto.createHmac('sha256', SECRET || 'enna').update('admin-session:' + ADMIN_PASSWORD).digest();
const eq = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
function b32decode(str) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of str) {
    const v = A.indexOf(c);
    if (v < 0) return null;
    bits += v.toString(2).padStart(5, '0');
  }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
/** رمز Google Authenticator (TOTP — 6 أرقام كل 30 ثانية) */
function totp(secretB32, t = Date.now(), step = 0) {
  const key = b32decode(secretB32);
  if (!key) return null;
  const counter = Math.floor(t / 30000) + step;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}
const totpOk = (code) => {
  const c = String(code || '').replace(/\D/g, '');
  return c.length === 6 && [-1, 0, 1].some((st) => eq(totp(ADMIN_TOTP, Date.now(), st), c));
};
function adminSession() {
  const body = Buffer.from(JSON.stringify({ u: ADMIN_USER, exp: Date.now() + ADMIN_TTL })).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', admKey()).update(body).digest('base64url');
}
function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const tok = readCookie(req, ADMIN_COOKIE);
  const [body, sig] = tok.split('.');
  if (!body || !sig) return false;
  if (!eq(sig, crypto.createHmac('sha256', admKey()).update(body).digest('base64url'))) return false;
  try {
    const j = JSON.parse(Buffer.from(body, 'base64url').toString());
    return j.u === ADMIN_USER && j.exp > Date.now();
  } catch {
    return false;
  }
}
const cookieFlags = (req) => `Path=/; HttpOnly; SameSite=Strict${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`;
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
  let file = safeJoin(DIST, urlPath);
  if (!file) return send(res, 403, { error: 'forbidden' });
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
  if (SITE_DOMAIN && path.basename(file) === 'index.html') {
    const body = readSiteFile(file);
    res.writeHead(200, { ...headers, 'content-length': body.length });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json', '.webmanifest', '.txt']);
const zcache = new Map();
/** نسخة مضغوطة من الملف (محفوظة في الذاكرة ومربوطة بوقت التعديل) */
// الدومين الرسمي (مثلاً www.i3enna.qa): إذا انضبط في Railway نحوّل الرابط القديم عليه
const SITE_DOMAIN = String(process.env.SITE_DOMAIN || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '');
// الدومين المكتوب في index.html (وسوم المعاينة). إذا انضبط SITE_DOMAIN لدومين ثاني نبدّله وقت التقديم
const BAKED_ORIGINS = ['https://www.i3enna.qa', 'https://al-enna-planner-production.up.railway.app'];
/** روابط المعاينة (واتساب/سوشال) تطلع بالدومين الرسمي */
function readSiteFile(file) {
  const raw = fs.readFileSync(file);
  if (!SITE_DOMAIN || path.basename(file) !== 'index.html') return raw;
  let html = raw.toString('utf8');
  for (const o of BAKED_ORIGINS) html = html.split(o).join('https://' + SITE_DOMAIN);
  return Buffer.from(html);
}
function compressed(file, enc) {
  try {
    const st = fs.statSync(file);
    const key = `${enc}:${file}`;
    const hit = zcache.get(key);
    if (hit && hit.mtime === st.mtimeMs) return hit.body;
    const raw = readSiteFile(file);
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
  // الرابط القديم (railway.app) والدومين بدون www → الدومين الرسمي. الـ API ما نحوّله عشان الويبهوك والتبويبات المفتوحة
  if (SITE_DOMAIN && (req.method === 'GET' || req.method === 'HEAD') && !p.startsWith('/api/')) {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase().split(':')[0];
    if (host && host !== SITE_DOMAIN && (host.endsWith('.up.railway.app') || 'www.' + host === SITE_DOMAIN || host === 'www.' + SITE_DOMAIN))
      return send(res, 301, '', { location: 'https://' + SITE_DOMAIN + req.url, 'cache-control': 'public, max-age=3600' });
  }

  try {
    if (p === '/api/status') {
      const refId = parseRef(url.searchParams.get('ref'));
      return send(res, 200, { licensing: LICENSING, price: priceFor(refId), basePrice: Math.max(price(), listPrice()), sale: !refId && listPrice() > price(), refValid: !!refId, refDiscount: refDiscount(), online: skipcashEnabled && LICENSING, content: db.content });
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
      // الإيميل اختياري: إذا كتبه نتحقق منه، وإذا لا نرسل إيميل التاجر (سكيب كاش يطلبه) عشان الإيصال يوصلنا نحن
      const hasEmail = !!String(email || '').trim();
      const v = validateBuyer({ name, phone, email }, hasEmail);
      if (v.errors) return send(res, 400, { ok: false, error: Object.values(v.errors)[0], errors: v.errors });
      const nm = v.name;
      const full = v.phone;
      const em = hasEmail ? v.email : RECEIPT_FALLBACK;
      const parts = nm.split(/\s+/);
      const order = { id: crypto.randomBytes(8).toString('hex'), no: nextOrderNo(), name: nm, phone: full, email: em, createdAt: Date.now(), status: 'creating', online: true, ref: refId || undefined, amount: priceFor(refId) };
      // لميتا (Conversions API): عنوان الجهاز والمتصفح وكوكيز البكسل — تنحفظ مع الطلب عشان نرسل الشراء من السيرفر
      const mc = metaCookies(req);
      order.meta = { ip, ua: String(req.headers['user-agent'] || '').slice(0, 400), fbp: mc.fbp, fbc: mc.fbc };
      // نحفظ الطلب قبل ما نكلم سكيب كاش: لو صار شي بعد الدفع ما يضيع الطلب
      db.orders.unshift(order);
      db.orders = db.orders.slice(0, 5000);
      saveDb();
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
        order.status = 'pending';
        saveDb();
        if (capiEnabled) void sendEvent({ name: 'InitiateCheckout', eventId: 'chk-' + order.id, value: order.amount, user: userData({ ...order, ...order.meta }) });
        return send(res, 200, { ok: true, payUrl: pay.payUrl, orderId: order.id });
      } catch (e) {
        console.error('[skipcash]', e.message);
        order.status = 'cancelled';
        order.lastError = String(e.message).slice(0, 200);
        saveDb();
        // «Invalid details»: سكيب كاش رفض بيانات العميل (غالباً رقم الجوال) — نقوله وش يصلح بدل «حاول بعد شوي»
        if (/invalid/i.test(String(e.message)))
          return send(res, 400, {
            ok: false,
            contact: true,
            error: 'نظام الدفع ما قبل بياناتك — تأكد من رقم جوالك، أو كلّمنا واتساب ونكمل لك الطلب',
            errors: { phone: 'تأكد من الرقم: القطري 8 أرقام (مثل 55123456)' },
          });
        return send(res, 502, { ok: false, contact: true, error: 'ما قدرنا نفتح صفحة الدفع الحين — حاول بعد شوي أو كلّمنا واتساب' });
      }
    }

    if (p === '/api/checkout/verify' && req.method === 'POST') {
      // حد محاولات: كل تحقق يكلم سكيب كاش، فما نخلي أحد يغرقه
      if (limited('vf:' + ip)) return send(res, 429, { ok: false, error: 'محاولات كثيرة — حاول بعد عشر دقائق' });
      const { paymentId, orderId } = await readBody(req);
      const o = db.orders.find((x) => (orderId && x.id === orderId) || (paymentId && x.paymentId === paymentId));
      if (!o) return send(res, 404, { ok: false, error: 'ما لقينا الطلب' });
      let failed = false;
      // نستعلم بس برقم الدفع اللي أنشأناه نحن للطلب (ما نقبل رقم دفع يرسله العميل)
      if (o.status !== 'paid' && o.paymentId) {
        try {
          const st = await getPayment(o.paymentId);
          o.skipcashStatus = st.statusId;
          o.lastCheck = Date.now();
          delete o.lastError;
          if (st.paid) applyPayment(o, st);
          else if (st.failed) failed = true;
        } catch (e) {
          o.lastError = String(e.message).slice(0, 200);
          console.error('[skipcash verify]', e.message);
        }
        saveDb();
      }
      if (failed) return send(res, 200, { ok: false, failed: true, error: 'الدفع ما تم (انلغى أو انرفضت البطاقة) — ما انخصم شي، جرّب مرة ثانية' });
      if (o.review) return send(res, 200, { ok: false, pending: true, review: true, error: 'وصلنا دفعك بس يحتاج مراجعة سريعة — تواصل معنا ونرسل لك الكود خلال دقائق' });
      if (o.status !== 'paid') return send(res, 200, { ok: false, pending: true, error: 'الدفع ما اكتمل للحين' });
      return send(res, 200, { ok: true, code: db.codes[o.codeId]?.code, receipt: { ref: orderRef(o), paymentId: o.paymentId ? '…' + String(o.paymentId).replace(/-/g, '').slice(-8).toUpperCase() : '', amount: o.amount ?? price(), paidAt: o.paidAt || Date.now(), name: o.name, seller: 'نقلة لحلول المواقع (Naqla For Website Solutions)', sellerAddress: db.content.sellerAddress || '', sellerCR: db.content.sellerCR || '', sellerPhone: db.content.support || '', test: !!o.test } });
    }

    if (p === '/api/skipcash/webhook' && req.method === 'POST') {
      const body = await readBody(req);
      if (!verifyWebhook(body, req.headers.authorization)) return send(res, 401, { ok: false });
      const o = db.orders.find((x) => x.id === body.Custom1 || x.id === body.TransactionId || x.paymentId === body.PaymentId);
      if (o && o.status !== 'paid' && Number(body.StatusId) === 2) {
        applyPayment(o, { paid: true, amount: Number(body.Amount), transactionId: body.TransactionId || o.id });
        saveDb();
      }
      return send(res, 200, { ok: true });
    }

    if (p === '/api/order' && req.method === 'POST') {
      if (limited(ip)) return send(res, 429, { ok: false, error: 'محاولات كثيرة — حاول بعد عشر دقائق' });
      const { name, phone, ref } = await readBody(req);
      const refId = parseRef(ref);
      const v = validateBuyer({ name, phone }, false);
      if (v.errors) return send(res, 400, { ok: false, error: Object.values(v.errors)[0], errors: v.errors });
      const full = v.phone;
      db.orders.unshift({ id: crypto.randomBytes(6).toString('hex'), no: nextOrderNo(), name: v.name, phone: full.slice(0, 20), createdAt: Date.now(), status: 'new', ref: refId || undefined, amount: priceFor(refId) });
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

    if (p === '/api/feedback' && req.method === 'POST') {
      if (limited('fb:' + ip)) return send(res, 429, { ok: false, error: 'أرسلت وايد — حاول بعد شوي' });
      const { token, text, where } = await readBody(req);
      const t = LICENSING ? readToken(token) : { c: 'open' };
      if (!t) return send(res, 401, { ok: false, error: 'سجّل دخول من جديد' });
      const body = cleanText(text, 2000);
      if (body.length < 3) return send(res, 400, { ok: false, error: 'اكتب ملاحظتك' });
      const rec = db.codes[t.c];
      db.feedback.unshift({ id: crypto.randomBytes(6).toString('hex'), at: Date.now(), codeId: t.c, name: rec?.name || '', phone: rec?.phone || '', text: body, where: cleanText(where, 80), done: false });
      db.feedback = db.feedback.slice(0, 1000);
      saveDb();
      return send(res, 200, { ok: true });
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

    // ——— مسار البيع: حدث مجهول من المتصفح (زيارة، تجربة…) ———
    if (p === '/api/track' && req.method === 'POST') {
      if (limited('tr:' + ip, 120)) return send(res, 429, { ok: false });
      const { e, sid } = await readBody(req);
      if (recordEvent(db, String(e || ''), sid)) saveDbSoon();
      return send(res, 204, '');
    }

    // ——— سياسة الخصوصية (بدون دخول) ———
    if (p === '/privacy' && (req.method === 'GET' || req.method === 'HEAD')) {
      return send(res, 200, privacyPage({ support: db.content.support, address: db.content.sellerAddress, cr: db.content.sellerCR }), { 'cache-control': 'public, max-age=600' });
    }

    // ——— الإدارة ———
    if (p === '/admin' || p.startsWith('/api/admin/')) {
      if (!ADMIN_PASSWORD) return send(res, 503, '<h1 dir="rtl">لوحة الإدارة معطلة: اضبط ADMIN_PASSWORD في Railway</h1>');
      // تخمين كلمة مرور الإدارة: بعد 20 محاولة غلط يتقفل العنوان 10 دقائق (حتى لو الكلمة صح)
      const admTries = (attempts.get('adm:' + ip) || []).filter((t) => Date.now() - t < 10 * 60 * 1000).length;
      if (admTries >= 20) return send(res, 429, p === '/admin' ? '<h1 dir="rtl" style="font-family:sans-serif;text-align:center;margin-top:20vh">محاولات كثيرة — حاول بعد عشر دقائق</h1>' : { error: 'محاولات كثيرة — حاول بعد عشر دقائق' });
      if (p === '/api/admin/login' && req.method === 'POST') {
        const { user, password, code } = await readBody(req);
        const okUser = eq(String(user || '').trim().toLowerCase(), ADMIN_USER);
        const okPass = eq(String(password || ''), ADMIN_PASSWORD);
        const okCode = !ADMIN_TOTP || totpOk(code);
        if (!(okUser && okPass && okCode)) {
          limited('adm:' + ip);
          // رسالة وحدة لكل الحالات عشان ما نكشف أي جزء صح
          return send(res, 401, { error: ADMIN_TOTP ? 'البيانات أو رمز التحقق غلط' : 'اسم المستخدم أو كلمة المرور غلط' });
        }
        console.log('[enna] دخول لوحة الإدارة من', ip);
        return send(res, 200, { ok: true }, { 'set-cookie': `${ADMIN_COOKIE}=${adminSession()}; ${cookieFlags(req)}; Max-Age=${ADMIN_TTL / 1000}` });
      }
      if (p === '/api/admin/logout' && req.method === 'POST') return send(res, 200, { ok: true }, { 'set-cookie': `${ADMIN_COOKIE}=; ${cookieFlags(req)}; Max-Age=0` });
      if (!isAdmin(req)) {
        if (p === '/admin') return send(res, 200, adminLoginPage({ totp: !!ADMIN_TOTP }), { 'x-robots-tag': 'noindex' });
        return send(res, 401, { error: 'سجّل دخول من جديد' });
      }
      // حماية CSRF: أوامر اللوحة لازم تجي من صفحة اللوحة نفسها
      if (req.method === 'POST' && req.headers['x-enna-admin'] !== '1') return send(res, 403, { error: 'طلب مرفوض' });
      if (p === '/admin') return send(res, 200, adminPage({ skipcash: skipcashEnabled ? skipcashEnv : '', licensing: LICENSING, maxDevices: MAX_DEVICES, persistent: DATA_DIR === '/data' || !!process.env.DATA_DIR }));
      if (p === '/api/admin/funnel') {
        const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 7));
        return send(res, 200, funnelSummary(db, days));
      }
      if (p === '/api/admin/list') {
        const list = Object.values(db.codes).sort((a, b) => b.createdAt - a.createdAt).map(publicRec);
        return send(res, 200, { list, orders: db.orders, referrals: db.referrals, feedback: db.feedback, content: db.content, paymentLink: PAYMENT_LINK, price: price(), refReward: refReward(), settings: { price: price(), listPrice: listPrice(), refDiscount: refDiscount(), refReward: refReward() } });
      }
      // تجربة شاشة ما بعد الدفع بدون سكيب كاش ولا فلوس (ما تنحسب في المبيعات)
      if (p === '/api/admin/test-order' && req.method === 'POST') {
        if (!LICENSING) return send(res, 400, { error: 'اضبط LICENSE_SECRET أولاً' });
        const o = { id: crypto.randomBytes(8).toString('hex'), no: nextOrderNo(), name: 'تجربة شراء', phone: '', createdAt: Date.now(), status: 'pending', online: true, test: true, amount: price() };
        db.orders.unshift(o);
        markPaid(o);
        const rec = db.codes[o.codeId];
        rec.note = '🧪 تجربة شراء (بدون دفع)';
        rec.test = true;
        saveDb();
        return send(res, 200, { ok: true, url: `/?paid=1&custom1=${o.id}`, order: o });
      }
      // تنزيل نسخة كاملة من البيانات (للأرشفة خارج Railway) — بدون كلمات مرور العملاء
      if (p === '/api/admin/backup') {
        const safe = { ...db, codes: Object.fromEntries(Object.entries(db.codes).map(([k, r]) => [k, publicRec(r)])) };
        return send(res, 200, JSON.stringify({ exportedAt: new Date().toISOString(), ...safe }, null, 2), {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename="al-enna-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        });
      }
      if (p === '/api/admin/content' && req.method === 'POST') {
        const b = await readBody(req);
        const next = {};
        for (const [k, max] of Object.entries(CONTENT_KEYS)) {
          const v = cleanText(b[k], max);
          if (v) next[k] = v;
        }
        if (next.support) {
          const ph = parsePhone(next.support);
          if (ph.error) return send(res, 400, { error: 'رقم الواتساب للدعم: ' + ph.error });
          next.support = ph.phone;
        }
        db.content = next;
        saveDb();
        return send(res, 200, { ok: true, content: next });
      }
      if (p === '/api/admin/feedback' && req.method === 'POST') {
        const { id, done, remove } = await readBody(req);
        const i = db.feedback.findIndex((f) => f.id === id);
        if (i < 0) return send(res, 404, { error: 'غير موجود' });
        if (remove) db.feedback.splice(i, 1);
        else db.feedback[i].done = !!done;
        saveDb();
        return send(res, 200, { ok: true });
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
        db.settings = { ...db.settings, ...next };
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
            const st = await getPayment(o.paymentId);
            o.skipcashStatus = st.statusId;
            applyPayment(o, st);
          } catch (e) {
            console.error('[skipcash check]', e.message);
          }
        } else if (['new', 'sent', 'paid', 'cancelled'].includes(status) && o.status !== 'paid') o.status = status;
        if (status === 'paid' && LICENSING) {
          // المدير راجع الطلب بنفسه وأكد الدفع
          delete o.review;
          markPaid(o);
        }
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
        if (action === 'reset') {
          rec.devices = [];
          rec.epoch = (rec.epoch || 0) + 1; // الأجهزة القديمة تطلع فعلاً، مو بس تنمسح من القائمة
        }
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
