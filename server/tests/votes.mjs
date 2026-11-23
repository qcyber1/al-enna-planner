// اختبارات «👨‍👩‍👦 الأهل يختارون»: غرفة تصويت، صوت لكل جهاز، النتيجة، والحماية
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5700 + Math.floor(Math.random() * 200);
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
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.8.0.${++ipN % 250}`, ...headers },
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
  dir = mkdtempSync(path.join(tmpdir(), 'enna-vote-'));
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
  const r = await fetch(BASE + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.8.9.1' }, body: JSON.stringify({ user: 'admin', password: 'test-admin-pw' }) });
  COOKIE = (r.headers.get('set-cookie') || '').split(';')[0];
});

after(() => {
  proc?.kill();
  fake?.close();
  rmSync(dir, { recursive: true, force: true });
});



test('التصويت: إنشاء غرفة، صوت لكل جهاز، تغيير الصوت، والنتيجة', async () => {
  const created = await admin('/api/admin/create', { name: 'عميل', price: 299 });
  const act = await api('/api/activate', { code: created.json.created[0].code, device: 'dev-v1' });
  const token = act.json.token;
  // بدون دخول = مرفوض، وتصميم واحد = مرفوض
  assert.equal((await api('/api/vote/create', { token: 'bad', items: [{ name: 'A', img: IMG }, { name: 'B', img: IMG }] })).status, 401);
  assert.equal((await api('/api/vote/create', { token, items: [{ name: 'A', img: IMG }] })).status, 400);
  const c = await api('/api/vote/create', { token, title: 'عزبتنا', items: [{ name: 'التصميم A', img: IMG }, { name: 'التصميم B', img: IMG }] });
  assert.equal(c.status, 200);
  const id = c.json.id;
  // الصفحة والصورة تفتح بدون حساب
  const page = await fetch(BASE + `/v/${id}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /عزبتنا/);
  const img = await fetch(BASE + `/v/${id}/img/1`);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
  // صوتين من جهازين، وجهاز يغيّر صوته
  await api(`/api/vote/${id}`, { i: 0, voter: 'device-one-123', name: 'أبو محمد', comment: 'المجلس أوسع' });
  await api(`/api/vote/${id}`, { i: 1, voter: 'device-two-456' });
  const ch = await api(`/api/vote/${id}`, { i: 1, voter: 'device-one-123', name: 'أبو محمد' });
  assert.equal(ch.status, 200);
  assert.deepEqual(ch.json.items.map((x) => x.votes), [0, 2]);
  assert.equal(ch.json.total, 2);
  assert.ok(!JSON.stringify(ch.json).includes('device-one'), 'أرقام الأجهزة ما تطلع');
  // صاحب التصميم يشوف النتيجة
  const mine = await api('/api/vote/mine', { token });
  assert.equal(mine.json.rooms[0].id, id);
  // اختيار غلط ورابط غلط
  assert.equal((await api(`/api/vote/${id}`, { i: 9, voter: 'device-three-789' })).status, 400);
  assert.equal((await fetch(BASE + '/v/nothere123')).status, 404);
});
