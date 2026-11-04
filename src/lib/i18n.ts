/**
 * عربي/English: طبقة ترجمة على الواجهة كلها — تترجم النصوص الظاهرة والـ placeholder/title/aria-label
 * من قاموس (en.json)، وتتابع أي نص جديد ينضاف (MutationObserver). العربي هو الأصل.
 */
export type Lang = 'ar' | 'en';
const KEY = 'enna.lang';

export function getLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* تجاهل */
  }
  window.location.reload();
}

type Dict = Record<string, string>;
let exact = new Map<string, string>();
let patterns: { re: RegExp; out: string }[] = [];
const AR = /[؀-ۿ]/;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildDict(d: Dict) {
  exact = new Map();
  patterns = [];
  for (const [k, v] of Object.entries(d)) {
    const key = k.trim();
    if (!key || !v) continue;
    if (/\{\d+\}/.test(key)) {
      const order: number[] = [];
      const src = key
        .split(/(\{\d+\})/)
        .map((part) => {
          const m = part.match(/^\{(\d+)\}$/);
          if (m) {
            order.push(Number(m[1]));
            return '([\\s\\S]*?)';
          }
          return esc(part);
        })
        .join('');
      try {
        const re = new RegExp('^' + src + '$');
        let out = v;
        order.forEach((n, i) => (out = out.split(`{${n}}`).join(`\u0000${i}\u0000`)));
        patterns.push({ re, out });
      } catch {
        /* تجاهل */
      }
    } else exact.set(key, v);
  }
  // الأطول أول عشان يطابق الأدق
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
}

/** يترجم نص واحد (يحافظ على المسافات حوله) */
export function tr(s: string): string {
  if (!AR.test(s)) return s;
  const lead = s.match(/^\s*/)![0];
  const trail = s.match(/\s*$/)![0];
  const core = s.trim();
  const hit = exact.get(core);
  if (hit !== undefined) return lead + hit + trail;
  for (const p of patterns) {
    const m = core.match(p.re);
    if (m) {
      const out = p.out.replace(/\u0000(\d+)\u0000/g, (_, i) => tr(m[Number(i) + 1] ?? ''));
      return lead + out + trail;
    }
  }
  // اسم برقم: «خيمة 2»
  const num = core.match(/^(.+?)\s+(\d+)$/);
  if (num && exact.has(num[1])) return lead + exact.get(num[1]) + ' ' + num[2] + trail;
  // كلمات شائعة داخل نص مركّب (وحدات القياس)
  const unit = core.replace(/(\d)\s*م²/g, '$1 m²').replace(/(\d)\s*م\b/g, '$1 m').replace(/(\d)\s*ر\.ق/g, '$1 QAR');
  return unit !== core && !AR.test(unit) ? lead + unit + trail : s;
}

const ATTRS = ['placeholder', 'title', 'aria-label'];
function translateNode(n: Node) {
  if (n.nodeType === Node.TEXT_NODE) {
    const t = n.nodeValue ?? '';
    if (AR.test(t)) {
      const x = tr(t);
      if (x !== t) n.nodeValue = x;
    }
    return;
  }
  if (n.nodeType !== Node.ELEMENT_NODE) return;
  const el = n as Element;
  if (el.closest('[data-no-tr]')) return;
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v && AR.test(v)) {
      const x = tr(v);
      if (x !== v) el.setAttribute(a, x);
    }
  }
  if (tag === 'INPUT') {
    const i = el as HTMLInputElement;
    if ((i.type === 'button' || i.type === 'submit') && AR.test(i.value)) i.value = tr(i.value);
  }
  for (let c = el.firstChild; c; c = c.nextSibling) translateNode(c);
}

let started = false;
/** للرسم على الكانفس: يترجم بس إذا اللغة إنجليزي */
export const trIfEn = (s: string): string => (started ? tr(s) : s);
/** يشغّل الترجمة إذا اللغة إنجليزي */
export async function initI18n() {
  if (getLang() !== 'en' || started) return;
  started = true;
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
  document.documentElement.classList.add('lang-en');
  const d = (await import('./en.json')).default as Dict;
  buildDict(d);
  document.title = 'Al Enna Planner — design your winter camp in 3D';
  translateNode(document.body);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') translateNode(m.target);
      else if (m.type === 'attributes') translateNode(m.target);
      else m.addedNodes.forEach(translateNode);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
