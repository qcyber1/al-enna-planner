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

test('ملفات الموقع تنضغط (br/gzip) إذا موجودة', async (t) => {
  const r = await fetch(BASE + '/', { headers: { 'accept-encoding': 'gzip' } });
  if (!r.headers.get('content-type')?.includes('text/html')) return t.skip('ما في dist');
  assert.equal(r.headers.get('content-encoding'), 'gzip');
  const html = await r.text();
  assert.match(html, /<div id="root">/);
  // الـ API ما ينضغط ولا يتأثر
  assert.equal((await api('/api/status')).status, 200);
});

test('سكربت لوحة الإدارة سليم (بدون أخطاء صياغة)', async () => {
  const r = await fetch(BASE + '/admin', { headers: { authorization: ADMIN } });
  assert.equal(r.status, 200);
  const html = await r.text();
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length > 0);
  // يرمي SyntaxError لو فيه خطأ صياغة (بدون ما يشغّل الكود)
  for (const s of scripts) new Function(s);
});

test('تغيير السعر والعرض من لوحة الإدارة', async () => {
  const bad = await admin('/api/admin/settings', { price: 0, refDiscount: 10, refReward: 10 });
  assert.equal(bad.status, 400);
  const bad2 = await admin('/api/admin/settings', { price: 100, refDiscount: 150, refReward: 10 });
  assert.equal(bad2.status, 400);
  const ok = await admin('/api/admin/settings', { price: 299, listPrice: 399, refDiscount: 30, refReward: 40 });
  assert.equal(ok.status, 200);
  const s = (await api('/api/status')).json;
  assert.equal(s.price, 299);
  assert.equal(s.basePrice, 399);
  assert.equal(s.sale, true);
  assert.equal((await api('/api/status?ref=' + ref)).json.price, 269);
  assert.equal((await api('/api/admin/settings', { price: 1 })).status, 401, 'بدون كلمة سر ممنوع');
  // يرجع للوضع الطبيعي
  await admin('/api/admin/settings', { price: 349, listPrice: 0, refDiscount: 50, refReward: 50 });
  const s2 = (await api('/api/status')).json;
  assert.equal(s2.price, 349);
  assert.equal(s2.sale, false);
});

test('الدخول برقم الجوال وكلمة المرور من جهاز ثاني', async () => {
  const c = await admin('/api/admin/create', { name: 'دخول', price: 0 });
  const k = c.json.created[0].code;
  const a = await api('/api/activate', { code: k, device: 'pw-1' });
  assert.equal(a.json.hasPw, false);
  assert.equal((await api('/api/login', { phone: '55667788', password: 'secret1', device: 'pw-2' })).status, 401, 'قبل ما يحط كلمة مرور');
  const bad = await api('/api/account/password', { token: a.json.token, phone: '1234', password: '12' });
  assert.equal(bad.status, 400);
  assert.ok(bad.json.errors.phone && bad.json.errors.password);
  assert.equal((await api('/api/account/password', { token: 'x.y', phone: '55667788', password: 'secret1' })).status, 401);
  const set = await api('/api/account/password', { token: a.json.token, phone: '٥٥٦٦٧٧٨٨', password: 'secret1' });
  assert.equal(set.status, 200);
  assert.equal(set.json.phone, '97455667788');
  const wrong = await api('/api/login', { phone: '+974 5566 7788', password: 'nope', device: 'pw-2' });
  assert.equal(wrong.status, 401);
  assert.ok(wrong.json.errors.password);
  const ok = await api('/api/login', { phone: '+974 5566 7788', password: 'secret1', device: 'pw-2' });
  assert.equal(ok.status, 200);
  assert.equal((await api('/api/check', { token: ok.json.token })).json.hasPw, true);
  assert.equal((await api('/api/login', { phone: '55667788', password: 'secret1', device: 'pw-3' })).status, 403, 'حد الأجهزة يطبق');
  const rec = (await admin('/api/admin/list')).json.list.find((r) => r.code === k);
  assert.equal(rec.hasPw, true);
  assert.equal(rec.pw, undefined, 'كلمة المرور ما تطلع في اللوحة');
  await admin('/api/admin/update', { id: rec.id, action: 'resetpw' });
  assert.equal((await api('/api/login', { phone: '55667788', password: 'secret1', device: 'pw-1' })).status, 401);
});

test('نصوص الموقع من اللوحة، والملاحظات من داخل التطبيق', async () => {
  assert.equal((await api('/api/admin/content', { title: 'x' })).status, 401);
  const c = await admin('/api/admin/content', { banner: '  عرض الإطلاق  ', title: 'عنتي', tagline: '', f1: 'a'.repeat(200) });
  assert.equal(c.status, 200);
  assert.deepEqual(Object.keys(c.json.content).sort(), ['banner', 'f1', 'title']);
  assert.equal(c.json.content.f1.length, 40);
  assert.equal((await api('/api/status')).json.content.banner, 'عرض الإطلاق');
  // الأسعار ما تمسح النصوص
  await admin('/api/admin/settings', { price: 299, listPrice: 399, refDiscount: 30, refReward: 30 });
  assert.equal((await api('/api/status')).json.content.title, 'عنتي');
  // الملاحظات تحتاج دخول
  assert.equal((await api('/api/feedback', { token: 'x.y', text: 'hello' })).status, 401);
  const k = (await admin('/api/admin/create', { name: 'فريق', count: 3 })).json.created;
  assert.equal(k.length, 3);
  const tok = (await api('/api/activate', { code: k[0].code, device: 'fb-1' })).json.token;
  assert.equal((await api('/api/feedback', { token: tok, text: ' ' })).status, 400);
  assert.equal((await api('/api/feedback', { token: tok, text: 'الزر صغير <b>', where: '3d' })).status, 200);
  const fb = (await admin('/api/admin/list')).json.feedback;
  assert.equal(fb[0].name, 'فريق');
  assert.equal(fb[0].text, 'الزر صغير <b>');
  assert.equal((await admin('/api/admin/feedback', { id: fb[0].id, done: true })).status, 200);
  assert.equal((await admin('/api/admin/list')).json.feedback[0].done, true);
  await admin('/api/admin/content', {});
});

test('الدومين الجديد: الرابط القديم يتحول له، والـ API ما يتحول', async () => {
  const { spawn } = await import('node:child_process');
  const port = PORT + 1;
  const pr = spawn(process.execPath, ['server/index.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DATA_DIR: dir + '-dom', LICENSE_SECRET: 'test-secret-0123456789abcdef', ADMIN_PASSWORD: 'x', SITE_DOMAIN: 'https://www.i3enna.qa/' },
    stdio: 'ignore',
  });
  try {
    for (let i = 0; i < 50; i++) {
      try {
        await fetch(`http://127.0.0.1:${port}/api/status`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    const g = (h, p = '/?ref=AB') => fetch(`http://127.0.0.1:${port}${p}`, { headers: { 'x-forwarded-host': h }, redirect: 'manual' });
    const old = await g('al-enna-planner-production.up.railway.app');
    assert.equal(old.status, 301);
    assert.equal(old.headers.get('location'), 'https://www.i3enna.qa/?ref=AB');
    assert.equal((await g('i3enna.qa')).headers.get('location'), 'https://www.i3enna.qa/?ref=AB');
    assert.equal((await g('al-enna-planner-production.up.railway.app', '/api/status')).status, 200, 'API بدون تحويل');
    const home = await g('www.i3enna.qa', '/');
    assert.equal(home.status, 200);
    const html = await home.text();
    if (html.includes('og:url')) assert.ok(html.includes('https://www.i3enna.qa/') && !html.includes('up.railway.app'));
  } finally {
    pr.kill();
  }
});
