// نفس قواعد src/lib/buyer.ts (التحقق في الخادم أيضاً)
export function normalizeDigits(s) {
  return String(s ?? '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}
export function checkName(raw) {
  const n = String(raw ?? '').trim();
  if (n.length < 2) return 'اكتب اسمك';
  if (/\d|[٠-٩۰-۹]/.test(n)) return 'الاسم ما فيه أرقام';
  if (!/\p{L}/u.test(n)) return 'الاسم لازم يكون حروف';
  if (n.length > 60) return 'الاسم طويل — اكتب الاسم الأول والعائلة بس';
  return null;
}
export function parsePhone(raw) {
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
  if (p.length >= 9 && p.length <= 15 && !p.startsWith('0')) return { phone: p };
  return { error: 'رقم الجوال لازم 8 أرقام (مثل 55123456)' };
}
/**
 * رقم الشراء (صارم): لازم يكون رقم يقبله نظام الدفع، وإلا سكيب كاش يرفض بـ «Invalid details».
 * قطري 8 أرقام، أو خليجي برمز دولته وطوله الصحيح، أو أي رقم دولي مكتوب بـ + أو 00 في أوله.
 */
export function parseBuyerPhone(raw) {
  const s = normalizeDigits(raw).replace(/[\s\-().]/g, '');
  if (!s) return { error: 'اكتب رقم جوالك' };
  const intl = s.startsWith('+') || s.startsWith('00');
  const p = s.startsWith('+') ? s.slice(1) : s.startsWith('00') ? s.slice(2) : s;
  if (!/^\d+$/.test(p)) return { error: 'رقم الجوال أرقام بس (مثل 55123456)' };
  if (p.length === 8 || (p.length === 11 && p.startsWith('974'))) return parsePhone(p);
  if (p.startsWith('974')) return { error: 'رقم جوال قطر 8 أرقام (مثل 55123456)' };
  const gcc = [
    ['965', 'الكويت', 8, /^[4569]/, '50012345'],
    ['973', 'البحرين', 8, /^3/, '36123456'],
    ['968', 'عُمان', 8, /^[79]/, '92123456'],
    ['966', 'السعودية', 9, /^5/, '501234567'],
    ['971', 'الإمارات', 9, /^5/, '501234567'],
  ];
  for (const [cc, name, len, re, ex] of gcc) {
    if (!p.startsWith(cc)) continue;
    const rest = p.slice(cc.length);
    if (rest.length === len && re.test(rest)) return { phone: p };
    if (intl) return { error: `رقم جوال ${name} ${len} أرقام (مثل ${ex})` };
  }
  if (intl && p.length >= 10 && p.length <= 15 && !p.startsWith('0')) return { phone: p };
  return { error: 'رقم الجوال القطري 8 أرقام (مثل 55123456) — ولو رقمك من دولة ثانية اكتبه مع رمز الدولة مثل +965' };
}

export function checkEmail(raw) {
  const e = String(raw ?? '').trim().toLowerCase();
  if (!e) return 'اكتب إيميلك (يوصلك عليه إيصال الدفع)';
  if (/\s/.test(e)) return 'الإيميل ما فيه مسافات';
  if (!/^[^@]+@[^@]+\.[a-z]{2,}$/.test(e)) return 'الإيميل مو صحيح — مثال: name@gmail.com';
  return null;
}
/** يتحقق من كل الخانات: يرجع { errors: {name?, phone?, email?} } أو البيانات النظيفة */
export function validateBuyer({ name, phone, email }, needEmail) {
  const errors = {};
  const n = checkName(name);
  if (n) errors.name = n;
  const ph = parseBuyerPhone(phone);
  if (ph.error) errors.phone = ph.error;
  if (needEmail) {
    const em = checkEmail(email);
    if (em) errors.email = em;
  }
  if (Object.keys(errors).length) return { errors };
  return { name: String(name).trim().slice(0, 60), phone: ph.phone, email: needEmail ? String(email).trim().toLowerCase().slice(0, 100) : undefined };
}
