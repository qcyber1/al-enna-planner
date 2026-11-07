// اختبارات وحدات للخادم (بدون تشغيل الخادم)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { safeJoin, readBody } from '../http-utils.mjs';

test('safeJoin: يمنع الخروج من مجلد الملفات حتى للمجلدات الشبيهة بالاسم', () => {
  const base = path.resolve('/app/dist');
  assert.equal(safeJoin(base, '/index.html'), path.join(base, 'index.html'));
  assert.equal(safeJoin(base, '/assets/a.js'), path.join(base, 'assets', 'a.js'));
  assert.equal(safeJoin(base, '/../dist-old/secret.txt'), null, 'مجلد بجنب dist يبدأ بنفس الاسم');
  assert.equal(safeJoin(base, '/..%2fdist-old%2fx'), null);
  assert.equal(safeJoin(base, '/../data/licenses.json'), null);
  assert.equal(safeJoin(base, '/%E0%A4%A'), null, 'ترميز URL خربان');
  assert.equal(safeJoin(base, '/a%00b'), null);
});

test('readBody: الجسم الكبير ما يعلّق الطلب', async () => {
  const req = new PassThrough();
  const p = readBody(req, 1000);
  req.write('x'.repeat(2000));
  const r = await Promise.race([p, new Promise((res) => setTimeout(() => res('TIMEOUT'), 500))]);
  assert.deepEqual(r, { __tooLarge: true });
});

test('readBody: JSON عادي، وJSON خربان يرجع {}، والطلب المقطوع ما يعلّق', async () => {
  const a = new PassThrough();
  const pa = readBody(a);
  a.end('{"x":1}');
  assert.deepEqual(await pa, { x: 1 });
  const b = new PassThrough();
  const pb = readBody(b);
  b.end('{bad');
  assert.deepEqual(await pb, {});
  const c = new PassThrough();
  const pc = readBody(c);
  c.write('{"x":');
  c.destroy();
  const r = await Promise.race([pc, new Promise((res) => setTimeout(() => res('TIMEOUT'), 500))]);
  assert.deepEqual(r, {});
});

import fs from 'node:fs';
import os from 'node:os';
import { loadDbFile, latestBackup, writeDbFile, dailyBackup } from '../datastore.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'enna-ds-'));
const quiet = { error() {} };

test('ملف البيانات التالف ما ينكتب فوقه — ينحفظ جنبه', () => {
  const d = tmp();
  const f = path.join(d, 'licenses.json');
  fs.writeFileSync(f, '{"codes": {"A": ');
  const r = loadDbFile(f, quiet);
  assert.equal(r.db, null);
  assert.ok(r.corrupt && fs.existsSync(r.corrupt), 'الملف التالف محفوظ');
  assert.equal(fs.readFileSync(r.corrupt, 'utf8'), '{"codes": {"A": ');
  assert.equal(fs.existsSync(f), false, 'الأصلي انتقل بدل ما ينمسح');
});

test('ملف غير موجود = بداية فاضية، وملف سليم يرجع مثل ما هو', () => {
  const d = tmp();
  const f = path.join(d, 'licenses.json');
  assert.deepEqual(loadDbFile(f, quiet).db, { codes: {}, orders: [] });
  writeDbFile(f, { codes: { X: { id: 'X' } }, orders: [{ id: 'o1' }] });
  assert.equal(loadDbFile(f, quiet).db.orders[0].id, 'o1');
  assert.equal(fs.existsSync(f + '.tmp'), false);
});

test('نسخة احتياطية يومية: وحدة لكل يوم، وآخر 14 يوم بس، وأحدث نسخة سليمة ترجع', () => {
  const d = tmp();
  const f = path.join(d, 'licenses.json');
  const b = path.join(d, 'backups');
  writeDbFile(f, { codes: { A: {} }, orders: [] });
  for (let i = 0; i < 20; i++) dailyBackup(f, b, 14, new Date(Date.UTC(2026, 0, 1 + i)));
  const files = fs.readdirSync(b).sort();
  assert.equal(files.length, 14);
  assert.equal(files[0], 'licenses-2026-01-07.json');
  assert.equal(files[13], 'licenses-2026-01-20.json');
  fs.writeFileSync(path.join(b, 'licenses-2026-01-20.json'), 'broken');
  assert.equal(latestBackup(b).file, 'licenses-2026-01-19.json', 'يتخطى النسخة التالفة');
});

test('وسوم المعاينة (Open Graph) على i3enna.qa وما فيها رابط Railway القديم', () => {
  const html = fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../index.html'), 'utf8');
  assert.ok(!html.includes('railway.app'), 'ما فيه رابط Railway');
  const meta = (p) => html.match(new RegExp(`(?:property|name)="${p}" content="([^"]+)"`))?.[1];
  assert.equal(meta('og:url'), 'https://www.i3enna.qa/');
  assert.match(meta('og:image'), /^https:\/\/www\.i3enna\.qa\/og\.jpg/);
  assert.match(meta('twitter:image'), /^https:\/\/www\.i3enna\.qa\/og\.jpg/);
  assert.equal(meta('og:image:width'), '1200');
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.i3enna\.qa\/"/);
});

test('Meta Pixel موجود في الصفحة بالرقم الصحيح', () => {
  const html = fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../index.html'), 'utf8');
  assert.match(html, /fbq\('init', '29329924966644106'\)/);
  assert.match(html, /fbq\('track', 'PageView'\)/);
});

test('خدمة العمل بدون نت ما تحفظ صفحة الخصوصية بدال الصفحة الرئيسية', () => {
  const sw = fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../public/sw.js'), 'utf8');
  assert.match(sw, /url\.pathname === '\/privacy'\) return/);
  assert.match(sw, /res\.ok && url\.pathname === '\/'/);
});
