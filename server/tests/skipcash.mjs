// اختبار ربط سكيب كاش كامل مع خادم سكيب كاش وهمي يتحقق من التوقيع مثل الحقيقي
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 4900 + Math.floor(Math.random() * 90);
const MOCK = PORT + 100;
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = 'test-key-secret-xyz';
const CLIENT = 'client-123';
const payments = new Map();
let mock, proc, dir, lastSigOk = null, lastBody = null, failCreate = false;

before(async () => {
  mock = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const json = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.method === 'POST' && req.url === '/api/v1/payments') {
        if (failCreate) return json(500, { errorMessage: 'gateway down' });
        const b = JSON.parse(raw);
        lastBody = b;
        // نفس طريقة سكيب كاش: الحقول بالترتيب وأول حرف كبير
        const order = ['uid', 'keyId', 'amount', 'firstName', 'lastName', 'phone', 'email', 'street', 'city', 'state', 'country', 'postalCode', 'transactionId'];
        const str = order.filter((k) => b[k] !== undefined).map((k) => `${k[0].toUpperCase()}${k.slice(1)}=${b[k]}`).join(',');
        const expect = crypto.createHmac('sha256', SECRET).update(str).digest('base64');
        lastSigOk = req.headers.authorization === expect;
        if (!lastSigOk) return json(401, { errorMessage: 'bad signature', returnCode: 401 });
        const id = crypto.randomUUID();
        payments.set(id, { statusId: 1, amount: b.amount, transactionId: b.transactionId });
        return json(200, { returnCode: 200, resultObj: { id } });
      }
      const m = req.url.match(/^\/api\/v1\/payments\/(.+)$/);
      if (req.method === 'GET' && m) {
        if (req.headers.authorization !== CLIENT) return json(401, { errorMessage: 'no' });
        const p = payments.get(decodeURIComponent(m[1]));
        if (!p) return json(404, { errorMessage: 'not found' });
        return json(200, { resultObj: { id: m[1], statusId: p.statusId, amount: p.amount, transactionId: p.transactionId } });
      }
      json(404, {});
    });
  }).listen(MOCK);
  dir = mkdtempSync(path.join(tmpdir(), 'enna-sc-'));
  proc = spawn(process.execPath, ['server/index.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, LICENSE_SECRET: 'test-secret-0123456789abcdef', ADMIN_PASSWORD: 'x', SKIPCASH_CLIENT_ID: CLIENT, SKIPCASH_KEY_ID: 'key-1', SKIPCASH_KEY_SECRET: SECRET, SKIPCASH_BASE_URL: `http://127.0.0.1:${MOCK}` },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/status'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
});
after(() => { proc?.kill(); mock?.close(); if (dir) rmSync(dir, { recursive: true, force: true }); });

const post = async (p, b) => { const r = await fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, json: await r.json() }; };

test('الدفع الإلكتروني مفعّل لما تنحط المفاتيح', async () => {
  const s = await (await fetch(BASE + '/api/status')).json();
  assert.equal(s.online, true);
});

let orderId, payId;
test('إنشاء الدفع: توقيع صحيح + رابط صفحة الدفع', async () => {
  const r = await post('/api/checkout', { name: 'محمد الكواري', phone: '55112233', email: 'm@example.com' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(lastSigOk, true);
  assert.equal(lastBody.amount, '349.00');
  assert.equal(lastBody.phone, '97455112233');
  assert.equal(lastBody.firstName, 'محمد');
  assert.match(r.json.payUrl, /\/pay\//);
  orderId = r.json.orderId;
  payId = r.json.payUrl.split('/pay/')[1];
});

test('قبل الدفع: التحقق يقول ما اكتمل، وبعد الدفع ينولد الكود', async () => {
  const v1 = await post('/api/checkout/verify', { paymentId: payId });
  assert.equal(v1.json.ok, false);
  assert.equal(v1.json.pending, true);
  payments.get(payId).statusId = 2; // العميل دفع
  const v2 = await post('/api/checkout/verify', { paymentId: payId });
  assert.equal(v2.json.ok, true);
  assert.match(v2.json.code, /^ENNA-/);
  // تكرار التحقق ما يولّد كود ثاني
  const v3 = await post('/api/checkout/verify', { orderId });
  assert.equal(v3.json.code, v2.json.code);
  const a = await post('/api/activate', { code: v2.json.code, device: 'phone-1' });
  assert.equal(a.status, 200);
});

test('بيانات ناقصة ترجع رسالة واضحة', async () => {
  const r = await post('/api/checkout', { name: 'x', phone: '1', email: 'bad' });
  assert.equal(r.status, 400);
});

test('دفع ملغي: رسالة واضحة إن ما انخصم شي', async () => {
  const r = await post('/api/checkout', { name: 'سالم', phone: '+974 6612 3456', email: 's@example.com' });
  assert.equal(r.status, 200);
  assert.equal(lastBody.phone, '97466123456');
  const id = r.json.payUrl.split('/pay/')[1];
  payments.get(id).statusId = 3;
  const v = await post('/api/checkout/verify', { paymentId: id });
  assert.equal(v.json.failed, true);
  assert.match(v.json.error, /ما انخصم/);
});

test('رسائل الخطأ لكل خانة لحالها', async () => {
  const r = await post('/api/checkout', { name: 'ناصر', phone: 'فلص4ف34', email: 'asdada@sdfs.com' });
  assert.equal(r.status, 400);
  assert.ok(r.json.errors.phone);
  assert.equal(r.json.errors.name, undefined);
  assert.equal(r.json.errors.email, undefined);
  // أرقام عربية تنقبل
  const ok = await post('/api/checkout', { name: 'ناصر', phone: '٥٥١٢٣٤٥٦', email: 'n@example.com' });
  assert.equal(ok.status, 200);
  assert.equal(lastBody.phone, '97455123456');
});

test('الإيميل اختياري: بدونه يمشي الدفع ويروح الإيصال لإيميل التاجر', async () => {
  const r = await post('/api/checkout', { name: 'خالد', phone: '33445566', email: '' });
  assert.equal(r.status, 200);
  assert.equal(lastBody.email, 'receipts@i3enna.qa');
  const bad = await post('/api/checkout', { name: 'خالد', phone: '33445566', email: 'not-an-email' });
  assert.equal(bad.status, 400, 'إذا كتبه غلط ننبهه');
  assert.ok(bad.json.errors.email);
});

const readDb = () => JSON.parse(readFileSync(path.join(dir, 'licenses.json'), 'utf8'));

test('دفعة بمبلغ أقل من سعر الطلب ما تفتح الكود — الطلب يتعلّم «يحتاج مراجعة»', async () => {
  const r = await post('/api/checkout', { name: 'فهد', phone: '55001122' });
  const id = r.json.payUrl.split('/pay/')[1];
  Object.assign(payments.get(id), { statusId: 2, amount: '1.00' });
  const v = await post('/api/checkout/verify', { orderId: r.json.orderId });
  assert.equal(v.json.ok, false);
  assert.equal(v.json.review, true);
  assert.equal(v.json.code, undefined);
  const o = readDb().orders.find((x) => x.id === r.json.orderId);
  assert.match(o.review, /أقل/);
  assert.notEqual(o.status, 'paid');
});

test('دفعة لطلب ثاني (رقم العملية ما يطابق) ما تفتح الكود', async () => {
  const r = await post('/api/checkout', { name: 'بدر', phone: '55001133' });
  const id = r.json.payUrl.split('/pay/')[1];
  Object.assign(payments.get(id), { statusId: 2, transactionId: 'someone-else' });
  const v = await post('/api/checkout/verify', { paymentId: id });
  assert.equal(v.json.review, true);
  assert.equal(v.json.code, undefined);
});

test('الطلب ينحفظ قبل الاتصال بسكيب كاش، ولو فشل الاتصال يبان في السجل', async () => {
  failCreate = true;
  try {
    const r = await post('/api/checkout', { name: 'راشد', phone: '55001144' });
    assert.equal(r.status, 502);
  } finally {
    failCreate = false;
  }
  const o = readDb().orders.find((x) => x.name === 'راشد');
  assert.ok(o, 'الطلب محفوظ');
  assert.equal(o.status, 'cancelled');
  assert.match(o.lastError, /gateway down/);
});

test('طلب يدوي ما ينفتح برقم دفع يرسله العميل', async () => {
  // دفعة مدفوعة حقيقية لطلب ثاني
  const paidOrder = await post('/api/checkout', { name: 'سعود', phone: '55001155' });
  const paidId = paidOrder.json.payUrl.split('/pay/')[1];
  payments.get(paidId).statusId = 2;
  // طلب يدوي (واتساب) بدون رقم دفع
  await post('/api/order', { name: 'يدوي', phone: '55001166' });
  const manual = readDb().orders.find((x) => x.name === 'يدوي');
  const v = await post('/api/checkout/verify', { orderId: manual.id, paymentId: paidId });
  assert.equal(v.json.ok, false);
  assert.notEqual(readDb().orders.find((x) => x.id === manual.id).status, 'paid');
});

test('التحقق من الدفع عليه حد محاولات', async () => {
  const hit = (ip) => fetch(BASE + '/api/checkout/verify', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ orderId: 'nope' }) });
  let last;
  for (let i = 0; i < 21; i++) last = await hit('10.77.0.1');
  assert.equal(last.status, 429);
  assert.equal((await hit('10.77.0.2')).status, 404, 'جهاز ثاني ما يتأثر');
});
