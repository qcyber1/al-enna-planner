// أدوات HTTP صغيرة قابلة للاختبار (بدون مكتبات)
import path from 'node:path';

/**
 * يربط مسار الطلب بمجلد الملفات بأمان: يرفض أي خروج من المجلد،
 * حتى للمجلدات اللي اسمها يبدأ بنفس الاسم (مثل dist-old بجنب dist).
 */
export function safeJoin(base, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const root = path.resolve(base);
  const file = path.resolve(path.join(root, decoded));
  return file === root || file.startsWith(root + path.sep) ? file : null;
}

export const MAX_BODY = 100_000;

/**
 * يقرأ جسم الطلب كـ JSON. أي جسم أكبر من الحد أو طلب ينقطع يرجع { __tooLarge } أو {}
 * بدل ما يعلّق الطلب للأبد.
 */
export function readBody(req, max = MAX_BODY) {
  return new Promise((resolve) => {
    let s = '';
    let done = false;
    const finish = (v) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    req.on('data', (c) => {
      if (done) return;
      s += c;
      if (s.length > max) {
        finish({ __tooLarge: true });
        req.resume();
      }
    });
    req.on('end', () => {
      try {
        finish(JSON.parse(s || '{}'));
      } catch {
        finish({});
      }
    });
    req.on('error', () => finish({}));
    req.on('close', () => finish({}));
  });
}
