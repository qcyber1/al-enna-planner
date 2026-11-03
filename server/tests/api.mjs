// اختبارات الخادم: الأسعار، الإحالة، التفعيل وحد الأجهزة
// تشغيل: npm run test:server
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 4700 + Math.floor(Math.random() * 200);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = 'Basic ' + Buffer.from('admin:test-admin-pw').toString('base64');
let proc;
let dir;
let ipN = 0;

// كل طلب بعنوان مختلف عشان حد المحاولات (20 كل 10 دقائق) ما يأثر على الاختبارات
const api = async (p, body, headers = {}) => {
  const r = await fetch(BASE + p, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${++ipN % 250}`, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: r.status, json };
};
const admin = (p, body) => api(p, body, { authorization: ADMIN });

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'enna-test-'));
  proc = spawn(process.execPath, ['server/index.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, LICENSE_SECRET: 'test-secret-0123456789abcdef', ADMIN_PASSWORD: 'test-admin-pw', PRICE: '349', REF_DISCOUNT: '50', REF_REWARD: '50', MAX_DEVICES: '2' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(BASE + '/api/status');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('الخادم ما اشتغل');
});

after(() => {
  proc?.kill();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

test('السعر الأساسي 349 بدون إحالة', async () => {
  const { json } = await api('/api/status');
  assert.equal(json.licensing, true);
  assert.equal(json.price, 349);
  assert.equal(json.basePrice, 349);
  assert.equal(json.refValid, false);
});

test('لوحة الإدارة محمية بكلمة مرور', async () => {
  assert.equal((await api('/api/admin/list')).status, 401);
  assert.equal((await api('/api/admin/list', undefined, { authorization: 'Basic ' + Buffer.from('a:wrong').toString('base64') })).status, 401);
  assert.equal((await admin('/api/admin/list')).status, 200);
});

let code;
let token;
test('تفعيل كود صحيح، ورفض كود مزوّر', async () => {
  const c = await admin('/api/admin/create', { name: 'اختبار', price: 349 });
  code = c.json.created[0].code;
  assert.match(code, /^ENNA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const ok = await api('/api/activate', { code, device: 'dev-1' });
  assert.equal(ok.status, 200);
  assert.ok(ok.json.token);
  token = ok.json.token;
  const last = code.slice(-1) === 'A' ? 'B' : 'A';
  const forged = await api('/api/activate', { code: code.slice(0, -1) + last, device: 'dev-1' });
  assert.equal(forged.status, 400);
  assert.equal((await api('/api/check', { token })).status, 200);
  assert.equal((await api('/api/check', { token: token + 'x' })).status, 401);
});

test('حد الأجهزة (2) يمنع الجهاز الثالث، وإعادة التعيين تفكه', async () => {
  assert.equal((await api('/api/activate', { code, device: 'dev-2' })).status, 200);
  assert.equal((await api('/api/activate', { code, device: 'dev-1' })).status, 200, 'نفس الجهاز يرجع عادي');
  assert.equal((await api('/api/activate', { code, device: 'dev-3' })).status, 403);
  const list = (await admin('/api/admin/list')).json.list;
  const rec = list.find((r) => r.code === code);
  await admin('/api/admin/update', { id: rec.id, action: 'reset' });
  assert.equal((await api('/api/activate', { code, device: 'dev-3' })).status, 200);
});

let ref;
test('رابط الإحالة يعطي خصم 50 (السعر 299)، والإحالة المزوّرة ما تنقبل', async () => {
  const mine = await api('/api/myref', { token: (await api('/api/activate', { code, device: 'dev-3' })).json.token });
  assert.equal(mine.status, 200);
  ref = mine.json.ref;
  assert.equal(ref.length, 12);
  assert.equal(mine.json.discount, 50);
  const s = await api('/api/status?ref=' + ref);
  assert.equal(s.json.refValid, true);
  assert.equal(s.json.price, 299);
  const bad = ref.slice(0, -1) + (ref.slice(-1) === 'A' ? 'B' : 'A');
  const s2 = await api('/api/status?ref=' + bad);
  assert.equal(s2.json.refValid, false);
  assert.equal(s2.json.price, 349);
  assert.equal((await api('/api/myref', { token: 'nope' })).status, 401);
});

test('طلب يدوي بإحالة → مدفوع → كود جديد ومكافأة للمُحيل', async () => {
  const o = await api('/api/order', { name: 'عميل الإحالة', phone: '55123456', ref });
  assert.equal(o.status, 200);
  const bad = await api('/api/order', { name: '', phone: '12' });
  assert.equal(bad.status, 400);
  const lst = (await admin('/api/admin/list')).json;
  const order = lst.orders.find((x) => x.name === 'عميل الإحالة');
  assert.equal(order.amount, 299);
  assert.equal(order.phone, '97455123456');
  const paid = await admin('/api/admin/order', { id: order.id, status: 'paid' });
  assert.equal(paid.json.order.status, 'paid');
  assert.ok(paid.json.code?.code, 'انولد كود للعميل');
  // الدفع مرة ثانية ما يولّد كود ثاني
  const again = await admin('/api/admin/order', { id: order.id, status: 'paid' });
  assert.equal(again.json.code.code, paid.json.code.code);
  const after = (await admin('/api/admin/list')).json;
  const refs = after.referrals.filter((r) => ref.startsWith(r.refId));
  assert.equal(refs.length, 1);
  assert.equal(refs[0].reward, 50);
  // إحصائيات المُحيل
  const tok = (await api('/api/activate', { code, device: 'dev-3' })).json.token;
  const mine = await api('/api/myref', { token: tok });
  assert.equal(mine.json.count, 1);
  assert.equal(mine.json.earned, 50);
});

test('كود ملغي ما يشتغل، والإحالة منه تبطل', async () => {
  const rec = (await admin('/api/admin/list')).json.list.find((r) => r.code === code);
  await admin('/api/admin/update', { id: rec.id, action: 'revoke' });
  assert.equal((await api('/api/activate', { code, device: 'dev-1' })).status, 403);
  assert.equal((await api('/api/status?ref=' + ref)).json.price, 349);
  await admin('/api/admin/update', { id: rec.id, action: 'restore' });
  assert.equal((await api('/api/activate', { code, device: 'dev-1' })).status, 200);
});

test('الدفع الإلكتروني مقفول بدون مفاتيح سكيب كاش', async () => {
  const r = await api('/api/checkout', { name: 'x y', phone: '55123456', email: 'a@b.co' });
  assert.equal(r.status, 400);
});
