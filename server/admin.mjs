// لوحة إدارة أكواد الشراء (صفحة واحدة بدون مكتبات)
export function adminPage({ licensing, maxDevices, persistent, skipcash }) {
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>إدارة مخطط العنة</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5ecda;color:#3b2a1e;font:15px/1.6 'Segoe UI',Tahoma,sans-serif}
header{background:#3b2a1e;color:#f5ecda;padding:14px 16px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
main{padding:16px;display:grid;gap:16px;max-width:1100px;margin:auto}
.card{background:#fff;border:1px solid #e6d7b8;border-radius:14px;padding:16px}
.grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
label{display:block;font-size:12px;color:#7a6248;margin-bottom:4px}
input{width:100%;height:40px;border:1px solid #e6d7b8;border-radius:10px;padding:0 10px;font:inherit}
button{height:38px;border:0;border-radius:10px;padding:0 12px;font:inherit;font-weight:600;cursor:pointer;background:#3b2a1e;color:#f5ecda}
.gold{background:#d4a24c;color:#3b2a1e}.ghost{background:#f1e6cf;color:#3b2a1e}.bad{background:#a12a1f;color:#fff}
.warn{background:#fff4d6;border:1px solid #e9c46a;border-radius:12px;padding:10px 12px}
.new{background:#eef7e8;border:1px solid #b6d9a0;border-radius:12px;padding:12px;margin-top:12px;display:grid;gap:8px}
.code{font-family:Consolas,monospace;font-size:16px;font-weight:700;direction:ltr;display:inline-block}
.stats{display:grid;gap:10px;grid-template-columns:repeat(3,1fr)}.stats b{display:block;font-size:22px}
.tbl{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:700px}th,td{padding:8px;border-bottom:1px solid #e6d7b8;text-align:right;font-size:14px}
.row{display:flex;gap:6px;flex-wrap:wrap}
</style></head><body>
<header><b>⛺ إدارة مخطط العنة</b><span>كل كود: مدى الحياة • حتى ${maxDevices} أجهزة</span></header>
<main>
${licensing ? '' : '<div class="warn">⚠ الحماية معطلة: أضف المتغير <b>LICENSE_SECRET</b> في Railway (16 حرفاً على الأقل). حالياً التطبيق مفتوح للجميع.</div>'}
${skipcash ? '<div class="warn" style="background:#eef7e8;border-color:#b6d9a0">✓ الدفع الإلكتروني (سكيب كاش) مفعّل — البيئة: <b>' + (skipcash === 'production' ? 'حقيقي' : 'تجريبي (Sandbox)') + '</b>. الكود يُولّد تلقائياً بعد الدفع.</div>' : '<div class="warn">الدفع الإلكتروني غير مفعّل: أضف مفاتيح سكيب كاش في Railway. حالياً يطلب العميل الشراء برقم جواله وترسل له رابط الدفع يدوياً.</div>'}
${persistent ? '' : '<div class="warn">⚠ لم يتم ربط Volume على <b>/data</b> في Railway: قائمة العملاء تُمسح عند كل نشر جديد (الأكواد نفسها تبقى صالحة).</div>'}
<section class="stats"><div class="card">الأكواد<b id="s1">0</b></div><div class="card">مفعّلة<b id="s2">0</b></div><div class="card">الإيراد<b id="s3">0</b></div></section>
<section class="card"><h3 style="margin-top:0">طلبات الشراء من الموقع</h3>
<div class="row" style="margin-bottom:8px"><div style="flex:1;min-width:220px"><label for="pl">رابط الدفع (سكيب كاش)</label><input id="pl" dir="ltr" placeholder="https://..."></div></div>
<div class="tbl"><table><thead><tr><th>العميل</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead><tbody id="ob"></tbody></table></div></section>
<section class="card"><h3 style="margin-top:0">كود جديد لعميل (يدوي)</h3>
<form id="f" class="grid">
<div><label for="name">اسم العميل</label><input id="name" required></div>
<div><label for="phone">رقم الواتساب</label><input id="phone" dir="ltr" placeholder="974xxxxxxxx"></div>
<div><label for="price">المبلغ (ر.ق)</label><input id="price" type="number" value="349" dir="ltr"></div>
<div><label for="note">ملاحظة</label><input id="note"></div>
<div style="align-self:end"><button class="gold">توليد الكود</button></div></form><div id="out"></div></section>
<section class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">العملاء</h3><input id="q" placeholder="بحث" style="max-width:240px"></div>
<div class="tbl"><table><thead><tr><th>العميل</th><th>الكود</th><th>التاريخ</th><th>الأجهزة</th><th>الحالة</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></section>
</main>
<script>
let list=[],orders=[],PRICE=349;const MAX=${maxDevices};const ST={pending:'بانتظار الدفع',new:'جديد',sent:'أُرسل رابط الدفع',paid:'مدفوع ✓',cancelled:'ملغي'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(p,b){const r=await fetch(p,b?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}:{});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'خطأ');return j}
const msg=r=>'هلا '+(r.name||'')+' 👋\\nشكراً لاشتراكك في مخطط العنة ⛺\\n\\nالرابط: '+location.origin+'\\nكود التفعيل: '+r.code+'\\n\\nالكود لك مدى الحياة ويعمل على '+MAX+' أجهزة.';
const wa=r=>'https://wa.me/'+String(r.phone||'').replace(/\\D/g,'')+'?text='+encodeURIComponent(msg(r));
function render(){const q=document.getElementById('q').value.trim();const rows=list.filter(r=>!q||[r.name,r.phone,r.code,r.note].join(' ').includes(q));
s1.textContent=list.length;s2.textContent=list.filter(r=>r.devices.length).length;s3.textContent=list.reduce((s,r)=>s+(r.price||0),0).toLocaleString('en-US')+' ر.ق';
tb.innerHTML=rows.map(r=>'<tr><td><b>'+esc(r.name||'—')+'</b><br><small dir="ltr">'+esc(r.phone)+'</small> <small>'+esc(r.note)+'</small></td><td><span class="code">'+esc(r.code||r.id)+'</span></td><td>'+new Date(r.createdAt).toLocaleDateString('en-GB')+'</td><td>'+r.devices.length+' / '+MAX+'</td><td>'+(r.revoked?'موقوف':r.devices.length?'مفعّل ✓':'لم يُفعّل')+'</td><td><div class="row">'+(r.code?'<a href="'+wa(r)+'" target="_blank"><button class="gold" type="button">واتساب</button></a>':'')+'<button class="ghost" type="button" data-a="reset" data-id="'+r.id+'">تصفير الأجهزة</button>'+(r.revoked?'<button class="ghost" type="button" data-a="restore" data-id="'+r.id+'">إعادة تفعيل</button>':'<button class="bad" type="button" data-a="revoke" data-id="'+r.id+'">إيقاف</button>')+'</div></td></tr>').join('')||'<tr><td colspan="6">لا يوجد عملاء بعد</td></tr>'}
function payMsg(o){return 'هلا '+o.name+' 👋\\nشكراً لطلبك مخطط العنة ⛺\\nالسعر: '+PRICE+' ر.ق — مدى الحياة\\n\\nرابط الدفع (سكيب كاش):\\n'+(pl.value||'[ضع رابط الدفع]')+'\\n\\nبعد الدفع يوصلك كود التفعيل هنا.'}
function renderOrders(){ob.innerHTML=orders.map(o=>{const c=o.codeId&&list.find(r=>r.id===o.codeId);return '<tr><td><b>'+esc(o.name)+'</b><br><small dir="ltr">'+esc(o.phone)+'</small></td><td>'+new Date(o.createdAt).toLocaleString('en-GB')+'</td><td>'+ST[o.status]+'</td><td><div class="row">'+
(o.status==='paid'&&c?'<a href="'+wa(c)+'" target="_blank"><button class="gold" type="button">إرسال الكود واتساب</button></a>':
'<a href="https://wa.me/'+esc(o.phone)+'?text='+encodeURIComponent(payMsg(o))+'" target="_blank" data-o="'+o.id+'" data-s="sent"><button class="ghost" type="button">إرسال رابط الدفع</button></a><button class="gold" type="button" data-o="'+o.id+'" data-s="paid">تم الدفع ← توليد الكود</button><button class="bad" type="button" data-o="'+o.id+'" data-s="cancelled">إلغاء</button>')+
'</div></td></tr>'}).join('')||'<tr><td colspan="4">لا توجد طلبات بعد</td></tr>'}
async function load(){const j=await api('/api/admin/list');list=j.list;orders=j.orders||[];PRICE=j.price||349;if(!pl.value)pl.value=localStorage.getItem('pl')||j.paymentLink||'';render();renderOrders()}
pl.onchange=()=>localStorage.setItem('pl',pl.value);
ob.onclick=async e=>{const t=e.target.closest('[data-o]');if(!t)return;try{const r=await api('/api/admin/order',{id:t.dataset.o,status:t.dataset.s});await load();if(t.dataset.s==='paid'&&r.code&&r.code.phone)window.open(wa(r.code),'_blank')}catch(err){alert(err.message)}};
setInterval(()=>load().catch(()=>{}),30000);
q.oninput=render;
tb.onclick=async e=>{const b=e.target.closest('button[data-a]');if(!b)return;try{await api('/api/admin/update',{id:b.dataset.id,action:b.dataset.a});await load()}catch(err){alert(err.message)}};
f.onsubmit=async e=>{e.preventDefault();try{const{created}=await api('/api/admin/create',{name:name.value,phone:phone.value,price:price.value,note:note.value});const r=created[0];
out.innerHTML='<div class="new"><div>كود <b>'+esc(r.name)+'</b>: <span class="code">'+esc(r.code)+'</span></div><div class="row">'+(r.phone?'<a href="'+wa(r)+'" target="_blank"><button class="gold" type="button">إرسال واتساب</button></a>':'')+'<button class="ghost" type="button" id="cp">نسخ الرسالة</button></div></div>';
cp.onclick=()=>navigator.clipboard.writeText(msg(r)).then(()=>cp.textContent='تم النسخ ✓');f.reset();price.value=349;await load()}catch(err){alert(err.message)}};
load().catch(e=>alert(e.message));
</script></body></html>`;
}
