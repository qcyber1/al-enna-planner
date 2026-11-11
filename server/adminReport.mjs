// تبويب «التقارير» في لوحة الإدارة: تختار يوم أو فترة ← معاينة ← طباعة PDF أو CSV (للشركاء)
// مكتوب كنصوص تنحط داخل صفحة الأدمن (بدون علامة ` ولا ${ داخلها)

export const REPORT_SECTION = String.raw`
<section class="card" data-p="report" hidden>
  <div class="card-h"><div><h3>📄 التقرير</h3><p class="sub">اختر يوم أو فترة، وطلّع تقرير مرتب للشركاء (PDF) أو ملف CSV</p></div></div>
  <div class="row" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
    <button class="ghost" type="button" data-rq="today">اليوم</button>
    <button class="ghost" type="button" data-rq="yesterday">أمس</button>
    <button class="ghost" type="button" data-rq="7">آخر ٧ أيام</button>
    <button class="ghost" type="button" data-rq="30">آخر ٣٠ يوم</button>
    <button class="ghost" type="button" data-rq="month">هذا الشهر</button>
  </div>
  <div class="grid">
    <div><label for="rp_from">من</label><input id="rp_from" type="date" dir="ltr"></div>
    <div><label for="rp_to">إلى</label><input id="rp_to" type="date" dir="ltr"></div>
    <div style="align-self:end"><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input id="rp_ph" type="checkbox" style="width:auto"> إظهار أرقام الجوال كاملة</label></div>
  </div>
  <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><button id="rp_print" class="gold" type="button">🖨 طباعة / PDF</button><button id="rp_csv" class="ghost" type="button">⬇ CSV</button></div>
  <div id="rp_view" style="margin-top:16px"></div>
</section>`;

export const REPORT_SCRIPT = String.raw`
const RP={data:null};
const qaToday=()=>new Date(Date.now()+3*3600e3).toISOString().slice(0,10);
const qaShift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
function rpRange(k){const t=qaToday();if(k==='today')return[t,t];if(k==='yesterday'){const y=qaShift(t,-1);return[y,y]}if(k==='month')return[t.slice(0,8)+'01',t];const n=+k;return[qaShift(t,-(n-1)),t]}
const rpMask=p=>{const d=String(p||'').replace(/\D/g,'');if(!d)return '—';return rp_ph.checked?'+'+d:'ينتهي بـ '+d.slice(-3)};
const rpN=n=>(Math.round(n||0)).toLocaleString('en-US');
const rpPct=(a,b)=>b?(Math.round(a/b*1000)/10)+'%':'—';
const rpDelta=(a,b)=>{if(!b)return a?'<span class="up">جديد</span>':'';const p=Math.round((a-b)/b*100);return '<span class="'+(p>=0?'up':'down')+'">'+(p>=0?'▲ ':'▼ ')+Math.abs(p)+'%</span>'};
const RP_PROD={enna:'⛺ عنة',izba:'🏡 عزبة'};
const RP_METHOD={online:'سكيب كاش',manual:'تحويل يدوي',code:'كود يدوي'};
const rpDateLabel=d=>d.from===d.to?d.from:d.from+' ← '+d.to;
function rpHtml(d,forPrint){
  const kpi=(icon,label,val,sub)=>'<div class="k"><div class="ki">'+icon+'</div><div><div class="kl">'+label+'</div><div class="kv">'+val+'</div>'+(sub?'<div class="ks">'+sub+'</div>':'')+'</div></div>';
  const steps=[['👀','زاروا الموقع',d.visits],['▶️','بدأوا التجربة المجانية',d.trials],['⏱','خلّصوا التجربة',d.trialsEnded],['🛒','ضغطوا «اشترِ»',d.buyClicks],['📝','عبّوا بياناتهم للدفع',d.checkoutClicks],['✅','اشتروا',d.purchases]];
  const top=Math.max(1,d.visits);
  const funnel=steps.map(s=>'<div class="fs"><span>'+s[0]+' '+s[1]+'</span><div class="bar"><i style="width:'+Math.min(100,s[2]/top*100)+'%"></i></div><b>'+rpN(s[2])+'</b><small>'+rpPct(s[2],d.visits)+'</small></div>').join('');
  const sales=d.sales.map((s,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(new Date(s.at).toLocaleString('en-GB',{timeZone:'Asia/Qatar',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))+'</td><td>'+esc(s.name||'—')+'</td><td>'+(rp_ph.checked?'<bdi dir="ltr">':'<bdi>')+esc(rpMask(s.phone))+'</bdi></td><td>'+RP_PROD[s.product]+'</td><td class="n">'+rpN(s.amount)+'</td><td class="n">'+(s.fee?rpN(s.net):rpN(s.amount))+'</td><td>'+RP_METHOD[s.method]+'</td><td>'+[s.offer&&'🎁 عرض التجربة',s.ref&&'🤝 إحالة',s.upgrade&&'⬆️ ترقية'].filter(Boolean).join(' • ')+'</td></tr>').join('');
  const lost=d.lost.map(x=>'<tr><td>'+esc(x.name||'—')+'</td><td>'+(rp_ph.checked?'<bdi dir="ltr">':'<bdi>')+esc(rpMask(x.phone))+'</bdi></td><td>'+RP_PROD[x.product]+'</td><td class="n">'+x.tries+'</td><td>'+esc(x.reason)+'</td></tr>').join('');
  const perDay=d.days>1?'<h2>📅 يوم بيوم</h2><table><thead><tr><th>اليوم</th><th class="n">زيارات</th><th class="n">تجارب</th><th class="n">محاولات دفع</th><th class="n">مبيعات</th><th class="n">الإيراد</th></tr></thead><tbody>'+d.perDay.slice().reverse().map(r=>'<tr><td>'+r.day+'</td><td class="n">'+r.visit+'</td><td class="n">'+r.trial_start+'</td><td class="n">'+r.attempts+'</td><td class="n"><b>'+r.purchase+'</b></td><td class="n">'+rpN(r.revenue)+'</td></tr>').join('')+'</tbody></table>':'';
  const izba=d.revenueBy.izba>0||d.funnel.izba.visit>0;
  const notes=[];
  if(d.purchases&&d.offerSales)notes.push('🎁 '+d.offerSales+' من المبيعات جات من عرض «خلصت التجربة»');
  if(d.refSales)notes.push('🤝 '+d.refSales+' من المبيعات جات عن طريق روابط الإحالة');
  if(d.lost.length)notes.push('📞 '+d.lost.length+' شخص حاولوا يدفعون وما كمّلوا — فرصة نكلمهم واتساب');
  if(d.exportBlocked)notes.push('🚫 '+d.exportBlocked+' شخص حاولوا يصدّرون وهم بالتجربة (مهتمين بالشراء)');
  if(d.feedback)notes.push('💬 '+d.feedback+' ملاحظة جديدة من المستخدمين');
  if(d.referralsOwed)notes.push('💸 مكافآت إحالة مستحقة في الفترة: '+rpN(d.referralsOwed)+' ر.ق');
  return '<div class="rp">'+
   '<header><div><div class="brand">i3enna</div><h1>'+(d.days===1?'التقرير اليومي':'تقرير الفترة')+'</h1><div class="sub">'+esc(rpDateLabel(d))+(d.days>1?' ('+d.days+' يوم)':'')+' • مقارنة بـ '+esc(d.prev.from===d.prev.to?d.prev.from:d.prev.from+' ← '+d.prev.to)+'</div></div>'+(forPrint?'<button class="pr" onclick="window.print()">طباعة / حفظ PDF</button>':'')+'</header>'+
   '<div class="kpis">'+
     kpi('💰','الإيراد (قبل العمولة)',rpN(d.revenue)+' ر.ق',rpDelta(d.revenue,d.prev.revenue))+
     kpi('💵','الصافي بعد عمولة سكيب كاش',(d.fee.pct||d.fee.fixed)?rpN(d.net)+' ر.ق':'—',(d.fee.pct||d.fee.fixed)?'العمولة −'+rpN(d.fees)+' ر.ق ('+d.fee.pct+'%'+(d.fee.fixed?' + '+d.fee.fixed+' ر.ق':'')+')':'حدد العمولة في «الأسعار والعروض»')+
     kpi('🛍️','المبيعات',rpN(d.purchases),rpDelta(d.purchases,d.prev.purchases))+
     kpi('👀','الزوار',rpN(d.visits),rpDelta(d.visits,d.prev.visits))+
     kpi('▶️','جرّبوا مجاناً',rpN(d.trials),rpDelta(d.trials,d.prev.trials))+
     kpi('🎯','زائر ← مشتري',rpPct(d.purchases,d.visits),'تجربة ← شراء '+rpPct(d.purchases,d.trials))+
     kpi('🧾','متوسط الطلب',d.avgOrder?rpN(d.avgOrder)+' ر.ق':'—','')+
   '</div>'+
   (izba?'<div class="split"><span>⛺ العنة: <b>'+rpN(d.revenueBy.enna)+' ر.ق</b></span><span>🏡 العزبة: <b>'+rpN(d.revenueBy.izba)+' ر.ق</b></span></div>':'')+
   (notes.length?'<ul class="notes">'+notes.map(n=>'<li>'+n+'</li>').join('')+'</ul>':'')+
   '<h2>📈 مسار البيع</h2><div class="funnel">'+funnel+'</div><p class="hint">كل شخص ينحسب مرة وحدة في اليوم. التجارب مجهولة الهوية (ما نعرف اسم أو رقم اللي جرّب).</p>'+
   '<h2>✅ المشترين ('+d.sales.length+')</h2>'+(sales?'<table><thead><tr><th>#</th><th>الوقت</th><th>العميل</th><th>الجوال</th><th>المنتج</th><th class="n">المبلغ</th><th class="n">الصافي</th><th>الطريقة</th><th>ملاحظات</th></tr></thead><tbody>'+sales+'</tbody></table>':'<p class="empty">ما في مبيعات في هالفترة</p>')+
   '<h2>📞 حاولوا يدفعون وما كمّلوا ('+d.lost.length+')</h2>'+(lost?'<table><thead><tr><th>العميل</th><th>الجوال</th><th>المنتج</th><th class="n">المحاولات</th><th>السبب</th></tr></thead><tbody>'+lost+'</tbody></table>':'<p class="empty">ما في أحد 👌</p>')+
   perDay+
   '<h2>🏁 من البداية لين اليوم</h2><div class="split"><span>💰 الإيراد: <b>'+rpN(d.totals.revenue)+' ر.ق</b></span><span>🛍️ المبيعات: <b>'+rpN(d.totals.sales)+'</b></span><span>👥 العملاء: <b>'+rpN(d.totals.customers)+'</b></span><span>📱 فعّلوا الكود: <b>'+rpN(d.totals.activated)+'</b></span></div>'+
   '<p class="foot">طلع التقرير: '+esc(new Date(d.generatedAt).toLocaleString('en-GB',{timeZone:'Asia/Qatar'}))+' (توقيت قطر) • بيانات الزيارات والتجارب تنحفظ آخر '+d.funnelKeptDays+' يوم • ما تنحسب طلبات التجربة من اللوحة</p>'+
  '</div>'}
const RP_CSS='.rp{font-family:"IBM Plex Sans Arabic",system-ui,Tahoma,sans-serif;color:#2b1d12;line-height:1.5}.rp header{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:3px solid #d4a24c;padding-bottom:10px;margin-bottom:14px}.rp .brand{font-weight:800;color:#b07d2a;letter-spacing:.5px}.rp h1{margin:2px 0;font-size:22px}.rp .sub{color:#7a5c3e;font-size:13px}.rp h2{font-size:16px;margin:20px 0 8px}.rp .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.rp .k{display:flex;gap:10px;align-items:center;border:1px solid #eadcc0;border-radius:12px;padding:10px;background:#fffdf8}.rp .ki{font-size:22px}.rp .kl{font-size:12px;color:#7a5c3e}.rp .kv{font-size:18px;font-weight:800}.rp .ks{font-size:11px;color:#7a5c3e}.rp .up{color:#1f7a3a;font-weight:700}.rp .down{color:#b42318;font-weight:700}.rp .split{display:flex;flex-wrap:wrap;gap:8px 18px;background:#fbf6ea;border-radius:10px;padding:10px 12px;margin-top:10px;font-size:14px}.rp .notes{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:4px}.rp .notes li{background:#f3f8f1;border-radius:8px;padding:6px 10px;font-size:13px}.rp .funnel{display:grid;gap:6px}.rp .fs{display:grid;grid-template-columns:13rem 1fr 3.5rem 3.5rem;align-items:center;gap:8px;font-size:13px}.rp .bar{height:10px;background:#f3ead6;border-radius:9px;overflow:hidden}.rp .bar i{display:block;height:100%;background:#d4a24c;border-radius:9px}.rp .fs b,.rp .fs small{text-align:left;font-variant-numeric:tabular-nums}.rp .fs small{color:#7a5c3e}.rp .hint,.rp .foot{font-size:11px;color:#7a5c3e}.rp .foot{margin-top:18px;border-top:1px solid #eadcc0;padding-top:8px}.rp table{width:100%;border-collapse:collapse;font-size:12.5px}.rp th,.rp td{border-bottom:1px solid #f0e6d2;padding:6px;text-align:right}.rp th{background:#f8f1e2;font-size:12px}.rp .n{text-align:left;font-variant-numeric:tabular-nums}.rp .empty{color:#7a5c3e;font-size:13px}.rp .pr{font:inherit;background:#d4a24c;border:0;border-radius:10px;padding:8px 14px;font-weight:700;cursor:pointer}@media (max-width:640px){.rp .kpis{grid-template-columns:repeat(2,1fr)}.rp .fs{grid-template-columns:9rem 1fr 2.6rem 2.8rem}}@media print{.rp .pr{display:none}.rp h2,.rp table,.rp .kpis{break-inside:avoid}}';
async function rpLoad(){if(!rp_from.value||!rp_to.value){const r=rpRange('today');rp_from.value=r[0];rp_to.value=r[1]}
  const d=await api('/api/admin/report?from='+rp_from.value+'&to='+rp_to.value);RP.data=d;rp_from.value=d.from;rp_to.value=d.to;
  rp_view.innerHTML='<style>'+RP_CSS+'</style>'+rpHtml(d,false)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-rq]');if(!b)return;const r=rpRange(b.dataset.rq);rp_from.value=r[0];rp_to.value=r[1];rpLoad().catch(err=>alert(err.message))});
rp_from.onchange=rp_to.onchange=rp_ph.onchange=()=>rpLoad().catch(err=>alert(err.message));
rp_print.onclick=()=>{const d=RP.data;if(!d)return;const w=window.open('','_blank');if(!w)return alert('المتصفح منع النافذة — اسمح بالنوافذ المنبثقة');
  w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>i3enna — '+esc(rpDateLabel(d))+'</title><style>@page{size:A4;margin:12mm}body{margin:0;padding:18px;background:#fff}'+RP_CSS+'</style></head><body>'+rpHtml(d,true)+'</body></html>');w.document.close()};
rp_csv.onclick=()=>{const d=RP.data;if(!d)return;const rows=[['i3enna — '+rpDateLabel(d)],[],['الإيراد (قبل العمولة)',d.revenue],['عمولة سكيب كاش',d.fees],['الصافي',d.net],['المبيعات',d.purchases],['الزوار',d.visits],['جرّبوا مجاناً',d.trials],['خلّصوا التجربة',d.trialsEnded],['عبّوا بياناتهم للدفع',d.checkoutClicks],['زائر ← مشتري',rpPct(d.purchases,d.visits)],['متوسط الطلب',d.avgOrder],['إيراد العنة',d.revenueBy.enna],['إيراد العزبة',d.revenueBy.izba],[],['المشترين'],['رقم الطلب','الوقت','العميل','الجوال','المنتج','المبلغ','عمولة سكيب كاش','الصافي','الطريقة','عرض','إحالة','ترقية']];
  for(const s of d.sales)rows.push([s.no,new Date(s.at).toLocaleString('en-GB',{timeZone:'Asia/Qatar'}),s.name,rp_ph.checked?s.phone:rpMask(s.phone),s.product==='izba'?'عزبة':'عنة',s.amount,s.fee,s.net,RP_METHOD[s.method],s.offer?'نعم':'',s.ref?'نعم':'',s.upgrade?'نعم':'']);
  rows.push([],['حاولوا يدفعون وما كمّلوا'],['العميل','الجوال','المنتج','المحاولات','السبب']);for(const x of d.lost)rows.push([x.name,rp_ph.checked?x.phone:rpMask(x.phone),x.product==='izba'?'عزبة':'عنة',x.tries,x.reason]);
  if(d.days>1){rows.push([],['يوم بيوم'],['اليوم','زيارات','تجارب','محاولات دفع','مبيعات','الإيراد']);for(const r of d.perDay)rows.push([r.day,r.visit,r.trial_start,r.attempts,r.purchase,r.revenue])}
  const s='﻿'+rows.map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([s],{type:'text/csv'}));a.download='i3enna-report-'+d.from+(d.to!==d.from?'_'+d.to:'')+'.csv';a.click()};
`;
