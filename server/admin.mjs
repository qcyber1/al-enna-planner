import { REPORT_SECTION, REPORT_SCRIPT } from './adminReport.mjs';
// لوحة الإدارة والحسابات (صفحة واحدة بدون مكتبات)
export function adminPage({ licensing, maxDevices, persistent, skipcash }) {
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>لوحة التحكم — مخطط العنة</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#f6f4ef;--card:#fff;--ink:#1f1a14;--mute:#6f6455;--line:#ebe5d8;--brand:#3b2a1e;--gold:#c9973f;--gold-soft:#f7efdf;--ok:#2f7a3b;--ok-soft:#e8f4ea;--bad:#b42318;--bad-soft:#fdecea;--blue:#1d4f9c;--blue-soft:#e8effb;--r:12px}
*{box-sizing:border-box}[hidden]{display:none!important}html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif;-webkit-font-smoothing:antialiased}
.app{display:grid;grid-template-columns:240px 1fr;min-height:100%}
aside{background:var(--brand);color:#efe6d6;padding:18px 12px;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:4px}
.brand{display:flex;align-items:center;gap:10px;padding:4px 8px 18px;font-weight:700;font-size:16px}
.brand i{font-style:normal;width:34px;height:34px;border-radius:10px;background:var(--gold);display:grid;place-items:center;font-size:18px}
.brand small{display:block;font-weight:400;font-size:11px;color:#bfae93}
nav#tabs{display:flex;flex-direction:column;gap:2px}
nav#tabs button{all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;color:#d9ccb6;font-weight:500}
nav#tabs button:hover{background:rgba(255,255,255,.06);color:#fff}
nav#tabs button.on{background:rgba(255,255,255,.12);color:#fff;font-weight:600}
nav#tabs button .n{margin-inline-start:auto;background:var(--gold);color:var(--brand);border-radius:99px;font-size:11px;font-weight:700;padding:0 7px;min-width:20px;text-align:center}
nav#tabs button .n:empty{display:none}
nav#tabs #csv{margin-top:14px;border:1px solid rgba(255,255,255,.18);justify-content:center}
.side-foot{margin-top:auto;font-size:11px;color:#a8977c;padding:8px}
.main{min-width:0;padding:24px 28px 40px;display:grid;gap:18px;align-content:start;max-width:1250px;width:100%}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.top h1{margin:0;font-size:22px}.top p{margin:2px 0 0;color:var(--mute);font-size:13px}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:600;background:var(--card);border:1px solid var(--line)}
.chip::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--ok)}.chip.w::before{background:var(--gold)}.chip.x::before{background:var(--bad)}
.fs{display:grid;grid-template-columns:minmax(120px,190px) 1fr auto;gap:12px;align-items:center;font-size:13px}.fs .bar{height:26px;background:var(--gold-soft);border-radius:8px;overflow:hidden}.fs .bar i{display:block;height:100%;background:var(--gold);border-radius:8px;min-width:2px;transition:width .3s}.fs .v{font-variant-numeric:tabular-nums;white-space:nowrap;display:flex;gap:8px;align-items:baseline;min-width:150px}.fs .v small{color:var(--mute)}.fs.last .bar i{background:var(--ok)}@media(max-width:640px){.fs{grid-template-columns:1fr auto}.fs .bar{grid-column:1/-1;grid-row:2}}
.wa{display:inline-flex;align-items:center;gap:6px;margin-top:5px;padding:5px 12px;border-radius:99px;background:#e6f6ea;border:1px solid #b7e0c1;color:#0f6b36;font-weight:700;font-size:14px;text-decoration:none;font-variant-numeric:tabular-nums;letter-spacing:.3px;white-space:nowrap}.wa:hover{background:#d3efdb}.wa:active{transform:scale(.97)}.wa-bad{color:#b42318;font-weight:600;font-size:11px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:18px;min-width:0;box-shadow:0 1px 2px rgba(31,26,20,.04)}
.card-h{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
h3{margin:0;font-size:16px}.sub{color:var(--mute);font-size:13px;margin:4px 0 0}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
label{display:block;font-size:12px;font-weight:600;color:var(--mute);margin-bottom:5px}
input,select,textarea{width:100%;height:40px;border:1px solid var(--line);border-radius:10px;padding:0 12px;font:inherit;background:#fff;color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s}
textarea{height:auto;min-height:70px;padding:10px 12px;resize:vertical}
input:focus,select:focus,textarea:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(201,151,63,.18)}
button{height:36px;border:1px solid transparent;border-radius:9px;padding:0 14px;font:inherit;font-weight:600;font-size:13px;cursor:pointer;background:var(--brand);color:#fff;white-space:nowrap;transition:filter .15s}
button:hover{filter:brightness(1.08)}
.gold{background:var(--gold);color:#fff}.ghost{background:#fff;color:var(--ink);border-color:var(--line)}.ghost:hover{background:#faf7f1}.bad{background:var(--bad-soft);color:var(--bad)}.ok{background:var(--ok);color:#fff}
.alert{border-radius:var(--r);padding:12px 14px;font-size:13px;border:1px solid}
.warn{background:#fff8e6;border-color:#f1d48f}.good{background:var(--ok-soft);border-color:#bfe0c4}
.new{background:var(--ok-soft);border:1px solid #bfe0c4;border-radius:var(--r);padding:14px;margin-top:14px;display:grid;gap:10px}
.code{font-family:ui-monospace,Consolas,monospace;font-size:13px;font-weight:700;direction:ltr;display:inline-block;background:#f6f3ec;border-radius:6px;padding:1px 6px}
.stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.stat{display:flex;gap:12px;align-items:flex-start}
.stat .ic{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;font-size:18px;background:var(--gold-soft);flex:none}
.stat small{color:var(--mute);font-size:12px;display:block}.stat b{display:block;font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.3}
.tbl{overflow-x:auto;margin:0 -18px;padding:0 18px}
table{width:100%;border-collapse:collapse;min-width:760px}
th,td{padding:11px 10px;border-bottom:1px solid var(--line);text-align:right;font-size:13px;vertical-align:top}
th{font-size:11px;font-weight:600;color:var(--mute);text-transform:uppercase;letter-spacing:.02em;background:#faf8f3;position:sticky;top:0}
tbody tr:hover{background:#fcfbf8}td small{color:var(--mute)}
.row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:600}
.p-paid{background:var(--ok-soft);color:var(--ok)}.p-wait{background:var(--gold-soft);color:#8a6420}.p-bad{background:var(--bad-soft);color:var(--bad)}.p-ref{background:var(--blue-soft);color:var(--blue)}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.toolbar input{flex:1;min-width:180px}.toolbar select{max-width:180px}
.fb{border:1px solid var(--line);border-radius:10px;padding:12px 14px;display:grid;gap:6px}
.fb.done{opacity:.55}.fb p{margin:0;white-space:pre-wrap}
.empty{color:var(--mute);text-align:center;padding:24px}
.preview{border:1px dashed var(--line);border-radius:10px;padding:12px;background:#fcfaf5;font-size:13px}
@media (max-width:900px){.app{grid-template-columns:1fr}aside{position:sticky;top:0;z-index:5;height:auto;flex-direction:row;align-items:center;padding:8px 10px;overflow-x:auto;gap:8px}.brand{padding:0 6px;font-size:14px;white-space:nowrap}.brand small,.side-foot{display:none}nav#tabs{flex-direction:row}nav#tabs button{white-space:nowrap;padding:7px 10px}nav#tabs #csv{margin:0}.main{padding:16px}}
</style></head><body>
<div class="app">
<aside>
  <div class="brand"><i>⛺</i><div>مخطط العنة<small>لوحة التحكم</small></div></div>
  <nav id="tabs">
    <button class="on" data-t="overview">📊 نظرة عامة</button>
    <button data-t="report">📄 التقارير</button>
    <button data-t="funnel">📈 مسار البيع</button>
    <button data-t="orders">🧾 الطلبات <span class="n" id="n_orders"></span></button>
    <button data-t="codes">👥 العملاء</button>
    <button data-t="refs">🎁 الإحالات <span class="n" id="n_refs"></span></button>
    <button data-t="feedback">💬 الملاحظات <span class="n" id="n_fb"></span></button>
    <button data-t="pricing">💰 الأسعار والعروض</button>
    <button data-t="content">✏️ نصوص الموقع</button>
    <button data-t="manual">🔑 أكواد يدوية</button>
    <button id="csv" type="button">⬇ تصدير المبيعات</button>
    <a href="/api/admin/backup" style="all:unset;cursor:pointer;display:flex;justify-content:center;padding:9px 12px;border-radius:10px;color:#d9ccb6;border:1px solid rgba(255,255,255,.18);margin-top:6px">💾 نسخة احتياطية كاملة</a>
  </nav>
  <button id="logout" type="button" class="ghost" style="margin-top:auto;background:transparent;color:#d9ccb6;border-color:rgba(255,255,255,.18)">⎋ تسجيل خروج</button>
  <div class="side-foot" style="margin-top:6px">كل كود: مدى الحياة • حتى ${maxDevices} أجهزة</div>
</aside>
<main class="main">
<div class="top">
  <div><h1 id="pt">نظرة عامة</h1><p id="ps">ملخص المبيعات والعملاء</p></div>
  <div class="chips">
    ${licensing ? '<span class="chip">الحماية مفعّلة</span>' : '<span class="chip x">الحماية معطلة</span>'}
    ${skipcash ? '<span class="chip' + (skipcash === 'production' ? '' : ' w') + '">سكيب كاش: ' + (skipcash === 'production' ? 'حقيقي' : 'تجريبي') + '</span>' : '<span class="chip w">الدفع يدوي</span>'}
    ${persistent ? '<span class="chip">البيانات محفوظة</span>' : '<span class="chip x">البيانات غير محفوظة</span>'}
  </div>
</div>
${licensing ? '' : '<div class="alert warn">⚠ الحماية معطلة: أضف المتغير <b>LICENSE_SECRET</b> في Railway (16 حرفاً على الأقل). حالياً التطبيق مفتوح للجميع.</div>'}
${skipcash ? '' : '<div class="alert warn">الدفع الإلكتروني غير مفعّل بعد (مفاتيح سكيب كاش). حالياً: العميل يطلب برقم جواله ← ترسل له رابط الدفع ← بعد ما تتأكد من وصول المبلغ تضغط «تم الدفع».</div>'}
${persistent ? '' : '<div class="alert warn">⚠ لم يتم ربط Volume على <b>/data</b> في Railway: سجل المبيعات يُمسح عند كل نشر جديد (الأكواد نفسها تبقى صالحة).</div>'}

<section data-p="overview" style="display:grid;gap:18px">
  <div class="stats">
    <div class="card stat"><span class="ic">💵</span><div><small>الإيراد المؤكد</small><b id="s_rev">0</b><small id="s_rev2"></small></div></div>
    <div class="card stat"><span class="ic">✅</span><div><small>مبيعات مدفوعة</small><b id="s_paid">0</b><small id="s_today"></small></div></div>
    <div class="card stat"><span class="ic">⏳</span><div><small>بانتظار الدفع</small><b id="s_wait">0</b></div></div>
    <div class="card stat"><span class="ic">🎁</span><div><small>مكافآت مستحقة</small><b id="s_owed">0</b><small id="s_refs"></small></div></div>
    <div class="card stat"><span class="ic">📱</span><div><small>أكواد مفعّلة</small><b id="s_act">0</b></div></div>
  </div>
  <div class="card" id="lost_card" hidden><div class="card-h"><div><h3>🔔 حاولوا يدفعون وما كمّلوا</h3><p class="sub">آخر 3 أيام — اضغط «💬 واتساب» وكلّمه، وبعدها «✅ تم التواصل» (اللي دفع بعدين يختفي من هنا)</p></div><div id="lost_sum"></div></div><div class="tbl"><table><thead><tr><th>العميل</th><th>المحاولات</th><th>آخر محاولة</th><th>السبب</th><th>الحالة</th><th></th></tr></thead><tbody id="ov_lost"></tbody></table></div></div>
  <div class="card"><div class="card-h"><h3>آخر الطلبات</h3><button class="ghost" type="button" data-go="orders">عرض الكل</button></div><div class="tbl"><table><thead><tr><th>العميل</th><th>التاريخ</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody id="ov_orders"></tbody></table></div></div>
  <div class="card"><div class="card-h"><h3>آخر الملاحظات</h3><button class="ghost" type="button" data-go="feedback">عرض الكل</button></div><div id="ov_fb"></div></div>
</section>

${REPORT_SECTION}
<section class="card" data-p="funnel" hidden>
  <div class="card-h"><div><h3>مسار البيع</h3><p class="sub">كم شخص وصل لكل خطوة — كل شخص ينحسب مرة وحدة في اليوم. أرقامنا من موقعنا مباشرة (بدون حظر إعلانات)، وما فيها التجارب ولا أصحاب الأكواد.</p></div>
  <div class="row"><select id="fprod" style="max-width:150px"><option value="enna">⛺ العنة</option><option value="izba">🏡 العزبة</option></select><select id="fd" style="max-width:150px"><option value="1">اليوم</option><option value="7" selected>آخر ٧ أيام</option><option value="30">آخر ٣٠ يوم</option><option value="90">آخر ٩٠ يوم</option></select></div></div>
  <div id="fl" style="display:grid;gap:10px"></div>
  <div id="fi" class="alert warn" style="margin-top:14px" hidden></div>
  <h3 style="margin:22px 0 10px">يوم بيوم</h3>
  <div class="tbl"><table><thead><tr><th>اليوم</th><th>زيارات</th><th>بدأ التجربة</th><th>خلّص التجربة</th><th>حاول يصدّر</th><th>ضغط «اشترِ»</th><th>عبّى وضغط ادفع</th><th>فتح صفحة الدفع</th><th>اشترى</th><th>الإيراد</th></tr></thead><tbody id="fb"></tbody></table></div>
</section>

<section class="card" data-p="orders" hidden>
  <div class="card-h"><div><h3>الطلبات والمدفوعات</h3><p class="sub">الطلبات الإلكترونية تتأكد تلقائياً من سكيب كاش</p></div><small id="oc" style="color:var(--mute)"></small></div>
  <div class="toolbar"><button id="testbuy" class="ghost" type="button">🧪 جرّب شاشة الشراء (بدون دفع)</button><small style="color:var(--mute)">تفتح نفس شاشة العميل بعد الدفع — ما تنحسب في المبيعات</small></div>
  <div class="toolbar"><input id="oq" placeholder="بحث بالاسم أو الرقم أو مرجع الدفع"><select id="of"><option value="">كل الحالات</option><option value="new">طلب جديد</option><option value="pending">بانتظار الدفع</option><option value="sent">أُرسل رابط الدفع</option><option value="paid">مدفوع</option><option value="cancelled">ملغي</option></select></div>
  <div class="toolbar"><div style="flex:1;min-width:220px"><label for="pl">رابط الدفع (للطلبات اليدوية فقط)</label><input id="pl" dir="ltr" placeholder="https://..."></div></div>
  <div class="tbl"><table><thead><tr><th>العميل</th><th>التاريخ</th><th>المبلغ</th><th>الحالة</th><th>مرجع الدفع</th><th></th></tr></thead><tbody id="ob"></tbody></table></div>
</section>

<section class="card" data-p="refs" hidden>
  <div class="card-h"><div><h3>الإحالات</h3><p class="sub">كل عميل عنده رابط خاص داخل التطبيق («ادعُ أصحابك»). صديقه ياخذ خصم، وصاحب الرابط يستحق مكافأة بعد ما يدفع صديقه.</p></div><button id="rcsv" class="ghost" type="button">⬇ تصدير المستحقين</button></div>
  <div class="tbl"><table><thead><tr><th>صاحب الرابط</th><th>عدد المشترين عن طريقه</th><th>المستحق</th><th>المدفوع له</th><th></th></tr></thead><tbody id="rb"></tbody></table></div>
</section>

<section class="card" data-p="codes" hidden>
  <div class="card-h"><div><h3>العملاء والأكواد</h3><p class="sub">🔑 = يدخل برقم جواله وكلمة المرور</p></div></div>
  <div class="toolbar"><input id="q" placeholder="بحث بالاسم أو الرقم أو الكود أو الملاحظة"></div>
  <div class="tbl"><table><thead><tr><th>العميل</th><th>الكود</th><th>التاريخ</th><th>المبلغ</th><th>الأجهزة</th><th>الحالة</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>
</section>

<section class="card" data-p="feedback" hidden>
  <div class="card-h"><div><h3>ملاحظات المستخدمين</h3><p class="sub">تجي من زر «أرسل ملاحظة» داخل التطبيق</p></div><select id="fbf" style="max-width:170px"><option value="open">الجديدة</option><option value="">الكل</option><option value="done">المنتهية</option></select></div>
  <div id="fbl" style="display:grid;gap:10px"></div>
</section>

<section class="card" data-p="pricing" hidden>
  <div class="card-h"><div><h3>الأسعار والعروض</h3><p class="sub">التغيير يطبّق فوراً على صفحة الشراء</p></div></div>
  <div class="grid">
    <div><label for="st_price">السعر الحالي (ر.ق)</label><input id="st_price" type="number" min="1" dir="ltr"></div>
    <div><label for="st_list">السعر قبل الخصم — 0 = بدون عرض</label><input id="st_list" type="number" min="0" dir="ltr"></div>
    <div><label for="st_rd">خصم الإحالة للمشتري (ر.ق)</label><input id="st_rd" type="number" min="0" dir="ltr"></div>
    <div><label for="st_rr">مكافأة صاحب الرابط (ر.ق)</label><input id="st_rr" type="number" min="0" dir="ltr"></div>
  </div>
  <h3 style="margin:18px 0 6px">🎁 عرض «خلصت التجربة»</h3>
  <p class="sub" style="margin:0 0 10px">اللي يخلّص التجربة المجانية يطلع له سعر خاص لوقت محدود. 0 = بدون عرض.</p>
  <div class="grid">
    <div><label for="st_offer">سعر العرض (ر.ق)</label><input id="st_offer" type="number" min="0" dir="ltr"></div>
    <div><label for="st_offer_min">مدة العرض (دقائق)</label><input id="st_offer_min" type="number" min="5" max="1440" dir="ltr"></div>
  </div>
  <h3 style="margin:18px 0 6px">📸 صور حقيقية بالذكاء الاصطناعي</h3>
  <p class="sub" style="margin:0 0 10px" id="ai_key_note"></p>
  <label style="display:flex;gap:8px;align-items:center;margin:0 0 12px;font-weight:700"><input id="st_ai_on" type="checkbox" style="width:auto"> 🚀 الخدمة شغّالة للعملاء</label>
  <div class="grid">
    <div><label for="st_ai_free">صور مجانية لكل عميل</label><input id="st_ai_free" type="number" min="0" max="50" dir="ltr"></div>
    <div><label for="st_ai_pack">عدد صور الباقة</label><input id="st_ai_pack" type="number" min="1" max="200" dir="ltr"></div>
    <div><label for="st_ai_price">سعر الباقة (ر.ق)</label><input id="st_ai_price" type="number" min="1" dir="ltr"></div>
    <div><label for="st_ai_cap">سقف المصروف اليومي (ر.ق) — حماية من الفاتورة</label><input id="st_ai_cap" type="number" min="1" dir="ltr"></div>
    <div><label for="st_ai_cost">تكلفة الصورة التقديرية (ر.ق)</label><input id="st_ai_cost" type="number" min="0.01" step="0.01" dir="ltr"></div>
  </div>
  <div class="preview" id="ai_stats" style="margin-top:8px"></div>
  <h3 style="margin:18px 0 6px">💳 عمولة سكيب كاش</h3>
  <p class="sub" style="margin:0 0 10px">اكتبها من عقدك مع سكيب كاش. ما تغيّر سعر العميل — بس عشان يطلع لك <b>الصافي</b> في الإيراد والتقارير (الدفع اليدوي ما عليه عمولة).</p>
  <div class="grid">
    <div><label for="st_fee_pct">النسبة من كل عملية (%)</label><input id="st_fee_pct" type="number" min="0" max="15" step="0.01" dir="ltr" placeholder="مثلاً 2.5"></div>
    <div><label for="st_fee_fixed">رسوم ثابتة لكل عملية (ر.ق) — 0 لو ما في</label><input id="st_fee_fixed" type="number" min="0" max="50" step="0.01" dir="ltr"></div>
  </div>
  <h3 style="margin:18px 0 6px">🏡 العزبة (منتج مستقل — www.i3enna.qa/izba)</h3>
  <p class="sub" style="margin:0 0 10px">بدون إحالة ولا عرض تجربة. «الترقية» سعر خاص لعميل العنة: تنضاف العزبة لنفس كوده.</p>
  <label style="display:flex;gap:8px;align-items:center;margin:0 0 12px;font-weight:700"><input id="st_izba_live" type="checkbox" style="width:auto"> 🚀 العزبة مطلقة للعملاء (صفحة /izba والبيع والترقية)</label>
  <p class="sub" style="margin:-6px 0 12px">مطفية = مخفية عن العملاء بالكامل. الفريق يجرّبها بكود من «أكواد يدوية» ← «العنة + العزبة».</p>
  <div class="grid">
    <div><label for="st_izba">سعر العزبة (ر.ق)</label><input id="st_izba" type="number" min="1" dir="ltr"></div>
    <div><label for="st_izba_list">قبل الخصم — 0 = بدون</label><input id="st_izba_list" type="number" min="0" dir="ltr"></div>
    <div><label for="st_izba_up">ترقية لعميل العنة (ر.ق)</label><input id="st_izba_up" type="number" min="1" dir="ltr"></div>
  </div>
  <div class="row" style="margin-top:14px;justify-content:space-between"><div class="preview" id="st_hint"></div><button id="st_save" class="ok" type="button">حفظ الأسعار</button></div>
</section>

<section class="card" data-p="content" hidden>
  <div class="card-h"><div><h3>نصوص صفحة الدخول والشراء</h3><p class="sub">اترك أي خانة فاضية عشان يرجع النص الأصلي</p></div></div>
  <div class="grid" style="grid-template-columns:1fr">
    <div><label for="c_banner">شريط إعلان فوق (اختياري) — مثل: عرض الإطلاق ينتهي الجمعة</label><input id="c_banner" maxlength="120"></div>
  </div>
  <div class="grid" style="margin-top:12px">
    <div><label for="c_title">العنوان</label><input id="c_title" maxlength="40" placeholder="مخطط العنة ⛺"></div>
    <div style="grid-column:span 2"><label for="c_tagline">الجملة تحت العنوان</label><input id="c_tagline" maxlength="140" placeholder="صمّم عنتك قبل لا تركّبها، واتفقوا على كل شي قبل ما تشترون"></div>
  </div>
  <div class="grid" style="margin-top:12px">
    <div><label for="c_f1">ميزة 1</label><input id="c_f1" maxlength="40" placeholder="🧊 مجسم 3D تتمشّى فيه"></div>
    <div><label for="c_f2">ميزة 2</label><input id="c_f2" maxlength="40" placeholder="🌙 إنارة الليل قبل الشراء"></div>
    <div><label for="c_f3">ميزة 3</label><input id="c_f3" maxlength="40" placeholder="✨ يولّد لك 5 أفكار توزيع"></div>
    <div><label for="c_f4">ميزة 4</label><input id="c_f4" maxlength="40" placeholder="📐 المقاسات والكميات محسوبة"></div>
  </div>
  <div class="grid" style="margin-top:12px">
    <div><label for="c_support">رقم واتساب الدعم (يطلع للعميل «تواصل معنا»)</label><input id="c_support" dir="ltr" maxlength="20" placeholder="55123456"></div>
  </div>
  <div class="grid" style="margin-top:12px">
    <div style="grid-column:span 2"><label for="c_sellerAddress">عنوان البائع (يطلع في إيصال العميل — مطلوب قانوناً)</label><input id="c_sellerAddress" maxlength="160" placeholder="الدوحة، قطر — المنطقة، الشارع، المبنى"></div>
    <div><label for="c_sellerCR">رقم السجل التجاري (اختياري)</label><input id="c_sellerCR" dir="ltr" maxlength="30"></div>
  </div>
  <div class="grid" style="margin-top:12px;grid-template-columns:1fr">
    <div><label for="c_buyNote">ملاحظة تحت زر الدفع</label><input id="c_buyNote" maxlength="160" placeholder="دفع آمن عبر سكيب كاش، والكود يظهر لك مباشرة بعد الدفع."></div>
  </div>
  <div class="row" style="margin-top:14px;justify-content:space-between"><small style="color:var(--mute)">الميزات: حط إيموجي في البداية ثم مسافة ثم النص.</small><div class="row"><a href="/" target="_blank"><button class="ghost" type="button">معاينة الموقع ↗</button></a><button id="c_save" class="ok" type="button">حفظ النصوص</button></div></div>
</section>

<section class="card" data-p="manual" hidden>
  <div class="card-h"><div><h3>أكواد يدوية</h3><p class="sub">هدية، دفع خارج الموقع، أو حسابات تجريبية للفريق (اكتب العدد)</p></div></div>
  <form id="f" class="grid">
    <div><label for="cname">الاسم</label><input id="cname" required placeholder="مثلاً: تجربة الفريق"></div>
    <div><label for="phone">رقم الواتساب</label><input id="phone" dir="ltr" placeholder="974xxxxxxxx"></div>
    <div><label for="price">المبلغ (ر.ق) — 0 للهدية/التجربة</label><input id="price" type="number" value="299" dir="ltr"></div>
    <div><label for="cnt">عدد الأكواد</label><input id="cnt" type="number" value="1" min="1" max="50" dir="ltr"></div>
    <div><label for="note">ملاحظة</label><input id="note"></div>
    <div><label for="cprod">المنتج</label><select id="cprod"><option value="enna">⛺ العنة فقط</option><option value="izba">🏡 العنة + العزبة</option></select></div>
    <div style="align-self:end"><button class="gold" style="width:100%;height:40px">توليد</button></div>
  </form><div id="out"></div>
</section>
</main></div>
<script>
let list=[],orders=[],refs=[],fbs=[],PRICE=299,REWARD=30;const MAX=${maxDevices};
const SCS={0:'جديد',1:'قيد الدفع',2:'مدفوع',3:'ملغي',4:'فشل',5:'مرفوض',6:'مسترجع'};
const ST={creating:'قيد الإنشاء',pending:'بانتظار الدفع',new:'طلب جديد',sent:'أُرسل رابط الدفع',paid:'مدفوع ✓',cancelled:'ملغي'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>(Math.round((n||0)*100)/100).toLocaleString('en-US')+' ر.ق';
const day=t=>t?new Date(t).toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'}):'';
async function api(p,b){const r=await fetch(p,b?{method:'POST',headers:{'content-type':'application/json','x-enna-admin':'1'},body:JSON.stringify(b)}:{});if(r.status===401){location.reload();throw new Error('انتهت الجلسة')}const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'خطأ');return j}
const msg=r=>'هلا '+(r.name||'')+' 👋\\nشكراً لاشتراكك في I3enna ⛺\\n\\nالرابط: '+location.origin+(hasIzba(r)?'/izba':'')+'\\nكود التفعيل: '+r.code+'\\n\\nالكود لك مدى الحياة ويعمل على '+MAX+' أجهزة.\\nوداخل التطبيق زر «ادعُ أصحابك» — كل واحد يشتري من رابطك تاخذ '+REWARD+' ريال 🎁';
const wa=(phone,text)=>'https://wa.me/'+waNum(phone)+'?text='+encodeURIComponent(text);
// رقم الواتساب: 8 أرقام = قطري (نضيف 974)
// نفس الشخص = آخر 8 أرقام من الجوال (عشان +974 / 974 / بدونها كلها تتطابق) + نفس المنتج
const pkey=(phone,prod)=>{const d=String(phone||'').replace(/\\D/g,'').slice(-8);return d.length===8?d+'|'+(prod==='izba'||prod==='photos'?prod:'enna'):''};
let PAID=new Map();
function buildPaid(){PAID=new Map();for(const o of orders)if(o.status==='paid'&&!o.test){const k=pkey(o.phone,o.product);if(k&&!PAID.has(k))PAID.set(k,o.no?'EN-'+o.no:'طلب مدفوع')}
  for(const r of list)if(!r.revoked&&r.phone)for(const pr of (Array.isArray(r.products)&&r.products.length?r.products:['enna'])){const k=pkey(r.phone,pr);if(k&&!PAID.has(k))PAID.set(k,'كود '+(r.code||''))}}
/** الطلب ما اندفع بس صاحبه دفع في طلب ثاني (أو عنده كود) — يرجع رقم الطلب المدفوع */
const paidElsewhere=o=>o.status!=='paid'&&o.status!=='cancelled'?PAID.get(pkey(o.phone,o.product))||'':'';
const waitingOrders=()=>orders.filter(o=>['pending','new','sent'].includes(o.status)&&!paidElsewhere(o));
const waNum=phone=>{const d=String(phone||'').replace(/\\D/g,'').replace(/^00/,'');return d.length===8?'974'+d:d};
// عرض الرقم واضح: +974 5512 3456
const fmtPhone=phone=>{const d=waNum(phone);if(!d)return '';if(d.length===11&&/^(974|965|973|968)/.test(d))return '+'+d.slice(0,3)+' '+d.slice(3,7)+' '+d.slice(7);if(d.length===12&&/^(966|971)/.test(d))return '+'+d.slice(0,3)+' '+d.slice(3,5)+' '+d.slice(5,8)+' '+d.slice(8);return '+'+d.replace(/(\\d{3})(?=\\d)/g,'$1 ').trim()};
// الرقم «مشكوك فيه»: مب قطري 8 أرقام ولا برمز دولة خليجي بطوله الصح
const okPhone=phone=>{const d=waNum(phone);return /^974[3567]\\d{7}$/.test(d)||/^965[4569]\\d{7}$/.test(d)||/^(973|968)\\d{8}$/.test(d)||/^(966|971)5\\d{8}$/.test(d)};
// زر واتساب واضح للرقم + تنبيه لو الرقم شكله غلط
// رسائل واتساب موحّدة باسم I3enna — عامة بدون تفاصيل (لو الرقم طلع لأحد ثاني ما ينحرج)
const WA_HI='السلام عليكم 🌴\\nمعكم فريق I3enna — www.i3enna.qa\\n';
const WA_UNPAID=WA_HI+'وصلنا طلب شراء من هالرقم وما اكتمل الدفع. إذا كنتم أنتم أصحاب الطلب يسعدنا نساعدكم تكملونه.\\nوإذا وصلتكم الرسالة بالغلط، نعتذر منكم 🙏';
// زر واتساب واضح للرقم + تنبيه لو الرقم شكله غلط (unpaid = طلب ما اكتمل دفعه)
const ph=(phone,unpaid)=>{if(!phone)return '';return '<a class="wa" href="'+wa(phone,unpaid?WA_UNPAID:WA_HI)+'" target="_blank" rel="noopener" dir="ltr" title="افتح محادثة واتساب">💬 '+esc(fmtPhone(phone))+'</a>'+(okPhone(phone)?'':'<br><small class="wa-bad">⚠ الرقم شكله غلط — تأكد منه</small>')};
const payMsg=o=>'هلا '+o.name+' 👋\\nشكراً لطلبك من I3enna ⛺\\nالمبلغ: '+(o.amount??PRICE)+' ر.ق — مدى الحياة\\n\\nرابط الدفع:\\n'+(pl.value||'[ضع رابط الدفع]')+'\\n\\nبعد الدفع يوصلك كود التفعيل هنا.';
const byId=id=>list.find(r=>r.id===id);
const isIzbaO=o=>o.product==='izba';
const isPhotosO=o=>o.product==='photos';
let FEE={pct:0,fixed:0};
const feeOf=o=>o.online&&o.status==='paid'&&!o.test?Math.round(((o.amount??PRICE)*FEE.pct/100+((o.amount??PRICE)>0?FEE.fixed:0))*100)/100:0;
const prodPill=o=>isPhotosO(o)?'<span class="pill p-ref">📸 باقة '+(o.photos||10)+' صور</span> ':isIzbaO(o)?'<span class="pill p-ref">🏡 '+(o.upgradeOf?'ترقية عزبة':'عزبة')+'</span> ':'';
const hasIzba=r=>Array.isArray(r.products)&&r.products.includes('izba');
function stats(){
  const paid=orders.filter(o=>o.status==='paid'&&!o.test);
  const manual=list.filter(r=>!r.test&&!orders.some(o=>o.codeId===r.id));
  const rev=paid.reduce((s,o)=>s+(o.amount??PRICE),0)+manual.reduce((s,r)=>s+(r.price||0),0);
  const owed=refs.filter(r=>!r.paidOut).reduce((s,r)=>s+r.reward,0);
  const today=new Date().toDateString();
  const izRev=paid.filter(isIzbaO).reduce((s,o)=>s+(o.amount??0),0);
  const fees=paid.reduce((s,o)=>s+feeOf(o),0);
  s_rev.textContent=money(rev);s_rev2.innerHTML=(FEE.pct||FEE.fixed?'<span style="color:#b42318">💳 عمولة سكيب كاش −'+money(fees)+'</span><br><strong style="font-size:13px;color:#1f7a3a">💵 الصافي '+money(rev-fees)+'</strong><br>':'<a href="#pricing" data-go="pricing" style="color:#b07d2a">حدد عمولة سكيب كاش عشان يطلع الصافي</a><br>')+'منها يدوي: '+money(manual.reduce((s,r)=>s+(r.price||0),0))+' • العزبة: '+money(izRev)+' ('+paid.filter(isIzbaO).length+')';
  s_paid.textContent=paid.length+manual.length;s_today.textContent='اليوم: '+paid.filter(o=>new Date(o.paidAt||o.createdAt).toDateString()===today).length;
  s_wait.textContent=waitingOrders().length;
  s_owed.textContent=money(owed);s_refs.textContent=refs.length+' عملية إحالة';
  s_act.textContent=list.filter(r=>r.devices.length).length+' / '+list.length;
  n_orders.textContent=waitingOrders().length||'';
  n_refs.textContent=refGroups().filter(x=>x.owed>0).length||'';
  n_fb.textContent=fbs.filter(f=>!f.done).length||'';
  renderLost();
  ov_orders.innerHTML=orders.slice(0,6).map(o=>'<tr><td>'+prodPill(o)+'<b>'+esc(o.name)+'</b><br>'+ph(o.phone,o.status!=='paid')+'</td><td>'+day(o.createdAt)+'</td><td>'+money(o.amount??PRICE)+'</td><td><span class="pill '+(o.status==='paid'?'p-paid':o.status==='cancelled'?'p-bad':'p-wait')+'">'+ST[o.status]+'</span></td></tr>').join('')||'<tr><td colspan="4" class="empty">لا توجد طلبات بعد</td></tr>';
  ov_fb.innerHTML=fbs.filter(f=>!f.done).slice(0,3).map(fbCard).join('')||'<div class="empty">ما في ملاحظات جديدة</div>';
}
function fbCard(f){return '<div class="fb'+(f.done?' done':'')+'"><div class="row" style="justify-content:space-between"><div><b>'+esc(f.name||'مستخدم')+'</b> '+ph(f.phone)+' <small>• '+day(f.at)+(f.where?' • '+esc(f.where):'')+'</small></div><div class="row">'+(f.phone?'<a href="'+wa(f.phone,'هلا '+(f.name||'')+' 👋 شكراً على ملاحظتك في مخطط العنة: ')+'" target="_blank"><button class="ghost" type="button">رد واتساب</button></a>':'')+'<button class="'+(f.done?'ghost':'ok')+'" type="button" data-fb="'+f.id+'" data-done="'+(f.done?0:1)+'">'+(f.done?'إرجاع':'تم ✓')+'</button><button class="bad" type="button" data-fb="'+f.id+'" data-rm="1">حذف</button></div></div><p>'+esc(f.text)+'</p></div>'}
function renderFb(){const m=fbf.value;const rows=fbs.filter(f=>!m||(m==='done'?f.done:!f.done));fbl.innerHTML=rows.map(fbCard).join('')||'<div class="empty">ما في ملاحظات</div>'}
const CK=['banner','title','tagline','f1','f2','f3','f4','buyNote','support','sellerAddress','sellerCR'];let cLoaded=false;
c_save.onclick=async()=>{const b={};for(const k of CK)b[k]=document.getElementById('c_'+k).value;try{await api('/api/admin/content',b);c_save.textContent='تم الحفظ ✓';setTimeout(()=>c_save.textContent='حفظ النصوص',1800)}catch(err){alert(err.message)}};
document.addEventListener('click',async e=>{const b=e.target.closest('[data-fb]');if(b){if(b.dataset.rm&&!confirm('حذف الملاحظة؟'))return;try{await api('/api/admin/feedback',{id:b.dataset.fb,done:b.dataset.done==='1',remove:!!b.dataset.rm});await load()}catch(err){alert(err.message)}return}const g=e.target.closest('[data-go]');if(g)go(g.dataset.go)});
fbf.onchange=renderFb;
// «حاول يدفع وما كمّل»: طلبات ما اندفعت آخر 3 أيام، مجمّعة حسب الرقم، وبدون اللي دفع بعدين
function renderLost(){const since=Date.now()-3*864e5;const g=new Map();
  for(const o of orders){if(o.test||o.status==='paid'||o.createdAt<since)continue;const k=waNum(o.phone);if(!k||paidElsewhere(o)||PAID.has(pkey(o.phone,o.product)))continue;const x=g.get(k)||{o,n:0,ids:[],last:0,err:'',done:true,at:0};x.n++;x.ids.push(o.id);if(o.createdAt>x.last){x.last=o.createdAt;x.o=o}if(o.lastError&&!x.err)x.err=o.lastError;if(!o.contactedAt)x.done=false;else x.at=Math.max(x.at,o.contactedAt);g.set(k,x)}
  const rows=[...g.values()].sort((a,b)=>(a.done-b.done)||b.last-a.last);lost_card.hidden=!rows.length;
  const todo=rows.filter(x=>!x.done).length;lost_sum.innerHTML=todo?'<span class="pill p-bad">🔴 '+todo+' ينتظرون تواصل</span> <span class="pill p-paid">✅ '+(rows.length-todo)+' تم</span>':'<span class="pill p-paid">✅ تواصلت مع الكل</span>';
  ov_lost.innerHTML=rows.map(x=>{const ids=x.ids.join(',');const why=x.err?'<span style="color:#b42318">رفضه نظام الدفع: '+esc(x.err)+'</span>':x.o.status==='pending'?'فتح صفحة الدفع وما كمّل':x.o.status==='new'?'طلب ينتظر رابط الدفع':'ما اكتمل';
   const st=x.done?'<span class="pill p-paid">✅ تواصلت'+(x.at?' — '+new Date(x.at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'')+'</span>':'<span class="pill p-bad">🔴 ما تواصلت</span>';
   const acts=x.done?'<button class="ghost" type="button" data-contacted="'+ids+'" data-undo="1" title="رجّعه لقائمة اللي ما تواصلت معهم">↩ تراجع</button>':'<a href="'+wa(x.o.phone,WA_UNPAID)+'" target="_blank" rel="noopener" data-waopen="'+ids+'"><button class="ghost" type="button">💬 واتساب</button></a><button class="ok" type="button" data-contacted="'+ids+'">✅ تم التواصل</button>';
   return '<tr data-lost="'+ids+'" style="'+(x.done?'background:#f1f8f2':'')+'"><td><b>'+esc(x.o.name)+'</b><br>'+ph(x.o.phone,true)+'</td><td><b>'+x.n+'</b></td><td>'+day(x.last)+'</td><td><small>'+why+'</small></td><td>'+st+'</td><td><div class="row" style="flex-wrap:nowrap">'+acts+'</div></td></tr>'}).join('')}
// بعد فتح الواتساب: نبرز زر «تم التواصل» عشان تتذكر تضغطه
document.addEventListener('click',e=>{const a=e.target.closest('[data-waopen]');if(!a)return;const tr=a.closest('tr');const b=tr&&tr.querySelector('[data-contacted]:not([data-undo])');if(b){b.style.boxShadow='0 0 0 3px #f5c451';b.textContent='✅ كلّمته؟ اضغط هنا'}});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-contacted]');if(!b)return;const undo=!!b.dataset.undo;const ids=b.dataset.contacted.split(',');
  // يتغير فوراً (قبل رد السيرفر) عشان تشوف إن الضغطة وصلت
  const tr=b.closest('tr');if(tr){tr.style.transition='background .3s';tr.style.background=undo?'':'#dff3e3'}b.disabled=true;b.textContent=undo?'…':'✓ تم';
  try{await api('/api/admin/contacted',{ids,undo});for(const o of orders)if(ids.includes(o.id))o.contactedAt=undo?undefined:Date.now();renderLost();toast(undo?'رجع لقائمة اللي ما تواصلت معهم':'تم ✓ — انحفظ إنك تواصلت معه',undo?'':'ok')}catch(err){b.disabled=false;alert(err.message)}});
function toast(t,k){const d=document.createElement('div');d.textContent=t;d.style.cssText='position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:99;padding:10px 16px;border-radius:12px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.18);background:'+(k==='ok'?'#1f7a3a':'#3b2a1e')+';color:#fff';document.body.appendChild(d);setTimeout(()=>d.remove(),2200)}
function renderOrders(){const q=oq.value.trim(),fs=of.value;const rows=orders.filter(o=>(!fs||o.status===fs)&&(!q||[o.name,o.phone,o.paymentId,o.no?'EN-'+o.no:''].join(' ').includes(q)));oc.textContent=rows.length+' من '+orders.length;ob.innerHTML=rows.map(o=>{const c=o.codeId&&byId(o.codeId);const ref=prodPill(o)+(o.test?'<span class="pill p-wait">🧪 تجربة</span> ':'')+(o.ref?'<span class="pill p-ref">بإحالة من '+esc(byId(o.ref)?.name||o.ref)+'</span>':'');
  const st=paidElsewhere(o)?'<span class="pill p-paid">مكرر — دفع في طلب ثاني</span>':'<span class="pill '+(o.status==='paid'?'p-paid':o.status==='cancelled'?'p-bad':'p-wait')+'">'+ST[o.status]+'</span>';
  const pe=paidElsewhere(o);
  const acts=pe?'<span class="pill p-paid">✅ دفع في '+esc(pe)+'</span><button class="ghost" type="button" data-o="'+o.id+'" data-s="cancelled" title="طلب مكرر — يختفي من بانتظار الدفع">إلغاء المكرر</button>':o.status==='paid'?(c?'<a href="'+wa(c.phone,msg(c))+'" target="_blank"><button class="gold" type="button">إرسال الكود واتساب</button></a>':''):o.status==='cancelled'?'':
   (o.online?'<button class="ghost" type="button" data-o="'+o.id+'" data-s="check">تحقق من الدفع</button>':'<a href="'+wa(o.phone,payMsg(o))+'" target="_blank" data-o="'+o.id+'" data-s="sent"><button class="ghost" type="button">إرسال رابط الدفع</button></a>')+
   '<button class="ok" type="button" data-o="'+o.id+'" data-s="paid">تم الدفع ← توليد الكود</button><button class="bad" type="button" data-o="'+o.id+'" data-s="cancelled">إلغاء</button>';
  return '<tr><td>'+(o.no?'<span class="code">EN-'+o.no+'</span> ':'')+'<b>'+esc(o.name)+'</b><br>'+ph(o.phone,o.status!=='paid')+' '+ref+'</td><td>'+day(o.createdAt)+(o.paidAt?'<br><small>دُفع: '+day(o.paidAt)+'</small>':'')+'</td><td>'+money(o.amount??PRICE)+(feeOf(o)?'<br><small title="بعد عمولة سكيب كاش">صافي '+money((o.amount??PRICE)-feeOf(o))+'</small>':'')+'</td><td>'+st+'<br><small>'+(o.online?'سكيب كاش':'يدوي')+(o.offer?' • 🎁 عرض التجربة':'')+'</small></td><td><small dir="ltr">'+esc(o.paymentId||'—')+'</small>'+(o.skipcashStatus!=null?'<br><small>سكيب كاش: '+esc(SCS[o.skipcashStatus]||('حالة '+o.skipcashStatus))+'</small>':'')+(o.lastError?'<br><small style="color:#b42318">خطأ الربط: '+esc(o.lastError)+'</small>':'')+(o.review?'<br><small style="color:#b42318;font-weight:700">⚠ يحتاج مراجعة: '+esc(o.review)+(o.skipcashAmount!=null?' — المبلغ من سكيب كاش: '+esc(o.skipcashAmount):'')+'. تأكد من بوابة سكيب كاش وبعدها اضغط «تم الدفع».</small>':'')+'</td><td><div class="row">'+acts+'</div></td></tr>'}).join('')||'<tr><td colspan="6">'+(orders.length?'ما في نتائج للبحث':'لا توجد طلبات بعد')+'</td></tr>'}
function refGroups(){const g={};for(const r of refs){(g[r.refId]??={id:r.refId,n:0,owed:0,paid:0,buyers:[]});g[r.refId].n++;g[r.refId].buyers.push(r.buyer);if(r.paidOut)g[r.refId].paid+=r.reward;else g[r.refId].owed+=r.reward}return Object.values(g)}
function refMsg(c,x){return 'هلا '+(c?.name||'')+' 👋\\nشكراً إنك نشرت مخطط العنة 🙏\\nعن طريق رابطك اشترى '+x.n+' — لك مكافأة '+x.owed+' ر.ق، بنحوّلها لك اليوم.'}
function renderRefs(){
  rb.innerHTML=refGroups().sort((a,b)=>b.owed-a.owed).map(x=>{const c=byId(x.id);return '<tr><td><b>'+esc(c?.name||x.id)+'</b><br>'+ph(c?.phone)+'</td><td>'+x.n+'<br><small>'+esc(x.buyers.join('، '))+'</small></td><td><b>'+money(x.owed)+'</b></td><td>'+money(x.paid)+'</td><td><div class="row">'+(x.owed&&c?.phone?'<a href="'+wa(c.phone,refMsg(c,x))+'" target="_blank"><button class="gold" type="button">واتساب</button></a>':'')+(x.owed?'<button class="ok" type="button" data-r="'+x.id+'">تم الدفع له</button>':'✓')+'</div></td></tr>'}).join('')||'<tr><td colspan="5">لا توجد إحالات بعد</td></tr>'}
function renderCodes(){const q=document.getElementById('q').value.trim();const rows=list.filter(r=>!q||[r.name,r.phone,r.code,r.note].join(' ').includes(q));
  tb.innerHTML=rows.map(r=>'<tr><td><b>'+esc(r.name||'—')+'</b><br>'+ph(r.phone)+' <small>'+esc(r.note)+'</small></td><td><span class="code">'+esc(r.code||r.id)+'</span>'+(r.hasPw?' <small title="يدخل برقم الجوال وكلمة المرور">🔑</small>':'')+'<br><span class="pill p-paid">⛺ عنة</span>'+(hasIzba(r)?' <span class="pill p-ref">🏡 عزبة</span>':'')+'</td><td>'+day(r.createdAt)+'</td><td>'+money(r.price)+'</td><td>'+r.devices.length+' / '+MAX+'</td><td>'+(r.revoked?'<span class="pill p-bad">موقوف</span>':r.devices.length?'<span class="pill p-paid">مفعّل</span>':'<span class="pill p-wait">لم يُفعّل</span>')+'</td><td><div class="row">'+(r.code&&r.phone?'<a href="'+wa(r.phone,msg(r))+'" target="_blank"><button class="gold" type="button">واتساب</button></a>':'')+'<button class="ghost" type="button" data-a="reset" data-id="'+r.id+'">تصفير الأجهزة</button>'+(hasIzba(r)?'<button class="ghost" type="button" data-a="remove-izba" data-id="'+r.id+'">شيل العزبة</button>':'<button class="ghost" type="button" data-a="add-izba" data-id="'+r.id+'">+ فعّل العزبة</button>')+(r.hasPw?'<button class="ghost" type="button" data-a="resetpw" data-id="'+r.id+'">مسح كلمة المرور</button>':'')+(r.revoked?'<button class="ghost" type="button" data-a="restore" data-id="'+r.id+'">إعادة تفعيل</button>':'<button class="bad" type="button" data-a="revoke" data-id="'+r.id+'">إيقاف</button>')+'</div></td></tr>').join('')||'<tr><td colspan="7">لا يوجد عملاء بعد</td></tr>'}
function stHint(){const p=+st_price.value||0,l=+st_list.value||0,d=+st_rd.value||0,o=+st_offer.value||0;st_hint.textContent='العميل يشوف: '+(l>p?l+' ← ':'')+p+' ر.ق • بالإحالة: '+Math.max(0,p-d)+' ر.ق'+(o>0&&o<p?' • بعد التجربة: '+o+' ر.ق لمدة '+(+st_offer_min.value||60)+' دقيقة':'')+' • العزبة: '+((+st_izba_list.value||0)>(+st_izba.value||0)?st_izba_list.value+' ← ':'')+(st_izba.value||'—')+' ر.ق (ترقية '+(st_izba_up.value||'—')+')'+(st_izba_live.checked?' — مطلقة 🚀':' — مخفية عن العملاء')}
for(const el of [st_price,st_list,st_rd,st_rr,st_offer,st_offer_min,st_izba,st_izba_list,st_izba_up,st_izba_live])el.oninput=stHint;
st_save.onclick=async()=>{try{await api('/api/admin/settings',{price:st_price.value,listPrice:st_list.value||0,refDiscount:st_rd.value,refReward:st_rr.value,offerPrice:st_offer.value||0,offerMinutes:st_offer_min.value||60,izbaPrice:st_izba.value,izbaListPrice:st_izba_list.value||0,izbaUpgrade:st_izba_up.value,izbaLive:st_izba_live.checked,skipcashFeePct:st_fee_pct.value||0,skipcashFeeFixed:st_fee_fixed.value||0,aiOn:st_ai_on.checked,aiFree:st_ai_free.value,aiPackSize:st_ai_pack.value,aiPackPrice:st_ai_price.value,aiDailyCap:st_ai_cap.value,aiCost:st_ai_cost.value});st_save.textContent='تم الحفظ ✓';setTimeout(()=>st_save.textContent='حفظ الأسعار',1800);await load()}catch(err){alert(err.message)}};
let stLoaded=false;
async function load(){const j=await api('/api/admin/list');if(j.settings&&!stLoaded){stLoaded=true;st_price.value=j.settings.price;st_list.value=j.settings.listPrice||0;st_rd.value=j.settings.refDiscount;st_rr.value=j.settings.refReward;st_offer.value=j.settings.offerPrice??249;st_offer_min.value=j.settings.offerMinutes??60;st_izba.value=j.settings.izbaPrice??499;st_izba_list.value=j.settings.izbaListPrice||0;st_izba_up.value=j.settings.izbaUpgrade??299;st_izba_live.checked=!!j.settings.izbaLive;st_fee_pct.value=j.settings.skipcashFeePct||'';st_ai_on.checked=!!j.settings.aiOn;st_ai_free.value=j.settings.aiFree??3;st_ai_pack.value=j.settings.aiPackSize??10;st_ai_price.value=j.settings.aiPackPrice??19;st_ai_cap.value=j.settings.aiDailyCap??20;st_ai_cost.value=j.settings.aiCost??0.25;st_fee_fixed.value=j.settings.skipcashFeeFixed||0;stHint()}list=j.list;orders=j.orders||[];refs=j.referrals||[];fbs=j.feedback||[];if(j.content&&!cLoaded){cLoaded=true;for(const k of CK)document.getElementById('c_'+k).value=j.content[k]||''}PRICE=j.price||299;if(j.settings){const a=j.settings.aiStats||{};ai_key_note.innerHTML=j.settings.aiKey?'✓ مفتاح OpenAI موجود في Railway':'<b style="color:#b42318">⚠ ما في مفتاح — أضف OPENAI_API_KEY في Railway ← Variables (والخدمة تظل مطفية لين يوصل)</b>';ai_stats.textContent='اليوم: '+(a.today||0)+' صورة • هالشهر: '+(a.month||0)+' صورة ≈ '+(a.monthCost||0)+' ر.ق'+(a.failed?' • فشلت '+a.failed+' (ما انخصمت)':'')}if(j.settings)FEE={pct:+j.settings.skipcashFeePct||0,fixed:+j.settings.skipcashFeeFixed||0};REWARD=j.refReward??50;if(!pl.value)pl.value=localStorage.getItem('pl')||j.paymentLink||'';buildPaid();stats();renderOrders();renderRefs();renderCodes();renderFb()}
pl.onchange=()=>localStorage.setItem('pl',pl.value);
q.oninput=renderCodes;
oq.oninput=renderOrders;of.onchange=renderOrders;
rcsv.onclick=()=>{const rows=[['صاحب الرابط','الجوال','الكود','عدد المشترين','المشترين','المستحق (ر.ق)','المدفوع له سابقاً (ر.ق)']];
  for(const x of refGroups().filter(x=>x.owed>0).sort((a,b)=>b.owed-a.owed)){const c=byId(x.id);rows.push([c?.name||x.id,c?.phone||'',c?.code||x.id,x.n,x.buyers.join('، '),x.owed,x.paid])}
  if(rows.length===1)return alert('ما في مكافآت مستحقة حالياً ✓');
  const s='\\ufeff'+rows.map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(',')).join('\\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([s],{type:'text/csv'}));a.download='al-enna-referrals-due-'+new Date().toISOString().slice(0,10)+'.csv';a.click()};
const TT={overview:['نظرة عامة','ملخص المبيعات والعملاء'],report:['التقارير','تقرير يومي أو لأي فترة — للشركاء'],funnel:['مسار البيع','وين يوقف الناس قبل ما يشترون'],orders:['الطلبات','كل طلبات الشراء وحالة الدفع'],codes:['العملاء','الأكواد والأجهزة وكلمات المرور'],refs:['الإحالات','مين جاب عملاء ومكافآتهم'],feedback:['الملاحظات','آراء المستخدمين والفريق'],pricing:['الأسعار والعروض','السعر والخصومات'],content:['نصوص الموقع','عدّل كلام صفحة الدخول والشراء'],manual:['أكواد يدوية','هدايا وحسابات تجريبية']};
function go(t){if(!TT[t])t='overview';for(const x of tabs.querySelectorAll('button[data-t]'))x.classList.toggle('on',x.dataset.t===t);for(const s of document.querySelectorAll('[data-p]'))s.hidden=s.dataset.p!==t;pt.textContent=TT[t][0];ps.textContent=TT[t][1];if(t==='funnel')loadFunnel().catch(()=>{});if(t==='report')rpLoad().catch(()=>{});if(location.hash!=='#'+t)history.replaceState(null,'','#'+t);window.scrollTo(0,0)}
${REPORT_SCRIPT}
const FST=[['visit','👀 زار صفحة الشراء'],['trial_start','▶️ بدأ التجربة المجانية'],['trial_end','⏱ خلّص التجربة'],['demo_buy_click','🛒 ضغط «اشترِ» من التجربة'],['checkout_click','📝 عبّى بياناته وضغط ادفع'],['checkout','💳 وصل صفحة الدفع'],['purchase','✅ اشترى']];
const pct=(a,b)=>b?Math.round(a/b*1000)/10+'%':'—';
async function loadFunnel(){const d=await api('/api/admin/funnel?days='+fd.value+'&product='+fprod.value);const t=d.total,top=Math.max(1,t.visit);
fl.innerHTML=FST.map(([k,l],i)=>{const v=t[k],prev=i?t[FST[i-1][0]]:0;return '<div class="fs'+(k==='purchase'?' last':'')+'"><span>'+l+'</span><div class="bar"><i style="width:'+Math.min(100,v/top*100)+'%"></i></div><span class="v"><b>'+v+'</b><small>'+(i?pct(v,prev)+' من اللي قبله':'100%')+'</small></span></div>'}).join('')+'<div class="fs"><span>🚫 حاول يصدّر وهو بالتجربة</span><div class="bar"><i style="width:'+Math.min(100,t.export_blocked/top*100)+'%"></i></div><span class="v"><b>'+t.export_blocked+'</b><small>'+pct(t.export_blocked,t.trial_start)+' من المجرّبين</small></span></div><p class="sub" style="margin:6px 0 0">الإيراد في الفترة: <b>'+t.revenue+' ر.ق</b> — تحويل الزوار لمشترين: <b>'+pct(t.purchase,t.visit)+'</b></p>';
let worst=null;for(let i=1;i<FST.length;i++){const a=t[FST[i-1][0]],b=t[FST[i][0]];if(a>=10){const r=b/a;if(!worst||r<worst.r)worst={r,a,from:FST[i-1][1],to:FST[i][1],lost:Math.max(0,a-b)}}}
fi.hidden=!worst;if(worst)fi.innerHTML='💡 أكبر تسرّب: بين «'+esc(worst.from)+'» و«'+esc(worst.to)+'» — راح <b>'+worst.lost+'</b> شخص ('+pct(worst.lost,worst.a)+'). هذي الخطوة اللي لو حسّنتها تفرق أكثر شي.';
fb.innerHTML=d.days.slice().reverse().map(r=>'<tr><td>'+r.day+'</td><td>'+r.visit+'</td><td>'+r.trial_start+'</td><td>'+r.trial_end+'</td><td>'+r.export_blocked+'</td><td>'+r.demo_buy_click+'</td><td>'+r.checkout_click+'</td><td>'+r.checkout+'</td><td><b>'+r.purchase+'</b></td><td>'+r.revenue+'</td></tr>').join('')}
cprod.onchange=()=>{price.value=cprod.value==='izba'?(+st_izba.value||499):PRICE};
fd.onchange=fprod.onchange=()=>loadFunnel().catch(e=>alert(e.message));
tabs.onclick=e=>{const b=e.target.closest('button[data-t]');if(b)go(b.dataset.t)};
go(location.hash.slice(1));
ob.onclick=async e=>{const t=e.target.closest('[data-o]');if(!t)return;
  if(t.dataset.s==='paid'&&!confirm('متأكد إن المبلغ وصلك؟ بيتولّد كود للعميل.'))return;
  try{const r=await api('/api/admin/order',{id:t.dataset.o,status:t.dataset.s});await load();if(t.dataset.s==='paid'&&r.code&&r.code.phone)window.open(wa(r.code.phone,msg(r.code)),'_blank');if(t.dataset.s==='check')alert(r.order.status==='paid'?'تم التأكد: مدفوع ✓':'الدفع ما اكتمل للحين')}catch(err){alert(err.message)}};
rb.onclick=async e=>{const b=e.target.closest('button[data-r]');if(!b)return;if(!confirm('تأكيد إنك حوّلت المكافأة؟'))return;try{await api('/api/admin/referral',{refId:b.dataset.r,paidOut:true});await load()}catch(err){alert(err.message)}};
tb.onclick=async e=>{const b=e.target.closest('button[data-a]');if(!b)return;if(b.dataset.a==='revoke'&&!confirm('إيقاف الكود؟ العميل ما بيقدر يدخل.'))return;if(b.dataset.a==='remove-izba'&&!confirm('شيل العزبة من هذا الكود؟'))return;if(b.dataset.a==='resetpw'&&!confirm('مسح كلمة المرور؟ العميل يدخل بالكود ويحط كلمة مرور جديدة.'))return;try{await api('/api/admin/update',{id:b.dataset.id,action:b.dataset.a});await load()}catch(err){alert(err.message)}};
f.onsubmit=async e=>{e.preventDefault();try{const{created}=await api('/api/admin/create',{name:cname.value,phone:phone.value,price:price.value,note:note.value,count:cnt.value,product:cprod.value});const r=created[0];if(created.length>1){const txt=created.map((c,i)=>(i+1)+') '+c.code).join('\\n');out.innerHTML='<div class="new"><div><b>'+created.length+' أكواد لـ '+esc(r.name)+'</b> '+(hasIzba(r)?'<span class="pill p-ref">⛺ عنة + 🏡 عزبة</span>':'<span class="pill p-paid">⛺ عنة فقط</span>')+' — كل واحد يكفي '+MAX+' أجهزة:</div><div style="display:grid;gap:4px">'+created.map(c=>'<span class="code">'+esc(c.code)+'</span>').join('')+'</div><div class="row"><button class="ghost" type="button" id="cp">نسخ كل الأكواد</button></div></div>';cp.onclick=()=>navigator.clipboard.writeText('مخطط العنة ⛺\\n'+location.origin+'\\n\\n'+txt).then(()=>cp.textContent='تم النسخ ✓');f.reset();price.value=PRICE;cnt.value=1;await load();return}
  out.innerHTML='<div class="new"><div>كود <b>'+esc(r.name)+'</b>: <span class="code">'+esc(r.code)+'</span> '+(hasIzba(r)?'<span class="pill p-ref">⛺ عنة + 🏡 عزبة</span>':'<span class="pill p-paid">⛺ عنة فقط</span>')+'</div><div class="row">'+(r.phone?'<a href="'+wa(r.phone,msg(r))+'" target="_blank"><button class="gold" type="button">إرسال واتساب</button></a>':'')+'<button class="ghost" type="button" id="cp">نسخ الرسالة</button></div></div>';
  cp.onclick=()=>navigator.clipboard.writeText(msg(r)).then(()=>cp.textContent='تم النسخ ✓');f.reset();price.value=PRICE;await load()}catch(err){alert(err.message)}};
csv.onclick=()=>{const rows=[['رقم الطلب','التاريخ','العميل','الجوال','المنتج','المبلغ','عمولة سكيب كاش','الصافي','الحالة','الطريقة','بإحالة من','مرجع الدفع','الكود']];
  for(const o of orders.filter(o=>!o.test))rows.push([o.no?'EN-'+o.no:'',day(o.paidAt||o.createdAt),o.name,o.phone,isPhotosO(o)?'باقة صور':isIzbaO(o)?(o.upgradeOf?'ترقية عزبة':'عزبة'):'عنة',o.amount??PRICE,feeOf(o),o.status==='paid'?(o.amount??PRICE)-feeOf(o):'',ST[o.status],o.online?'سكيب كاش':'يدوي',o.ref?(byId(o.ref)?.name||o.ref):'',o.paymentId||'',o.codeId?(byId(o.codeId)?.code||''):'']);
  for(const r of list)if(!orders.some(o=>o.codeId===r.id))rows.push(['',day(r.createdAt),r.name,r.phone,hasIzba(r)?'عنة+عزبة':'عنة',r.price||0,0,r.price||0,'مدفوع ✓','كود يدوي','','',r.code||'']);
  const s='\\ufeff'+rows.map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(',')).join('\\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([s],{type:'text/csv'}));a.download='al-enna-sales-'+new Date().toISOString().slice(0,10)+'.csv';a.click()};
testbuy.onclick=async()=>{try{const r=await api('/api/admin/test-order',{});window.open(r.url,'_blank');await load()}catch(err){alert(err.message)}};
logout.onclick=async()=>{await fetch('/api/admin/logout',{method:'POST',headers:{'x-enna-admin':'1'}});location.reload()};
load().catch(e=>alert(e.message));setInterval(()=>load().catch(()=>{}),30000);
</script></body></html>`;
}

/** صفحة دخول لوحة الإدارة */
export function adminLoginPage({ totp }) {
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>دخول لوحة التحكم — مخطط العنة</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#3b2a1e;font:15px/1.6 'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif;color:#1f1a14;padding:16px}
form{width:100%;max-width:380px;background:#fff;border-radius:16px;padding:28px;box-shadow:0 20px 50px rgba(0,0,0,.35);display:grid;gap:14px}
.b{display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px}.b i{font-style:normal;width:40px;height:40px;border-radius:12px;background:#c9973f;display:grid;place-items:center;font-size:20px}
.b small{display:block;font-weight:400;font-size:12px;color:#6f6455}
label{display:block;font-size:12px;font-weight:600;color:#6f6455;margin-bottom:5px}
input{width:100%;height:44px;border:1px solid #ebe5d8;border-radius:10px;padding:0 12px;font:inherit;outline:none}
input:focus{border-color:#c9973f;box-shadow:0 0 0 3px rgba(201,151,63,.18)}
button{height:44px;border:0;border-radius:10px;background:#3b2a1e;color:#fff;font:inherit;font-weight:700;cursor:pointer}
button:disabled{opacity:.6}.err{background:#fdecea;color:#b42318;border-radius:10px;padding:8px 12px;font-size:13px;display:none}
.note{font-size:11px;color:#8a7d6b;text-align:center;margin:0}
</style></head><body>
<form id="f" autocomplete="on">
  <div class="b"><i>⛺</i><div>مخطط العنة<small>دخول لوحة التحكم</small></div></div>
  <div><label for="u">اسم المستخدم</label><input id="u" name="username" autocomplete="username" dir="ltr" required></div>
  <div><label for="p">كلمة المرور</label><input id="p" name="password" type="password" autocomplete="current-password" dir="ltr" required></div>
  ${totp ? '<div><label for="c">رمز التحقق (Google Authenticator)</label><input id="c" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" required placeholder="123456"></div>' : ''}
  <div class="err" id="e"></div>
  <button id="go">دخول</button>
  <p class="note">🔒 بعد 20 محاولة غلط يتقفل الدخول 10 دقائق</p>
</form>
<script>
f.onsubmit=async ev=>{ev.preventDefault();go.disabled=true;e.style.display='none';
  try{const r=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({user:u.value,password:p.value,code:window.c?c.value:''})});
    const j=await r.json().catch(()=>({}));if(r.ok){location.reload();return}e.textContent=j.error||'ما قدرنا ندخلك';e.style.display='block'}
  catch{e.textContent='ما قدرنا نتصل';e.style.display='block'}go.disabled=false};
</script></body></html>`;
}
