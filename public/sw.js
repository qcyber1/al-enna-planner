// خدمة العمل بدون إنترنت لمخطط العنة
// - الصفحة: من الشبكة أولاً (عشان التحديثات توصل)، وإذا ما في نت من النسخة المحفوظة
// - ملفات /assets (أسماؤها فيها بصمة): من المحفوظ أولاً
// - الـ API ولوحة الإدارة: ما تنحفظ أبداً
const CACHE = 'enna-v2';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || url.pathname === '/privacy') return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          // نحفظ الصفحة الرئيسية بس (مو /privacy أو غيرها) عشان التطبيق يفتح بدون نت
          if (res.ok && url.pathname === '/') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || new Response('أنت بدون إنترنت', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }))),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            // ما نحفظ صفحة HTML مكان ملف JS (لو السيرفر رجّع الرئيسية بالغلط)
            if (res.ok && !String(res.headers.get('content-type') || '').includes('text/html')) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // باقي الملفات (أيقونات، صور): الشبكة ثم المحفوظ
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || Response.error())),
  );
});
