# مخطط العنة | Al Enna Planner

**الرابط المنشور:** https://al-enna-planner-production.up.railway.app

تطبيق ويب لتخطيط العنة (المخيم الشتوي) بمخطط 2D ومجسم 3D، يعمل بالكامل في المتصفح بدون تسجيل دخول أو خادم أو مفاتيح API.

## التشغيل المحلي
يتطلب Node.js 20 أو أحدث.

```bash
npm install
npm run dev
```
ثم افتح الرابط الظاهر (عادة http://localhost:5173).

أوامر أخرى:
- `npm run build` — بناء نسخة النشر في مجلد `dist` (ملفات ثابتة تُرفع على Netlify / Vercel / GitHub Pages).
- `npm run typecheck` — فحص TypeScript.
- `npm test` — اختبارات الحسابات والتنبيهات والاستيراد.

> رابط المشاركة يعمل للآخرين فقط بعد نشر التطبيق على رابط عام (أي استضافة ملفات ثابتة مجانية).

## البنية
- `src/types/plan.ts` نموذج البيانات الموحد (بالمتر) لـ 2D و3D.
- `src/lib/` الهندسة، التنبيهات، الإنارة، الكميات، الحفظ، الاستيراد، المشاركة، النموذج التجريبي.
- `src/editor2d/` محرر المخطط (React Konva).
- `src/render2d/` رسم المسقط العلوي المشترك بين المحرر وتصدير الصور.
- `src/scene3d/` المشهد ثلاثي الأبعاد (React Three Fiber) بخامات مولدة برمجياً.
- `src/store/` حالة التطبيق (Zustand) مع التراجع/الإعادة والحفظ التلقائي.

## النشر على Railway
المشروع جاهز للنشر مباشرة من GitHub (ملف `railway.json` موجود):
1. في Railway: New Project ← Deploy from GitHub repo ← اختر `al-enna-planner`.
2. بعد اكتمال النشر: Settings ← Networking ← Generate Domain للحصول على رابط عام.
أي تعديل يُرفع على فرع `main` يُنشر تلقائياً.

## البيع والدفع
- الخادم `server/index.mjs` يقدّم التطبيق + نظام أكواد الشراء + لوحة الإدارة على `/admin`.
- متغيرات Railway:
  - `LICENSE_SECRET` (إلزامي لتفعيل الحماية، 16 حرفاً عشوائياً على الأقل — لا تغيّره بعد البيع وإلا تبطل الأكواد)
  - `ADMIN_PASSWORD` كلمة مرور لوحة الإدارة
  - `PRICE` السعر بالريال (افتراضي 350)، `MAX_DEVICES` (افتراضي 3)
  - سكيب كاش: `SKIPCASH_CLIENT_ID`، `SKIPCASH_KEY_ID`، `SKIPCASH_KEY_SECRET`، `SKIPCASH_WEBHOOK_KEY`، `SKIPCASH_ENV` (`sandbox` أو `production`)
- اربط Volume على `/data` لحفظ قائمة العملاء بين عمليات النشر.
- في لوحة سكيب كاش: Return URL = `https://<الموقع>/?paid=1` و Webhook URL = `https://<الموقع>/api/skipcash/webhook`
