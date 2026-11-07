// صفحة سياسة الخصوصية (عربي + English) — تنعرض بدون تسجيل دخول
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function privacyPage({ support = '', address = '', cr = '', updated = '2026-11-07' } = {}) {
  const wa = support ? `https://wa.me/${String(support).replace(/\D/g, '')}` : '';
  const contactAr = support ? `واتساب: <a href="${wa}" dir="ltr">+${esc(support)}</a>` : 'من خلال زر «تواصل معنا» في الموقع';
  const contactEn = support ? `WhatsApp: <a href="${wa}">+${esc(support)}</a>` : 'via the “Contact us” link on the website';
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>سياسة الخصوصية — مخطط العنة | Privacy Policy</title>
<meta name="description" content="سياسة الخصوصية لموقع مخطط العنة i3enna.qa">
<link rel="canonical" href="https://www.i3enna.qa/privacy">
<style>
*{box-sizing:border-box}body{margin:0;background:#f6f4ef;color:#1f1a14;font:16px/1.8 'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif}
header{background:#3b2a1e;color:#f5ecda;padding:18px 16px}header a{color:#ecc97f;text-decoration:none;font-weight:700}
main{max-width:760px;margin:0 auto;padding:20px 16px 48px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 6px;color:#3b2a1e}
.muted{color:#6f6455;font-size:13px}.card{background:#fff;border:1px solid #ebe5d8;border-radius:14px;padding:18px 20px;margin-top:16px}
ul{padding-inline-start:22px;margin:6px 0}li{margin:4px 0}a{color:#8a6420}
.en{direction:ltr;text-align:left}hr{border:0;border-top:1px solid #ebe5d8;margin:32px 0}
</style></head><body>
<header><a href="/">⛺ مخطط العنة</a> <span class="muted" style="color:#bfae93">· i3enna.qa</span></header>
<main>
<div class="card">
<h1>سياسة الخصوصية</h1>
<div class="muted">آخر تحديث: ${esc(updated)}</div>

<h2>من نحن</h2>
<p>موقع «مخطط العنة» (i3enna.qa) تملكه وتشغّله <b>نقلة لحلول المواقع (Naqla For Website Solutions)</b>${address ? `، وعنوانها: ${esc(address)}` : ''}${cr ? `، سجل تجاري رقم ${esc(cr)}` : ''}. للتواصل في أي شي يخص بياناتك: ${contactAr}.</p>

<h2>البيانات اللي نجمعها</h2>
<ul>
<li><b>عند الشراء:</b> الاسم، ورقم الجوال، والإيميل إذا كتبته، والمبلغ ورقم الطلب. الدفع يتم عن طريق <b>سكيب كاش (SkipCash)</b>، وبيانات البطاقة تدخلها في صفحتهم مباشرة، <b>وإحنا ما نشوفها ولا نحفظها</b>.</li>
<li><b>الترخيص:</b> كود التفعيل، ومعرّف عشوائي لكل جهاز (عشان حد الأجهزة)، ورقم الجوال وكلمة المرور إذا اخترت الدخول فيهم. كلمة المرور تنحفظ مشفّرة.</li>
<li><b>الملاحظات:</b> نص الملاحظة اللي ترسلها من داخل البرنامج.</li>
<li><b>تصاميمك:</b> تنحفظ في <b>جهازك ومتصفحك فقط</b>، وما توصل خوادمنا إلا إذا صدّرتها أو شاركت رابطها بنفسك.</li>
</ul>

<h2>الإعلانات وقياسها (بكسل ميتا)</h2>
<p>نستخدم «بكسل ميتا» وواجهة التحويلات (Conversions API) من شركة Meta لقياس أداء إعلاناتنا على فيسبوك وإنستقرام وتحسينها. نجمع بهالطريقة معلومات عن زيارتك للموقع: الصفحات اللي فتحتها، وبدء التجربة، وبدء الدفع، وإتمام الشراء، وعنوان الجهاز ونوع المتصفح. ولما تشتري، نرسل رقم جوالك وإيميلك واسمك الأول <b>مشفّرة (SHA-256)</b> لميتا عشان تربط الشراء بالإعلان، و<b>ما نبيع بياناتك لأي جهة</b>. تقدر توقف هالتتبع من إعدادات الإعلانات في حسابك على فيسبوك أو إنستقرام، أو من إعدادات الخصوصية في جوالك أو متصفحك.</p>

<h2>الكوكيز والتخزين في المتصفح</h2>
<p>نحفظ في متصفحك: تصاميمك، وحالة تسجيل الدخول، واللغة. وبكسل ميتا يحط كوكيز خاصة فيه (<span dir="ltr">_fbp / _fbc</span>) للقياس.</p>

<h2>ليش نستخدم بياناتك</h2>
<ul>
<li>إتمام الشراء، وإرسال الإيصال وكود التفعيل.</li>
<li>تشغيل الترخيص ومنع إساءة الاستخدام.</li>
<li>الرد على ملاحظاتك وطلبات الدعم.</li>
<li>قياس الإعلانات وتحسينها (حسب القسم اللي فوق).</li>
</ul>

<h2>مين يشوفها</h2>
<p>بس الجهات اللي نحتاجها للخدمة: <b>سكيب كاش</b> (الدفع)، و<b>Meta</b> (قياس الإعلانات)، و<b>Railway</b> (استضافة الخادم). ما نعطي بياناتك لأي أحد ثاني إلا لو طلب القانون.</p>

<h2>كم نحتفظ فيها</h2>
<p>نحتفظ ببيانات الشراء والترخيص طول ما الترخيص فعّال (مدى الحياة) وحسب ما يطلبه القانون للسجلات المالية. والنسخ الاحتياطية اليومية تنحذف تلقائياً بعد 14 يوم.</p>

<h2>حقوقك</h2>
<p>حسب قانون حماية خصوصية البيانات الشخصية في قطر (رقم 13 لسنة 2016)، لك الحق تطلب نسخة من بياناتك، أو تصحيحها، أو حذفها (إذا ما نحتاجها لسجل مالي)، أو تعترض على استخدامها للإعلانات. تواصل معنا: ${contactAr}.</p>
</div>

<hr>

<div class="card en" dir="ltr" lang="en">
<h1>Privacy Policy</h1>
<div class="muted">Last updated: ${esc(updated)}</div>
<h2>Who we are</h2>
<p>Al Enna Planner (i3enna.qa) is owned and operated by <b>Naqla For Website Solutions</b>${address ? `, ${esc(address)}` : ''}${cr ? `, CR ${esc(cr)}` : ''}. Contact: ${contactEn}.</p>
<h2>What we collect</h2>
<ul>
<li><b>Purchase:</b> name, phone number, email (optional), amount and order number. Payments are processed by <b>SkipCash</b>; card details are entered on their page and are <b>never seen or stored by us</b>.</li>
<li><b>License:</b> activation code, a random per-device ID (for the device limit), and your phone and password if you choose to sign in with them (passwords are stored hashed).</li>
<li><b>Feedback</b> you send from inside the app.</li>
<li><b>Your designs</b> are stored <b>only on your device/browser</b> unless you export or share them yourself.</li>
</ul>
<h2>Advertising measurement (Meta Pixel)</h2>
<p>We use the Meta Pixel and Conversions API to measure and improve our ads on Facebook and Instagram. This collects information about your visit (pages viewed, trial started, checkout started, purchase completed, device IP address and browser type). When you purchase, your phone number, email and first name are sent to Meta in <b>hashed form (SHA-256)</b> to match the purchase to an ad; we never sell your data. You can opt out via your Facebook/Instagram ad settings or your device/browser privacy settings.</p>
<h2>Cookies &amp; local storage</h2>
<p>We store your designs, sign-in state and language in your browser. The Meta Pixel sets its own cookies (_fbp / _fbc).</p>
<h2>Sharing</h2>
<p>Only with service providers we need: <b>SkipCash</b> (payments), <b>Meta</b> (ad measurement) and <b>Railway</b> (server hosting), or when required by law.</p>
<h2>Retention</h2>
<p>Purchase and license data are kept while the license is active (lifetime) and as required for financial records. Daily backups are deleted automatically after 14 days.</p>
<h2>Your rights</h2>
<p>Under Qatar’s Personal Data Privacy Protection Law (No. 13 of 2016) you may request a copy, correction or deletion of your data, or object to its use for advertising. Contact: ${contactEn}.</p>
</div>
<p class="muted" style="text-align:center;margin-top:24px"><a href="/">← الرجوع لمخطط العنة · Back to Al Enna Planner</a></p>
</main></body></html>`;
}
