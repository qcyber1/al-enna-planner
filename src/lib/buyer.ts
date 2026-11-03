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
