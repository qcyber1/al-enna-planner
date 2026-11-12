// اختبارات «📸 صورة حقيقية»: الرصيد (3 مجانية)، الخصم بس لما تنجح، الباقة، السقف اليومي — بسيرفر صور وهمي (بدون فلوس)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5100 + Math.floor(Math.random() * 200);
const FAKE = PORT + 300;
const BASE = `http://127.0.0.1:${PORT}`;
let proc;
let fake;
let dir;
let ipN = 0;
let fakeFail = false;
let fakeCalls = 0;
let lastAuth = '';

const api = async (p, body, headers = {}) => {
  const r = await fetch(BASE + p, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.7.0.${++ipN % 250}`, ...headers },
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
let COOKIE = '';
const admin = (p, body) => api(p, body, { cookie: COOKIE, 'x-enna-admin': '1' });
// صورة JPEG صغيرة صالحة الشكل (البايتات ما تهم للسيرفر الوهمي)
const IMG = 'data:image/jpeg;base64,' + Buffer.alloc(4000, 7).toString('base64');

before(async () => {
  fake = http.createServer((req, res) => {
    let n = 0;
    req.on('data', (c) => (n += c.length));
    req.on('end', () => {
      fakeCalls++;
      lastAuth = req.headers.authorization || '';
      if (fakeFail) {
        res.writeHead(500, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'boom' } }));
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ b64_json: Buffer.from('fake-png-' + n).toString('base64') }] }));
    });
  });
  await new Promise((r) => fake.listen(FAKE, r));
  dir = mkdtempSync(path.join(tmpdir(), 'enna-ai-'));
  proc = spawn(process.execPath, ['server/index.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, LICENSE_SECRET: 'test-secret-0123456789abcdef', ADMIN_PASSWORD: 'test-admin-pw', OPENAI_API_KEY: 'sk-test-dummy', OPENAI_BASE_URL: `http://127.0.0.1:${FAKE}`, SKIPCASH_CLIENT_ID: '' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(BASE + '/api/status');
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const r = await fetch(BASE + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.7.9.1' }, body: JSON.stringify({ user: 'admin', password: 'test-admin-pw' }) });
  COOKIE = (r.headers.get('set-cookie') || '').split(';')[0];
});

after(() => {
  proc?.kill();
  fake?.close();
  rmSync(dir, { recursive: true, force: true });
});

test('الصور: مطفية افتراضياً، وبعد التشغيل 3 مجانية والخصم بس لما تنجح', async () => {
  const created = await admin('/api/admin/create', { name: 'عميل صور', price: 299 });
  const code = created.json.created[0].code;
  const act = await api('/api/activate', { code, device: 'dev-ai-1' });
  const token = act.json.token;
  // مطفية
  assert.equal((await api('/api/ai-photo/status', { token })).json.on, false);
  assert.equal((await api('/api/ai-photo', { token, image: IMG })).status, 400);
  // تشغيل من الأدمن
  const cur = (await admin('/api/admin/list')).json.settings;
  const s = await admin('/api/admin/settings', { ...cur, aiOn: true, aiFree: 3, aiPackSize: 10, aiPackPrice: 19, aiDailyCap: 20, aiCost: 0.25 });
  assert.equal(s.status, 200);
  const st = (await api('/api/ai-photo/status', { token })).json;
  assert.equal(st.on, true);
  assert.equal(st.left, 3);
  assert.equal(st.packPrice, 19);
  // بدون دخول
  assert.equal((await api('/api/ai-photo', { token: 'bad', image: IMG })).status, 401);
  // صورة غلط
  assert.equal((await api('/api/ai-photo', { token, image: 'data:text/plain;base64,aaaa' })).status, 400);
  // نجاح: ينخصم وحدة، والمفتاح ينرسل للمزوّد بس (ما يرجع للمتصفح)
  const ok = await api('/api/ai-photo', { token, image: IMG, mood: 'sunset', hints: ['مجلس', 'ملعب طائرة'] });
  assert.equal(ok.status, 200);
  assert.ok(ok.json.image.startsWith('data:image/png;base64,'));
  assert.equal(ok.json.left, 2);
  assert.equal(lastAuth, 'Bearer sk-test-dummy');
  assert.ok(!JSON.stringify(ok.json).includes('sk-test'));
  // فشل المزوّد: ما ينخصم
  fakeFail = true;
  const bad = await api('/api/ai-photo', { token, image: IMG });
  assert.equal(bad.status, 502);
  fakeFail = false;
  assert.equal((await api('/api/ai-photo/status', { token })).json.left, 2);
  // نخلص الرصيد
  await api('/api/ai-photo', { token, image: IMG });
  await api('/api/ai-photo', { token, image: IMG });
  const none = await api('/api/ai-photo', { token, image: IMG });
  assert.equal(none.status, 402);
  // الإحصائيات في الأدمن
  const stats = (await admin('/api/admin/list')).json.settings.aiStats;
  assert.equal(stats.today, 3);
  assert.equal(stats.failed, 1);
  assert.equal(stats.monthCost, 0.75);

  // شراء باقة (طلب يدوي) ← تم الدفع ← +10 لنفس الكود بدون كود جديد
  const before = (await admin('/api/admin/list')).json.list.length;
  const ord = await api('/api/order', { name: 'عميل صور', phone: '55667788', product: 'photos', upgradeToken: token });
  assert.equal(ord.status, 200);
  const o = (await admin('/api/admin/list')).json.orders.find((x) => x.product === 'photos');
  assert.equal(o.amount, 19);
  assert.equal(o.photos, 10);
  await admin('/api/admin/order', { id: o.id, status: 'paid' });
  assert.equal((await admin('/api/admin/list')).json.list.length, before, 'ما انولّد كود جديد');
  assert.equal((await api('/api/ai-photo/status', { token })).json.left, 10);
  // الباقة بدون دخول = مرفوض
  assert.equal((await api('/api/order', { name: 'غريب', phone: '55667799', product: 'photos' })).status, 400);
});

test('الصور: السقف اليومي يوقف الطلبات', async () => {
  const cur = (await admin('/api/admin/list')).json.settings;
  // 3 صور انسوت اليوم × 0.25 = 0.75 — السقف 1 ر.ق يسمح بوحدة بس
  await admin('/api/admin/settings', { ...cur, aiOn: true, aiDailyCap: 1, aiCost: 0.25 });
  const created = await admin('/api/admin/create', { name: 'عميل ثاني', price: 299 });
  const act = await api('/api/activate', { code: created.json.created[0].code, device: 'dev-ai-2' });
  const a = await api('/api/ai-photo', { token: act.json.token, image: IMG });
  assert.equal(a.status, 200);
  const b = await api('/api/ai-photo', { token: act.json.token, image: IMG });
  assert.equal(b.status, 503);
});
