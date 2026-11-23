// «👨‍👩‍👦 الأهل يختارون»: صاحب التصميم يرسل 2–4 تصاميم برابط، والأهل يصوّتون (بدون حساب) ويكتبون تعليق
// الصور تنحفظ ملفات في DATA_DIR/votes (مب داخل قاعدة البيانات)، والتصويت مرة وحدة لكل جهاز
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const VOTE_DAYS = 45;
const MAX_ROOMS_PER_CODE = 30;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

export function voteDir(dataDir) {
  const d = path.join(dataDir, 'votes');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** ينشئ غرفة تصويت. items: [{ name, img: dataURL jpeg }] */
export function createRoom(db, dataDir, codeId, body) {
  const items = Array.isArray(body.items) ? body.items.slice(0, 4) : [];
  if (items.length < 2) return { error: 'اختار تصميمين على الأقل' };
  const imgs = [];
  for (const it of items) {
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(it?.img || ''));
    if (!m) return { error: 'صورة التصميم ناقصة' };
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length < 500 || buf.length > 400_000) return { error: 'صورة التصميم كبيرة' };
    imgs.push(buf);
  }
  db.votes ??= {};
  const mine = Object.values(db.votes).filter((r) => r.code === codeId);
  if (mine.length >= MAX_ROOMS_PER_CODE) {
    // نشيل الأقدم عشان ما تتكدس
    const old = mine.sort((a, b) => a.createdAt - b.createdAt)[0];
    removeRoom(db, dataDir, old.id);
  }
  const id = crypto.randomBytes(6).toString('base64url');
  const dir = voteDir(dataDir);
  imgs.forEach((b, i) => fs.writeFileSync(path.join(dir, `${id}-${i}.jpg`), b));
  db.votes[id] = {
    id,
    code: codeId,
    title: clean(body.title, 60) || 'اختاروا التصميم',
    izba: body.izba === true,
    items: items.map((it, i) => ({ name: clean(it.name, 40) || `تصميم ${i + 1}` })),
    votes: [],
    createdAt: Date.now(),
  };
  return { room: db.votes[id] };
}

export function removeRoom(db, dataDir, id) {
  const r = db.votes?.[id];
  if (!r) return;
  const dir = voteDir(dataDir);
  r.items.forEach((_, i) => fs.rmSync(path.join(dir, `${id}-${i}.jpg`), { force: true }));
  delete db.votes[id];
}

/** ينظف الغرف القديمة (أكثر من 45 يوم) */
export function pruneRooms(db, dataDir, now = Date.now()) {
  for (const r of Object.values(db.votes ?? {})) if (now - r.createdAt > VOTE_DAYS * 864e5) removeRoom(db, dataDir, r.id);
}

export function roomOf(db, id) {
  const r = db.votes?.[String(id || '')];
  return r && Date.now() - r.createdAt <= VOTE_DAYS * 864e5 ? r : null;
}

/** صوت (أو تغيير الصوت) — جهاز واحد = صوت واحد */
export function castVote(room, body) {
  const i = Number(body.i);
  if (!Number.isInteger(i) || i < 0 || i >= room.items.length) return { error: 'اختيار غلط' };
  const voter = clean(body.voter, 40);
  if (voter.length < 8) return { error: 'حدّث الصفحة وجرّب مرة ثانية' };
  const v = { voter, i, name: clean(body.name, 30), comment: clean(body.comment, 300), at: Date.now() };
  const k = room.votes.findIndex((x) => x.voter === voter);
  if (k >= 0) room.votes[k] = v;
  else {
    if (room.votes.length >= 200) return { error: 'التصويت امتلى' };
    room.votes.push(v);
  }
  return { ok: true };
}

/** النتيجة (بدون أرقام الأجهزة) */
export function results(room) {
  const counts = room.items.map(() => 0);
  for (const v of room.votes) counts[v.i]++;
  return {
    id: room.id,
    title: room.title,
    items: room.items.map((it, i) => ({ name: it.name, votes: counts[i] })),
    total: room.votes.length,
    comments: room.votes.filter((v) => v.comment || v.name).map((v) => ({ i: v.i, name: v.name, comment: v.comment, at: v.at })).slice(-50),
    createdAt: room.createdAt,
  };
}

/** صفحة التصويت (خفيفة بدون React — تفتح على أي جوال) */
export function votePage(room, origin) {
  const items = room.items
    .map(
      (it, i) => `<button class="card" data-i="${i}" type="button">
  <img src="/v/${esc(room.id)}/img/${i}" alt="${esc(it.name)}" loading="lazy">
  <span class="nm">${esc(it.name)}</span><span class="cnt" id="c${i}"></span>
</button>`,
    )
    .join('');
  const site = room.izba ? 'i3enna للعزب 🏡' : 'مخطط العنة ⛺';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(room.title)} — ${esc(site)}</title>
<meta property="og:title" content="${esc(room.title)} — صوّت على التصميم اللي يعجبك">
<meta property="og:image" content="${esc(origin)}/v/${esc(room.id)}/img/0">
<meta name="robots" content="noindex">
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;background:#f5ecda;color:#3b2a1e}
header{background:#3b2a1e;color:#fbf7ef;padding:18px 16px}h1{margin:0;font-size:22px}header p{margin:6px 0 0;color:#ecc97f;font-size:14px}
main{max-width:760px;margin:0 auto;padding:16px}.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.card{display:block;width:100%;padding:0;border:3px solid #ecdcbc;border-radius:16px;overflow:hidden;background:#fff;cursor:pointer;text-align:right;font:inherit;color:inherit}
.card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#ecdcbc}.card .nm{display:block;padding:10px 12px 0;font-weight:700;font-size:16px}
.card .cnt{display:block;padding:2px 12px 10px;color:#8a5f37;font-size:13px;min-height:1.2em}.card.on{border-color:#d4a24c;box-shadow:0 0 0 4px rgba(212,162,76,.35)}
.box{margin-top:14px;background:#fff;border-radius:16px;padding:14px;border:1px solid #ecdcbc}input,textarea{width:100%;font:inherit;font-size:16px;padding:10px;border:1px solid #e0c697;border-radius:10px;margin-top:6px}
.send{margin-top:10px;width:100%;padding:13px;border:0;border-radius:12px;background:#d4a24c;color:#2e1f15;font-weight:800;font-size:17px;cursor:pointer}.send:disabled{opacity:.5}
.ok{margin-top:10px;color:#2f6220;font-weight:700;display:none}.cm{margin-top:14px}.cm div{background:#fbf7ef;border-radius:10px;padding:8px 10px;margin-top:6px;font-size:14px}
footer{text-align:center;color:#8a5f37;font-size:13px;padding:20px}footer a{color:#8a5f37}
</style></head><body>
<header><h1>${esc(room.title)}</h1><p>اضغط على التصميم اللي يعجبك 👇</p></header>
<main><div class="grid">${items}</div>
<div class="box"><label>اسمك (اختياري)<input id="nm" maxlength="30" placeholder="مثلاً: أبو محمد"></label>
<label>تعليقك (اختياري)<textarea id="cm" rows="2" maxlength="300" placeholder="ليش اخترته؟ أو وش تبي يتغير؟"></textarea></label>
<button class="send" id="send" type="button" disabled>صوّت ✓</button><div class="ok" id="ok">وصل صوتك — شكراً 🙏 (تقدر تغيّره)</div>
<div class="cm" id="cms"></div></div></main>
<footer>صُمّم في <a href="${esc(origin)}${room.izba ? '/izba' : '/'}">${esc(site)}</a> — صمّم عزبتك أو عنتك أنت بعد</footer>
<script>
(function(){var id=${JSON.stringify(room.id)},sel=-1,k='enna.voter';var v=localStorage.getItem(k);if(!v){v=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(k,v)}
var mine=localStorage.getItem('enna.vote.'+id);var cards=[].slice.call(document.querySelectorAll('.card'));
function pick(i){sel=i;cards.forEach(function(c){c.classList.toggle('on',+c.dataset.i===i)});document.getElementById('send').disabled=false}
cards.forEach(function(c){c.onclick=function(){pick(+c.dataset.i)}});if(mine!==null)pick(+mine);
function show(r){r.items.forEach(function(it,i){var e=document.getElementById('c'+i);if(e)e.textContent=it.votes?('👍 '+it.votes+(it.votes>1?' أصوات':' صوت')):''});
var h=r.comments.slice().reverse().map(function(c){var t=document.createElement('div');t.textContent=(c.name?c.name+' ':'')+'('+r.items[c.i].name+')'+(c.comment?': '+c.comment:'');return t.outerHTML}).join('');document.getElementById('cms').innerHTML=h}
function load(){fetch('/api/vote/'+id).then(function(r){return r.json()}).then(function(r){if(r.ok)show(r)}).catch(function(){})}
document.getElementById('send').onclick=function(){if(sel<0)return;var b=this;b.disabled=true;
fetch('/api/vote/'+id,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({i:sel,voter:v,name:document.getElementById('nm').value,comment:document.getElementById('cm').value})})
.then(function(r){return r.json()}).then(function(r){b.disabled=false;if(r.ok){localStorage.setItem('enna.vote.'+id,sel);document.getElementById('ok').style.display='block';load()}else alert(r.error||'ما وصل — جرّب مرة ثانية')})
.catch(function(){b.disabled=false;alert('انقطع الاتصال — جرّب مرة ثانية')})};load()})();
</script></body></html>`;
}
