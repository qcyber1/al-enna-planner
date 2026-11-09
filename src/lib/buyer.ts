// التحقق من بيانات المشتري — قواعد ذكية وبسيطة، ورسالة لكل خانة لحالها
// (نفس القواعد موجودة في الخادم server/buyer.mjs)

/** يحوّل الأرقام العربية/الفارسية إلى إنجليزية */
export function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function checkName(raw: string): string | null {
  const n = raw.trim();
  if (n.length < 2) return 'اكتب اسمك';
  if (/\d|[٠-٩۰-۹]/.test(n)) return 'الاسم ما فيه أرقام';
  if (!/\p{L}/u.test(n)) return 'الاسم لازم يكون حروف';
  if (n.length > 60) return 'الاسم طويل — اكتب الاسم الأول والعائلة بس';
  return null;
}

/** يرجع الرقم الكامل (مع 974 للأرقام القطرية) أو رسالة خطأ */
export function parsePhone(raw: string): { phone?: string; error?: string } {
  let p = normalizeDigits(raw).replace(/[\s\-().]/g, '');
  if (!p) return { error: 'اكتب رقم جوالك' };
  if (p.startsWith('+')) p = p.slice(1);
  else if (p.startsWith('00')) p = p.slice(2);
  if (!/^\d+$/.test(p)) return { error: 'رقم الجوال أرقام بس (مثل 55123456)' };
  const local = p.length === 11 && p.startsWith('974') ? p.slice(3) : p.length === 8 ? p : null;
  if (local) {
    if (!/^[3567]/.test(local)) return { error: 'الرقم القطري يبدأ بـ 3 أو 5 أو 6 أو 7' };
    return { phone: '974' + local };
  }
  if (p.length >= 9 && p.length <= 15 && !p.startsWith('0')) return { phone: p }; // رقم دولي مع رمز الدولة
  return { error: 'رقم الجوال لازم 8 أرقام (مثل 55123456)' };
}

/** دول الخليج (أغلب عملائنا): رمز الدولة وطول الرقم وأوله ومثال */
export interface GccCountry {
  cc: string;
  flag: string;
  name: string;
  len: number;
  re: RegExp;
  ex: string;
}
export const GCC: GccCountry[] = [
  { cc: '974', flag: '🇶🇦', name: 'قطر', len: 8, re: /^[3567]/, ex: '55123456' },
  { cc: '966', flag: '🇸🇦', name: 'السعودية', len: 9, re: /^5/, ex: '501234567' },
  { cc: '965', flag: '🇰🇼', name: 'الكويت', len: 8, re: /^[4569]/, ex: '50012345' },
  { cc: '971', flag: '🇦🇪', name: 'الإمارات', len: 9, re: /^5/, ex: '501234567' },
  { cc: '973', flag: '🇧🇭', name: 'البحرين', len: 8, re: /^3/, ex: '36123456' },
  { cc: '968', flag: '🇴🇲', name: 'عُمان', len: 8, re: /^[79]/, ex: '92123456' },
];

/** الدولة الافتراضية من المنطقة الزمنية لجهاز العميل (وإلا قطر) */
export function guessGcc(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const m: Record<string, string> = { 'Asia/Riyadh': '966', 'Asia/Kuwait': '965', 'Asia/Dubai': '971', 'Asia/Bahrain': '973', 'Asia/Muscat': '968' };
    return m[tz] ?? '974';
  } catch {
    return '974';
  }
}

/** يركّب الرقم الكامل من الدولة المختارة + الرقم المكتوب (ولو كتب رمز دولة بنفسه نحترمه) */
export function fullBuyerPhone(cc: string, local: string): string {
  const raw = normalizeDigits(local).replace(/[\s\-().]/g, '');
  if (!raw) return '';
  if (raw.startsWith('+') || raw.startsWith('00')) return raw;
  let d = raw.replace(/^0+/, ''); // السعودي والإماراتي يكتبون 05…
  const c = GCC.find((g) => g.cc === cc);
  if (c && d.startsWith(cc) && d.length === cc.length + c.len) d = d.slice(cc.length);
  return '+' + cc + d;
}

/**
 * رقم الشراء (صارم): لازم يكون رقم يقبله نظام الدفع، وإلا سكيب كاش يرفض بـ «Invalid details».
 * قطري 8 أرقام، أو خليجي برمز دولته وطوله الصحيح، أو أي رقم دولي مكتوب بـ + أو 00 في أوله.
 */
export function parseBuyerPhone(raw: string): { phone?: string; error?: string } {
  const s = normalizeDigits(raw).replace(/[\s\-().]/g, '');
  if (!s) return { error: 'اكتب رقم جوالك' };
  const intl = s.startsWith('+') || s.startsWith('00');
  const p = s.startsWith('+') ? s.slice(1) : s.startsWith('00') ? s.slice(2) : s;
  if (!/^\d+$/.test(p)) return { error: 'رقم الجوال أرقام بس (مثل 55123456)' };
  if (p.length === 8 || (p.length === 11 && p.startsWith('974'))) return parsePhone(p);
  if (p.startsWith('974')) return { error: 'رقم جوال قطر 8 أرقام (مثل 55123456)' };
  for (const g of GCC) {
    if (g.cc === '974' || !p.startsWith(g.cc)) continue;
    const rest = p.slice(g.cc.length);
    if (rest.length === g.len && g.re.test(rest)) return { phone: p };
    if (intl) return { error: `رقم جوال ${g.name} ${g.len} أرقام (مثل ${g.ex})` };
  }
  if (intl && p.length >= 10 && p.length <= 15 && !p.startsWith('0')) return { phone: p };
  return { error: 'رقم الجوال القطري 8 أرقام (مثل 55123456) — ولو رقمك من دولة ثانية اكتبه مع رمز الدولة مثل +965' };
}

const TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gamil.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'icloud.con': 'icloud.com',
  'outlook.con': 'outlook.com',
};

export function checkEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (!e) return 'اكتب إيميلك (يوصلك عليه إيصال الدفع)';
  if (/\s/.test(e)) return 'الإيميل ما فيه مسافات';
  const m = e.match(/^[^@]+@([^@]+\.[a-z]{2,})$/);
  if (!m) return 'الإيميل مو صحيح — مثال: name@gmail.com';
  const fix = TYPOS[m[1]];
  if (fix) return `تقصد ${e.split('@')[0]}@${fix}؟`;
  return null;
}
