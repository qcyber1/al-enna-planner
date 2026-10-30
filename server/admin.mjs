// لوحة الإدارة والحسابات (صفحة واحدة بدون مكتبات)
export function adminPage({ licensing, maxDevices, persistent, skipcash }) {
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>إدارة مخطط العنة</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5ecda;color:#3b2a1e;font:15px/1.6 'Segoe UI',Tahoma,sans-serif}
header{background:#3b2a1e;color:#f5ecda;padding:14px 16px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}
main{padding:16px;display:grid;gap:16px;max-width:1150px;margin:auto}
.card{background:#fff;border:1px solid #e6d7b8;border-radius:14px;padding:16px;min-width:0}
h3{margin:0 0 10px}
.grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
label{display:block;font-size:12px;color:#7a6248;margin-bottom:4px}
input{width:100%;height:40px;border:1px solid #e6d7b8;border-radius:10px;padding:0 10px;font:inherit}
button{height:36px;border:0;border-radius:10px;padding:0 12px;font:inherit;font-weight:600;cursor:pointer;background:#3b2a1e;color:#f5ecda;white-space:nowrap}
.gold{background:#d4a24c;color:#3b2a1e}.ghost{background:#f1e6cf;color:#3b2a1e}.bad{background:#a12a1f;color:#fff}.ok{background:#2f6220;color:#fff}
.warn{background:#fff4d6;border:1px solid #e9c46a;border-radius:12px;padding:10px 12px}
.good{background:#eef7e8;border:1px solid #b6d9a0;border-radius:12px;padding:10px 12px}
.new{background:#eef7e8;border:1px solid #b6d9a0;border-radius:12px;padding:12px;margin-top:12px;display:grid;gap:8px}
.code{font-family:Consolas,monospace;font-size:14px;font-weight:700;direction:ltr;display:inline-block}
.stats{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.stats b{display:block;font-size:22px;font-variant-numeric:tabular-nums}
.stats small{color:#7a6248}
.tbl{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:720px}th,td{padding:8px;border-bottom:1px solid #e6d7b8;text-align:right;font-size:14px;vertical-align:top}
th{font-size:12px;color:#7a6248}
.row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.pill{display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;font-weight:600}
.p-paid{background:#e3f1da;color:#2f6220}.p-wait{background:#f1e6cf;color:#7a6248}.p-bad{background:#f8dcd8;color:#a12a1f}.p-ref{background:#e6eefb;color:#1d4f9c}
.tabs{display:flex;gap:6px;flex-wrap:wrap}.tabs button{background:#f1e6cf;color:#3b2a1e}.tabs button.on{background:#3b2a1e;color:#f5ecda}
</style></head><body>
<header><b>⛺ إدارة مخطط العنة — الحسابات</b><span>كل كود: مدى الحياة • حتى ${maxDevices} أجهزة</span></header>
<main>
${licensing ? '' : '<div class="warn">⚠ الحماية معطلة: أضف المتغير <b>LICENSE_SECRET</b> في Railway (16 حرفاً على الأقل). حالياً التطبيق مفتوح للجميع.</div>'}
${skipcash ? '<div class="good">✓ الدفع الإلكتروني (سكيب كاش) مفعّل — البيئة: <b>' + (skipcash === 'production' ? 'حقيقي' : 'تجريبي (Sandbox)') + '</b>. الطلب يصير «مدفوع» تلقائياً فقط بعد ما يتأكد السيرفر من سكيب كاش.</div>' : '<div class="warn">الدفع الإلكتروني غير مفعّل بعد (مفاتيح سكيب كاش). حالياً: العميل يطلب برقم جواله ← ترسل له رابط الدفع ← بعد ما تتأكد من وصول المبلغ تضغط «تم الدفع».</div>'}
${persistent ? '' : '<div class="warn">⚠ لم يتم ربط Volume على <b>/data</b> في Railway: سجل المبيعات يُمسح عند كل نشر جديد (الأكواد نفسها تبقى صالحة).</div>'}

<section class="stats">
  <div class="card"><small>الإيراد المؤكد</small><b id="s_rev">0</b><small id="s_rev2"></small></div>
  <div class="card"><small>مبيعات مدفوعة</small><b id="s_paid">0</b><small id="s_today"></small></div>
  <div class="card"><small>طلبات بانتظار الدفع</small><b id="s_wait">0</b></div>
  <div class="card"><small>مكافآت إحالة مستحقة</small><b id="s_owed">0</b><small id="s_refs"></small></div>
  <div class="card"><small>أكواد مفعّلة</small><b id="s_act">0</b></div>
</section>

<div class="tabs" id="tabs">
  <button class="on" data-t="orders">الطلبات والمدفوعات</button>
  <button data-t="refs">الإحالات</button>
  <button data-t="codes">العملاء والأكواد</button>
  <button data-t="manual">كود يدوي</button>
  <button id="csv" class="gold" type="button">⬇ تصدير المبيعات (Excel)</button>
</div>

<section class="card" data-p="orders">
  <h3>الطلبات والمدفوعات</h3>
  <div class="row" style="margin-bottom:8px"><div style="flex:1;min-width:220px"><label for="pl">رابط الدفع (للطلبات اليدوية)</label><input id="pl" dir="ltr" placeholder="https://..."></div></div>
  <div class="tbl"><table><thead><tr><th>العميل</th><th>التاريخ</th><th>المبلغ</th><th>الحالة</th><th>مرجع الدفع</th><th></th></tr></thead><tbody id="ob"></tbody></table></div>
</section>

<section class="card" data-p="refs" hidden>
  <h3>الإحالات</h3>
  <p style="margin-top:0;color:#7a6248;font-size:13px">كل عميل عنده رابط خاص داخل التطبيق (زر «ادعُ أصحابك»). صديقه ياخذ خصم، وصاحب الرابط يستحق مكافأة بعد ما يدفع صديقه. ادفع له المكافأة (تحويل) ثم اضغط «تم الدفع له».</p>
  <div class="tbl"><table><thead><tr><th>صاحب الرابط</th><th>عدد المشترين عن طريقه</th><th>المستحق</th><th>المدفوع له</th><th></th></tr></thead><tbody id="rb"></tbody></table></div>
</section>

<section class="card" data-p="codes" hidden>
  <div class="row" style="justify-content:space-between"><h3 style="margin:0">العملاء والأكواد</h3><input id="q" placeholder="بحث بالاسم أو الرقم أو الكود" style="max-width:260px"></div>
  <div class="tbl"><table><thead><tr><th>العميل</th><th>الكود</th><th>التاريخ</th><th>المبلغ</th><th>الأجهزة</th><th>الحالة</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>
</section>

<section class="card" data-p="manual" hidden>
  <h3>كود يدوي (هدية أو دفع خارج الموقع)</h3>
  <form id="f" class="grid">
    <div><label for="name">اسم العميل</label><input id="name" required></div>
    <div><label for="phone">رقم الواتساب</label><input id="phone" dir="ltr" placeholder="974xxxxxxxx"></div>
    <div><label for="price">المبلغ (ر.ق) — 0 للهدية</label><input id="price" type="number" value="349" dir="ltr"></div>
    <div><label for="note">ملاحظة</label><input id="note"></div>
    <div style="align-self:end"><button class="gold">توليد الكود</button></div>
  </form><div id="out"></div>
</section>
</main>
<script>
let list=[],orders=[],refs=[],PRICE=349,REWARD=50;const MAX=${maxDevices};
const ST={pending:'بانتظار الدفع',new:'طلب جديد',sent:'أُرسل رابط الدفع',paid:'مدفوع ✓',cancelled:'ملغي'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>(Math.round((n||0)*100)/100).toLocaleString('en-US')+' ر.ق';
const day=t=>t?new Date(t).toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'}):'';
async function api(p,b){const r=await fetch(p,b?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}:{});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'خطأ');return j}
const msg=r=>'هلا '+(r.name||'')+' 👋\\nشكراً لاشتراكك في مخطط العنة ⛺\\n\\nالرابط: '+location.origin+'\\nكود التفعيل: '+r.code+'\\n\\nالكود لك مدى الحياة ويعمل على '+MAX+' أجهزة.\\nوداخل التطبيق زر «ادعُ أصحابك» — كل واحد يشتري من رابطك تاخذ '+REWARD+' ريال 🎁';
const wa=(phone,text)=>'https://wa.me/'+String(phone||'').replace(/\\D/g,'')+'?text='+encodeURIComponent(text);
const payMsg=o=>'هلا '+o.name+' 👋\\nشكراً لطلبك مخطط العنة ⛺\\nالمبلغ: '+(o.amount??PRICE)+' ر.ق — مدى الحياة\\n\\nرابط الدفع:\\n'+(pl.value||'[ضع رابط الدفع]')+'\\n\\nبعد الدفع يوصلك كود التفعيل هنا.';
const byId=id=>list.find(r=>r.id===id);
function stats(){
  const paid=orders.filter(o=>o.status==='paid');
  const manual=list.filter(r=>!orders.some(o=>o.codeId===r.id));
  const rev=paid.reduce((s,o)=>s+(o.amount??PRICE),0)+manual.reduce((s,r)=>s+(r.price||0),0);
  const owed=refs.filter(r=>!r.paidOut).reduce((s,r)=>s+r.reward,0);
  const today=new Date().toDateString();
  s_rev.textContent=money(rev);s_rev2.textContent='منها يدوي: '+money(manual.reduce((s,r)=>s+(r.price||0),0));
  s_paid.textContent=paid.length+manual.length;s_today.textContent='اليوم: '+paid.filter(o=>new Date(o.paidAt||o.createdAt).toDateString()===today).length;
  s_wait.textContent=orders.filter(o=>['pending','new','sent'].includes(o.status)).length;
  s_owed.textContent=money(owed);s_refs.textContent=refs.length+' عملية إحالة';
  s_act.textContent=list.filter(r=>r.devices.length).length+' / '+list.length;
}
function renderOrders(){ob.innerHTML=orders.map(o=>{const c=o.codeId&&byId(o.codeId);const ref=o.ref?'<span class="pill p-ref">بإحالة من '+esc(byId(o.ref)?.name||o.ref)+'</span>':'';
  const st='<span class="pill '+(o.status==='paid'?'p-paid':o.status==='cancelled'?'p-bad':'p-wait')+'">'+ST[o.status]+'</span>';
  const acts=o.status==='paid'?(c?'<a href="'+wa(c.phone,msg(c))+'" target="_blank"><button class="gold" type="button">إرسال الكود واتساب</button></a>':''):o.status==='cancelled'?'':
   (o.online?'<button class="ghost" type="button" data-o="'+o.id+'" data-s="check">تحقق من الدفع</button>':'<a href="'+wa(o.phone,payMsg(o))+'" target="_blank" data-o="'+o.id+'" data-s="sent"><button class="ghost" type="button">إرسال رابط الدفع</button></a>')+
   '<button class="ok" type="button" data-o="'+o.id+'" data-s="paid">تم الدفع ← توليد الكود</button><button class="bad" type="button" data-o="'+o.id+'" data-s="cancelled">إلغاء</button>';
  return '<tr><td><b>'+esc(o.name)+'</b><br><small dir="ltr">'+esc(o.phone)+'</small> '+ref+'</td><td>'+day(o.createdAt)+(o.paidAt?'<br><small>دُفع: '+day(o.paidAt)+'</small>':'')+'</td><td>'+money(o.amount??PRICE)+'</td><td>'+st+'<br><small>'+(o.online?'سكيب كاش':'يدوي')+'</small></td><td><small dir="ltr">'+esc(o.paymentId||'—')+'</small></td><td><div class="row">'+acts+'</div></td></tr>'}).join('')||'<tr><td colspan="6">لا توجد طلبات بعد</td></tr>'}
function renderRefs(){const g={};for(const r of refs){(g[r.refId]??={id:r.refId,n:0,owed:0,paid:0,buyers:[]});g[r.refId].n++;g[r.refId].buyers.push(r.buyer);if(r.paidOut)g[r.refId].paid+=r.reward;else g[r.refId].owed+=r.reward}
  rb.innerHTML=Object.values(g).sort((a,b)=>b.owed-a.owed).map(x=>{const c=byId(x.id);return '<tr><td><b>'+esc(c?.name||x.id)+'</b><br><small dir="ltr">'+esc(c?.phone||'')+'</small></td><td>'+x.n+'<br><small>'+esc(x.buyers.join('، '))+'</small></td><td><b>'+money(x.owed)+'</b></td><td>'+money(x.paid)+'</td><td>'+(x.owed?'<button class="ok" type="button" data-r="'+x.id+'">تم الدفع له</button>':'✓')+'</td></tr>'}).join('')||'<tr><td colspan="5">لا توجد إحالات بعد</td></tr>'}
function renderCodes(){const q=document.getElementById('q').value.trim();const rows=list.filter(r=>!q||[r.name,r.phone,r.code,r.note].join(' ').includes(q));
  tb.innerHTML=rows.map(r=>'<tr><td><b>'+esc(r.name||'—')+'</b><br><small dir="ltr">'+esc(r.phone)+'</small> <small>'+esc(r.note)+'</small></td><td><span class="code">'+esc(r.code||r.id)+'</span></td><td>'+day(r.createdAt)+'</td><td>'+money(r.price)+'</td><td>'+r.devices.length+' / '+MAX+'</td><td>'+(r.revoked?'<span class="pill p-bad">موقوف</span>':r.devices.length?'<span class="pill p-paid">مفعّل</span>':'<span class="pill p-wait">لم يُفعّل</span>')+'</td><td><div class="row">'+(r.code&&r.phone?'<a href="'+wa(r.phone,msg(r))+'" target="_blank"><button class="gold" type="button">واتساب</button></a>':'')+'<button class="ghost" type="button" data-a="reset" data-id="'+r.id+'">تصفير الأجهزة</button>'+(r.revoked?'<button class="ghost" type="button" data-a="restore" data-id="'+r.id+'">إعادة تفعيل</button>':'<button class="bad" type="button" data-a="revoke" data-id="'+r.id+'">إيقاف</button>')+'</div></td></tr>').join('')||'<tr><td colspan="7">لا يوجد عملاء بعد</td></tr>'}
async function load(){const j=await api('/api/admin/list');list=j.list;orders=j.orders||[];refs=j.referrals||[];PRICE=j.price||349;REWARD=j.refReward??50;if(!pl.value)pl.value=localStorage.getItem('pl')||j.paymentLink||'';stats();renderOrders();renderRefs();renderCodes()}
pl.onchange=()=>localStorage.setItem('pl',pl.value);
q.oninput=renderCodes;
tabs.onclick=e=>{const b=e.target.closest('button[data-t]');if(!b)return;for(const x of tabs.querySelectorAll('button[data-t]'))x.classList.toggle('on',x===b);for(const s of document.querySelectorAll('[data-p]'))s.hidden=s.dataset.p!==b.dataset.t};
ob.onclick=async e=>{const t=e.target.closest('[data-o]');if(!t)return;
  if(t.dataset.s==='paid'&&!confirm('متأكد إن المبلغ وصلك؟ بيتولّد كود للعميل.'))return;
  try{const r=await api('/api/admin/order',{id:t.dataset.o,status:t.dataset.s});await load();if(t.dataset.s==='paid'&&r.code&&r.code.phone)window.open(wa(r.code.phone,msg(r.code)),'_blank');if(t.dataset.s==='check')alert(r.order.status==='paid'?'تم التأكد: مدفوع ✓':'لم يكتمل الدفع بعد')}catch(err){alert(err.message)}};
rb.onclick=async e=>{const b=e.target.closest('button[data-r]');if(!b)return;if(!confirm('تأكيد إنك حوّلت المكافأة؟'))return;try{await api('/api/admin/referral',{refId:b.dataset.r,paidOut:true});await load()}catch(err){alert(err.message)}};
tb.onclick=async e=>{const b=e.target.closest('button[data-a]');if(!b)return;if(b.dataset.a==='revoke'&&!confirm('إيقاف الكود؟ العميل ما بيقدر يدخل.'))return;try{await api('/api/admin/update',{id:b.dataset.id,action:b.dataset.a});await load()}catch(err){alert(err.message)}};
f.onsubmit=async e=>{e.preventDefault();try{const{created}=await api('/api/admin/create',{name:name.value,phone:phone.value,price:price.value,note:note.value});const r=created[0];
  out.innerHTML='<div class="new"><div>كود <b>'+esc(r.name)+'</b>: <span class="code">'+esc(r.code)+'</span></div><div class="row">'+(r.phone?'<a href="'+wa(r.phone,msg(r))+'" target="_blank"><button class="gold" type="button">إرسال واتساب</button></a>':'')+'<button class="ghost" type="button" id="cp">نسخ الرسالة</button></div></div>';
  cp.onclick=()=>navigator.clipboard.writeText(msg(r)).then(()=>cp.textContent='تم النسخ ✓');f.reset();price.value=349;await load()}catch(err){alert(err.message)}};
csv.onclick=()=>{const rows=[['التاريخ','العميل','الجوال','المبلغ','الحالة','الطريقة','بإحالة من','مرجع الدفع','الكود']];
  for(const o of orders)rows.push([day(o.paidAt||o.createdAt),o.name,o.phone,o.amount??PRICE,ST[o.status],o.online?'سكيب كاش':'يدوي',o.ref?(byId(o.ref)?.name||o.ref):'',o.paymentId||'',o.codeId?(byId(o.codeId)?.code||''):'']);
  for(const r of list)if(!orders.some(o=>o.codeId===r.id))rows.push([day(r.createdAt),r.name,r.phone,r.price||0,'مدفوع ✓','كود يدوي','','',r.code||'']);
  const s='\\ufeff'+rows.map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(',')).join('\\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([s],{type:'text/csv'}));a.download='al-enna-sales-'+new Date().toISOString().slice(0,10)+'.csv';a.click()};
load().catch(e=>alert(e.message));setInterval(()=>load().catch(()=>{}),30000);
</script></body></html>`;
}
