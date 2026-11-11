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

// ——— مسار البيع ———
import { recordEvent, funnelSummary, qaDay } from '../funnel.mjs';

test('مسار البيع: الحدث ينحسب مرة لكل شخص باليوم، والأحداث الغريبة تنرفض', () => {
  const db = { orders: [] };
  const now = Date.UTC(2026, 10, 7, 12);
  assert.equal(recordEvent(db, 'visit', 'aaaaaaaaaaaaaaaa01', now), true);
  assert.equal(recordEvent(db, 'visit', 'aaaaaaaaaaaaaaaa01', now), false, 'نفس الشخص ما ينحسب مرتين');
  assert.equal(recordEvent(db, 'visit', 'bbbbbbbbbbbbbbbb02', now), true);
  assert.equal(recordEvent(db, 'hack', 'aaaaaaaaaaaaaaaa01', now), false);
  assert.equal(recordEvent(db, 'visit', 'short', now), false);
  assert.equal(recordEvent(db, '__proto__', 'aaaaaaaaaaaaaaaa01', now), false);
  assert.equal(recordEvent(db, 'visit', { a: 1 }, now), false, 'المعرّف لازم نص');
  assert.equal(recordEvent(db, 'visit', 'not-hex-id-zzzzzzzz', now), false, 'المعرّف لازم hex');
  assert.ok(!JSON.stringify(db).includes('aaaaaaaaaaaaaaaa01'), 'المعرّف ينحفظ مشفّر');
  const s = funnelSummary(db, 7, now);
  assert.equal(s.days.length, 7);
  assert.equal(s.total.visit, 2);
});

test('مسار البيع: المبيعات من الطلبات الحقيقية بس (بدون التجارب)', () => {
  const now = Date.UTC(2026, 10, 7, 12);
  const db = {
    orders: [
      { online: true, paymentId: 'p1', createdAt: now, status: 'paid', paidAt: now, amount: 299 },
      { online: true, paymentId: 'p2', createdAt: now, status: 'pending', amount: 299 },
      { online: true, test: true, paymentId: 'p3', createdAt: now, status: 'paid', paidAt: now, amount: 299 },
      { online: true, paymentId: 'p4', createdAt: now - 40 * 86400000, status: 'paid', paidAt: now - 40 * 86400000, amount: 299 },
    ],
  };
  const s = funnelSummary(db, 30, now);
  assert.equal(s.total.checkout, 2);
  assert.equal(s.total.purchase, 1);
  assert.equal(s.total.revenue, 299);
});

test('مسار البيع: يوم قطر يبدأ الساعة 12 بالليل بتوقيت قطر، والأيام القديمة تنمسح', () => {
  assert.equal(qaDay(Date.UTC(2026, 10, 6, 21, 30)), '2026-11-07');
  const db = { funnel: {} };
  for (let i = 0; i < 95; i++) recordEvent(db, 'visit', 'cccccccccccccccc03', Date.UTC(2026, 0, 1) + i * 86400000);
  assert.equal(Object.keys(db.funnel).length, 90);
});

import { snapPayload, snapUser, snapCookies } from '../snap.mjs';
test('سناب: شكل الحدث والتشفير والكوكيز', () => {
  const u = snapUser({ email: 'A@B.com ', phone: '+974 5512 3456', ip: '1.2.3.4', ua: 'UA', scid: 'c1', sccid: 'k1' });
  assert.equal(u.em[0].length, 64);
  assert.equal(u.ph[0], snapUser({ phone: '97455123456' }).ph[0]);
  assert.deepEqual([u.client_ip_address, u.user_agent, u.sc_cookie1, u.sc_click_id], ['1.2.3.4', 'UA', 'c1', 'k1']);
  assert.equal(snapUser({ email: 'x@i3enna.qa' }).em, undefined);
  const b = snapPayload({ name: 'PURCHASE', eventId: 'EN-1', value: 499, user: u, product: 'izba', now: 1_700_000_000_000 });
  const e = b.data[0];
  assert.equal(e.event_time, 1_700_000_000);
  assert.equal(e.event_source_url, 'https://www.i3enna.qa/izba');
  assert.deepEqual(e.custom_data, { event_id: 'EN-1', value: 499, currency: 'QAR', content_ids: ['i3enna-izba-lifetime'], content_category: ['izba-planner'], number_items: ['1'], order_id: 'EN-1' });
  assert.deepEqual(snapCookies({ headers: { cookie: '_fbp=x; _scid=abc-1; _sccid=click%2D9' } }), { scid: 'abc-1', sccid: 'click-9' });
});

import { buildReport, parseRange } from '../report.mjs';
test('التقرير: المبيعات والتجارب واللي ما كمّلوا والمقارنة', () => {
  const now = Date.parse('2026-11-11T12:00:00+03:00');
  const t = (d, h = 12) => Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00+03:00`);
  const db = {
    funnel: { '2026-11-11': { visit: ['a', 'b', 'c', 'd'], trial_start: ['a', 'b'], 'izba:visit': ['z'] }, '2026-11-10': { visit: ['a', 'b'] } },
    orders: [
      { id: '1', no: 1, name: 'سعد', phone: '97455111111', status: 'paid', online: true, amount: 299, paidAt: t('2026-11-11', 10), createdAt: t('2026-11-11', 9), offer: true, codeId: 'c1' },
      { id: '2', no: 2, name: 'تجربة', phone: '97455000000', status: 'paid', online: true, amount: 299, paidAt: t('2026-11-11'), test: true },
      { id: '3', no: 3, name: 'فهد', phone: '97455222222', status: 'pending', online: true, amount: 299, createdAt: t('2026-11-11', 11) },
      { id: '4', no: 4, name: 'فهد', phone: '97455222222', status: 'cancelled', online: true, amount: 299, createdAt: t('2026-11-11', 11), lastError: 'x' },
      { id: '5', no: 5, name: 'أمس', phone: '97455333333', status: 'paid', online: true, amount: 249, paidAt: t('2026-11-10'), createdAt: t('2026-11-10') },
      { id: '6', no: 6, name: 'عزبة', phone: '97455444444', status: 'paid', online: true, amount: 499, product: 'izba', paidAt: t('2026-11-11', 14), createdAt: t('2026-11-11', 13) },
    ],
    codes: { c1: { id: 'c1', price: 299, createdAt: t('2026-11-11'), devices: ['d'] }, m1: { id: 'm1', name: 'يدوي', price: 150, createdAt: t('2026-11-11', 8), devices: [] }, g1: { id: 'g1', price: 0, createdAt: t('2026-11-11'), devices: [] } },
    feedback: [],
    referrals: [],
  };
  const r = buildReport(db, '2026-11-11', '2026-11-11', now);
  assert.equal(r.days, 1);
  assert.equal(r.visits, 5);
  assert.equal(r.trials, 2);
  assert.equal(r.purchases, 3, 'سعد + العزبة + الكود اليدوي (بدون التجربة)');
  assert.equal(r.revenue, 299 + 499 + 150);
  assert.equal(r.revenueBy.izba, 499);
  assert.equal(r.offerSales, 1);
  assert.equal(r.lost.length, 1, 'فهد مرة وحدة');
  assert.equal(r.lost[0].tries, 2);
  assert.equal(r.prev.from, '2026-11-10');
  assert.equal(r.prev.revenue, 249);
  assert.equal(r.prev.visits, 2);
  assert.equal(r.totals.sales, 4);
  // الفترة: المستقبل ينقص لليوم، والمقلوبة تتعدل
  assert.deepEqual(parseRange('2026-12-01', '2026-11-01', now), { from: '2026-11-01', to: '2026-11-11' });
  assert.equal(buildReport(db, '2026-11-10', '2026-11-11', now).perDay.length, 2);
  // عمولة سكيب كاش: على الدفع الإلكتروني بس (مب الكود اليدوي)
  const f = buildReport(db, '2026-11-11', '2026-11-11', now, { pct: 2.5, fixed: 1 });
  assert.equal(f.fees, 8.48 + 13.48, 'كل عملية تتقرب لحالها (8.475 + 13.475)');
  assert.equal(f.net, Math.round((948 - f.fees) * 100) / 100);
  assert.equal(f.sales.find((x) => x.method === 'code').fee, 0);
  assert.equal(r.fees, 0, 'بدون إعداد = بدون عمولة');
});
