import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getPlan, useEditor } from '../store/editorStore';

/** التجربة قصيرة (30 ثانية): نتخطى رسالة الترحيب والجولة عشان يشوف المجسم على طول */
function skipIntro() {
  try {
    localStorage.setItem('enna.v1.tourDone', '1');
  } catch {
    /* تجاهل */
  }
  if (useEditor.getState().dialog === 'welcome') useEditor.getState().openDialog(null);
}
import { renderPlanCanvas } from '../render2d/exportImage';
import { OWNER_AR, OWNER_LINE } from '../lib/brand';
import { checkEmail, checkName, parsePhone } from '../lib/buyer';
import { KeyRound, Loader2, LogIn } from 'lucide-react';
import { LangToggle } from './LangToggle';
import { getLang } from '../lib/i18n';
import { track } from '../lib/stats';
import { setBuyer as pixelBuyer, trackCheckout, trackDemoBuyClick, trackPurchase, trackTrial, trackTrialEnded } from '../lib/pixel';
import { demoLeft, demoUsed, isDemo, setDemoActive, startDemo } from '../lib/demo';

const TOKEN_KEY = 'enna.license.token';
const DEVICE_KEY = 'enna.license.device';

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    /* تجاهل */
  }
}
function deviceId(): string {
  let d = get(DEVICE_KEY);
  if (!d) {
    d = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    set(DEVICE_KEY, d);
  }
  return d;
}
type ApiData = { ok?: boolean; error?: string; token?: string; hasPw?: boolean; phone?: string; errors?: Record<string, string> };
async function post(url: string, body: unknown): Promise<{ status: number; data: ApiData }> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

type State = 'checking' | 'locked' | 'open' | 'paid' | 'setpw';
const PW_SKIP_KEY = 'enna.pw.skip';
/** نذكّره يحط كلمة مرور كل 3 أيام لين يحطها */
const pwSkippedRecently = () => Date.now() - Number(get(PW_SKIP_KEY) || 0) < 3 * 86400000;
interface Receipt {
  ref: string;
  paymentId: string;
  amount: number;
  paidAt: number;
  name: string;
  seller: string;
  sellerAddress?: string;
  sellerCR?: string;
  sellerPhone?: string;
  test?: boolean;
}

/** إيصال مختصر بعد الدفع (حتى لو العميل ما كتب إيميل) — ينحفظ صورة أو PDF من زر الطباعة */
function ReceiptCard({ r }: { r: Receipt }) {
  const rows: [string, string][] = [
    ['رقم الطلب', r.ref],
    ['التاريخ', new Date(r.paidAt).toLocaleString('ar-QA-u-nu-latn', { dateStyle: 'long', timeStyle: 'short' })],
    ['العميل', r.name],
    ['المنتج', 'مخطط العنة — ترخيص مدى الحياة'],
    ['المبلغ المدفوع', `${r.amount} ر.ق`],
    ['طريقة الدفع', 'سكيب كاش'],
    ['البائع', r.seller],
  ];
  if (r.sellerAddress) rows.push(['عنوان البائع', r.sellerAddress]);
  if (r.sellerCR) rows.push(['السجل التجاري', r.sellerCR]);
  if (r.sellerPhone) rows.push(['هاتف البائع', '+' + r.sellerPhone]);
  if (r.paymentId) rows.splice(1, 0, ['مرجع سكيب كاش', r.paymentId]);
  return (
    <div className="receipt rounded-lg border border-sand-300 bg-white p-3 text-right text-[12px]" data-testid="receipt" data-no-tr dir="rtl">
      <div className="mb-1.5 flex items-center justify-between">
        <b className="text-[13px] text-dune">🧾 إيصال الدفع</b>
        <button type="button" onClick={() => window.print()} className="no-print rounded-md bg-sand-100 px-2 py-1 text-[11px] font-semibold text-dune">حفظ / طباعة</button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-sand-600">{k}</dt>
            <dd className="font-semibold text-dune [overflow-wrap:anywhere]">
              {k === 'البائع' && v.includes(' (') ? (
                <>
                  {v.split(' (')[0]}
                  <span className="block text-[11px] font-normal text-sand-600" dir="ltr">{v.split(' (')[1].replace(/\)$/, '')}</span>
                </>
              ) : (
                <bdi>{v}</bdi>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type SiteContent = Partial<Record<'banner' | 'title' | 'tagline' | 'f1' | 'f2' | 'f3' | 'f4' | 'buyNote' | 'support', string>>;
const waLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
const DEFAULT_TEXT = { title: 'مخطط العنة ⛺', tagline: 'صمّم عنتك قبل لا تركّبها، واتفقوا على كل شي قبل ما تشترون' };
const localPhone = (ph?: string) => (ph && ph.startsWith('974') && ph.length === 11 ? ph.slice(3) : ph || '');
const ORDER_KEY = 'enna.order';
const REF_KEY = 'enna.ref';
export { TOKEN_KEY };

/** شاشة إدخال كود الشراء قبل فتح التطبيق */
export function LicenseGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>('checking');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'code' | 'buy' | 'login'>(() => (get(DEVICE_KEY) ? 'login' : 'buy'));
  const [login, setLogin] = useState({ phone: '', password: '' });
  const [loginErr, setLoginErr] = useState<{ phone?: string; password?: string }>({});
  const [acctPhone, setAcctPhone] = useState('');
  const [info, setInfo] = useState<{ price: number; online: boolean; basePrice: number; refValid: boolean; sale?: boolean; content: SiteContent }>({ price: 299, online: false, basePrice: 299, refValid: false, content: {} });
  const [buyer, setBuyer] = useState({ name: '', phone: '', email: '' });
  const [fieldErr, setFieldErr] = useState<{ name?: string | null; phone?: string | null; email?: string | null }>({});
  const checkField = (k: 'name' | 'phone' | 'email', v: string) =>
    k === 'name' ? checkName(v) : k === 'phone' ? parsePhone(v).error ?? null : checkEmail(v);
  // الخطأ يطلع بعد ما يطلع من الخانة، ويختفي أول ما يصلّحه
  const onField = (k: 'name' | 'phone' | 'email', v: string) => {
    setBuyer((b) => ({ ...b, [k]: v }));
    if (fieldErr[k]) setFieldErr((f) => ({ ...f, [k]: checkField(k, v) }));
  };
  const [paidCode, setPaidCode] = useState('');
  const [demoOver, setDemoOver] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const qRef = new URLSearchParams(window.location.search).get('ref');
        if (qRef) set(REF_KEY, qRef.slice(0, 20));
        const ref = get(REF_KEY) || '';
        const r = await fetch('/api/status' + (ref ? `?ref=${encodeURIComponent(ref)}` : ''));
        const s = (await r.json()) as { licensing?: boolean; price?: number; basePrice?: number; refValid?: boolean; online?: boolean };
        if (!s.licensing) return setState('open');
        setInfo({ price: s.price ?? 299, online: !!s.online, basePrice: s.basePrice ?? s.price ?? 299, refValid: !!s.refValid, sale: !!(s as { sale?: boolean }).sale, content: (s as { content?: SiteContent }).content || {} });
      } catch {
        // بيئة التطوير بدون خادم: لا يوجد نظام أكواد
        if (import.meta.env.DEV) return setState('open');
        // بدون إنترنت: اللي فعّل قبل يدخل عادي (التحقق يصير لما يرجع النت)
        if (get(TOKEN_KEY)) return setState('open');
        setError('ما قدرنا نتصل — تأكد من الإنترنت وحدّث الصفحة');
        return setState('locked');
      }
      // العودة من صفحة الدفع
      const q = new URLSearchParams(window.location.search);
      const orderId = q.get('custom1') || q.get('transId') || get(ORDER_KEY);
      const paymentId = q.get('id');
      if ((q.has('id') || q.has('custom1') || q.has('paid')) && (orderId || paymentId)) {
        history.replaceState(null, '', window.location.pathname);
        for (let i = 0; i < 6; i++) {
          try {
            const v = await post('/api/checkout/verify', { orderId, paymentId });
            if ((v.data as { failed?: boolean }).failed) {
              setError((v.data as { error?: string }).error || 'الدفع ما تم — جرّب مرة ثانية');
              setMode('buy');
              return setState('locked');
            }
            const code = (v.data as { code?: string }).code;
            if (v.data.ok && code) {
              const a = await post('/api/activate', { code, device: deviceId() });
              if (a.data.ok && a.data.token) set(TOKEN_KEY, a.data.token);
              setAcctPhone(localPhone(a.data.phone));
              set(ORDER_KEY, null);
              setPaidCode(code);
              const rc = (v.data as { receipt?: Receipt }).receipt ?? null;
              setReceipt(rc);
              // تجربة الشراء من اللوحة ما تنحسب بيعة عند ميتا
              if (rc && !rc.test) trackPurchase(rc.ref, rc.amount);
              return setState('paid');
            }
          } catch {
            /* إعادة المحاولة */
          }
          await new Promise((res) => setTimeout(res, 2500));
        }
        setError('الدفع للحين ما تأكد من سكيب كاش. إذا انخصم المبلغ من حسابك، تواصل معنا على الواتساب ونرسل لك الكود خلال دقائق.');
        return setState('locked');
      }
      const token = get(TOKEN_KEY);
      if (!token) {
        // تجربة مجانية شغالة في هالتبويب؟ نكملها
        if (demoLeft() > 0) {
          skipIntro();
          setDemoActive(true);
          return setState('open');
        }
        track('visit');
        return setState('locked');
      }
      try {
        const { status, data } = await post('/api/check', { token });
        if (data.ok) {
          if (data.hasPw === false && !pwSkippedRecently()) {
            setAcctPhone(localPhone(data.phone));
            return setState('setpw');
          }
          return setState('open');
        }
        if (status === 401 || status === 403) {
          set(TOKEN_KEY, null);
          setError(data.error || '');
          return setState('locked');
        }
        setState('open');
      } catch {
        // انقطاع الشبكة: نسمح لمن فعّل سابقاً
        setState('open');
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await post('/api/activate', { code, device: deviceId() });
      if (data.ok && data.token) {
        set(TOKEN_KEY, data.token);
        setAcctPhone(localPhone(data.phone));
        setState(data.hasPw ? 'open' : 'setpw');
      } else setError(data.error || 'ما تفعّل الكود — حاول مرة ثانية');
    } catch {
      setError('ما قدرنا نتصل — تأكد من الإنترنت وحاول مرة ثانية');
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const errs = { phone: parsePhone(login.phone).error, password: login.password ? undefined : 'اكتب كلمة المرور' };
    setLoginErr(errs);
    if (errs.phone || errs.password) return;
    setBusy(true);
    try {
      const { data } = await post('/api/login', { ...login, device: deviceId() });
      if (data.ok && data.token) {
        set(TOKEN_KEY, data.token);
        setState('open');
      } else if (data.errors) setLoginErr(data.errors);
      else setError(data.error || 'ما قدرنا ندخلك — حاول مرة ثانية');
    } catch {
      setError('ما قدرنا نتصل — تأكد من الإنترنت وحاول مرة ثانية');
    } finally {
      setBusy(false);
    }
  };

  const buy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const errs = { name: checkName(buyer.name), phone: parsePhone(buyer.phone).error ?? null, email: info.online && buyer.email.trim() ? checkEmail(buyer.email) : null };
    setFieldErr(errs);
    if (errs.name || errs.phone || errs.email) return;
    pixelBuyer(buyer);
    track('checkout_click');
    setBusy(true);
    try {
      if (info.online) {
        const { data } = await post('/api/checkout', { ...buyer, ref: get(REF_KEY) || undefined });
        const d = data as { ok?: boolean; error?: string; payUrl?: string; orderId?: string };
        if (d.ok && d.payUrl) {
          if (d.orderId) set(ORDER_KEY, d.orderId);
          trackCheckout(info.price, d.orderId);
          window.location.href = d.payUrl;
          return;
        }
        const fe = (d as { errors?: typeof fieldErr }).errors;
        if (fe) setFieldErr(fe);
        else setError(d.error || 'ما انفتحت صفحة الدفع — حاول مرة ثانية');
      } else {
        const { data } = await post('/api/order', { ...buyer, ref: get(REF_KEY) || undefined });
        if (data.ok) setNotice('وصلنا طلبك ✓ بنرسل لك رابط الدفع على الواتساب خلال دقائق، وبعد الدفع يوصلك كود التفعيل.');
        else setError(data.error || 'ما انرسل الطلب — حاول مرة ثانية');
      }
    } catch {
      setError('ما قدرنا نتصل — حاول مرة ثانية');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'open')
    return (
      <>
        {children}
        {isDemo() && (
          <DemoBar
            onBuy={() => {
              trackDemoBuyClick();
              setMode('buy');
              setState('locked');
            }}
            onEnd={() => {
              trackTrialEnded();
              setDemoActive(false);
              setMode('buy');
              setNotice('');
              setError('');
              setDemoOver(true);
              setState('locked');
            }}
          />
        )}
      </>
    );
  if (state === 'checking')
    return (
      <div className="flex h-full items-center justify-center bg-sand-100 text-sand-800">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (state === 'paid' || state === 'setpw')
    return (
      <div className="h-full overflow-y-auto bg-dune">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl bg-sand-50 p-6 shadow-2xl" data-testid={state}>
          {state === 'paid' ? (
            <div className="space-y-3 text-center">
              <div className="text-4xl">🎉</div>
              <h1 className="text-xl font-bold text-dune">تم الدفع بنجاح</h1>
              <p className="text-sm text-sand-700">هذا كود التفعيل الخاص فيك — احتفظ فيه احتياط:</p>
              <div className="rounded-lg border-2 border-gold-500 bg-white p-3 font-mono text-lg font-bold tracking-wider text-dune" dir="ltr">{paidCode}</div>
              <button type="button" onClick={() => navigator.clipboard?.writeText(paidCode).catch(() => undefined)} className="h-10 w-full rounded-lg border border-sand-300 bg-white font-semibold">نسخ الكود</button>
              {receipt && <ReceiptCard r={receipt} />}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-3xl">🔑</div>
              <h1 className="mt-1 text-lg font-bold text-dune">ادخل من أي جهاز بدون كود</h1>
            </div>
          )}
          <SetPassword initialPhone={acctPhone} onDone={() => setState('open')} onSkip={() => { set(PW_SKIP_KEY, String(Date.now())); setState('open'); }} skipLabel={state === 'paid' ? 'بعدين — ابدأ التصميم' : 'بعدين'} />
        </div>
      </div>
      </div>
    );

  const title = info.content.title || DEFAULT_TEXT.title;
  const tagline = info.content.tagline || DEFAULT_TEXT.tagline;
  const feats = [info.content.f1, info.content.f2, info.content.f3, info.content.f4];
  const tabs: [typeof mode, string][] = [
    ['buy', 'شراء'],
    ['login', 'دخول'],
  ];
  return (
    <div className="h-full overflow-y-auto bg-dune">
    <div className="flex min-h-full items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-sand-50 shadow-2xl md:max-w-xl lg:grid lg:max-w-5xl lg:grid-cols-[1.15fr_1fr]" data-testid="license-gate">
        <div className="relative lg:flex lg:flex-col lg:bg-dune">
          <img src={getLang() === 'en' ? './og-en.jpg' : './og.jpg'} alt="مجسم عنة قطرية في الليل" className="aspect-[1200/630] w-full object-cover object-left lg:aspect-auto lg:min-h-0 lg:flex-1" />
          <div className="sadu-band absolute inset-x-0 bottom-0 h-1.5 lg:hidden" />
          <LangToggle className="absolute top-3 left-3 shadow" />
          <div className="hidden space-y-4 p-8 text-sand-50 lg:block">
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="mt-1 text-sm text-sand-300">{tagline}</p>
            </div>
            <Features dark items={feats} />
            <p className="text-[11px] text-sand-400">{OWNER_LINE} · <a href="/privacy" target="_blank" rel="noopener" className="underline hover:text-sand-200" data-testid="privacy-link-desk">سياسة الخصوصية</a></p>
          </div>
        </div>
        <div className="space-y-4 p-6 lg:flex lg:flex-col lg:justify-center lg:p-10">
          {info.content.banner && <div className="rounded-lg bg-gold-500 px-3 py-2 text-center text-sm font-bold text-dune" data-testid="site-banner">{info.content.banner}</div>}
          <div className="text-center lg:hidden">
            <h1 className="text-xl font-bold text-dune">{title}</h1>
            <p className="mt-1 text-sm text-sand-700">{tagline}</p>
          </div>
          <h1 className="hidden text-center text-xl font-bold text-dune lg:block">{mode === 'buy' ? 'اشترِ مرة وحدة واستخدمه مدى الحياة' : 'أهلاً فيك من جديد 👋'}</h1>
          <div className="lg:hidden"><Features items={feats} /></div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-sand-200 p-1 text-sm font-semibold">
            {tabs.map(([m, label]) => {
              const on = m === 'buy' ? mode === 'buy' : mode !== 'buy';
              return (
                <button key={m} type="button" data-testid={`tab-${m}`} onClick={() => { setMode(m); setError(''); }} className={on ? 'rounded-md bg-white py-1.5 text-dune shadow' : 'py-1.5 text-sand-700'}>{label}</button>
              );
            })}
          </div>
          {mode === 'login' ? (
            <form onSubmit={doLogin} className="space-y-2.5" data-testid="login-form">
              <Field label="رقم الجوال" testid="login-phone" err={loginErr.phone} value={login.phone} onChange={(v) => { setLogin((l) => ({ ...l, phone: v })); if (loginErr.phone) setLoginErr((x) => ({ ...x, phone: parsePhone(v).error })); }} placeholder="رقم الجوال (مثل 55123456)" inputProps={{ inputMode: 'tel', dir: 'ltr', autoComplete: 'username' }} />
              <Field label="كلمة المرور" testid="login-password" err={loginErr.password} value={login.password} onChange={(v) => { setLogin((l) => ({ ...l, password: v })); if (loginErr.password) setLoginErr((x) => ({ ...x, password: undefined })); }} placeholder="كلمة المرور" inputProps={{ type: 'password', dir: 'ltr', autoComplete: 'current-password' }} />
              {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</div>}
              <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gold-500 font-bold text-dune disabled:opacity-50" data-testid="login-submit">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />} دخول
              </button>
              <div className="flex justify-between text-[12px]">
                <button type="button" className="font-semibold text-gold-700 underline" onClick={() => { setMode('code'); setError(''); }} data-testid="use-code">أول مرة؟ ادخل بالكود</button>
                {info.content.support ? (
                  <a href={waLink(info.content.support, 'هلا، نسيت كلمة المرور حق مخطط العنة')} target="_blank" rel="noreferrer" className="font-semibold text-gold-700 underline" data-testid="support-link">
                    نسيت كلمة المرور؟ تواصل معنا
                  </a>
                ) : (
                  <span className="text-sand-600">نسيت كلمة المرور؟ تواصل مع البائع</span>
                )}
              </div>
            </form>
          ) : mode === 'code' ? (
            <form onSubmit={submit} className="space-y-3">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ENNA-XXXX-XXXX-XXXX"
                dir="ltr"
                aria-label="كود التفعيل"
                className="h-11 w-full rounded-lg border border-sand-300 bg-white px-3 text-center font-mono tracking-wider outline-none focus:border-gold-500"
                data-testid="license-input"
              />
              {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</div>}
              <button type="submit" disabled={busy || code.trim().length < 10} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gold-500 font-bold text-dune disabled:opacity-50">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />} تفعيل
              </button>
              <button type="button" className="w-full text-[12px] font-semibold text-gold-700 underline" onClick={() => { setMode('login'); setError(''); }}>عندي كلمة مرور — ادخل برقم الجوال</button>
            </form>
          ) : notice ? (
            <div className="rounded-lg bg-turf-500/10 p-3 text-sm text-turf-700">{notice}</div>
          ) : (
          <form onSubmit={buy} className="space-y-2.5">
            {(demoOver || demoUsed()) && <TrialOverCard />}
            <div className="rounded-lg bg-white p-3 text-center">
              {info.basePrice > info.price && (
                <div className="mb-1 rounded-md bg-turf-500/10 px-2 py-1 text-xs font-semibold text-turf-700" data-testid="price-badge">{info.refValid ? '🎁 وصلك خصم من صديقك' : '🔥 عرض لفترة محدودة'}</div>
              )}
              <div className="flex items-baseline justify-center gap-3" data-testid="price">
                <span className="text-3xl font-bold text-dune">
                  <span className="tabular-nums">{info.price}</span> <span className="text-lg">ر.ق</span>
                </span>
                {info.basePrice > info.price && (
                  <span className="text-base text-sand-500 line-through decoration-red-400/70" data-testid="price-old">
                    <span className="tabular-nums">{info.basePrice}</span> ر.ق
                  </span>
                )}
              </div>
              {info.basePrice > info.price && (
                <div className="mt-0.5 text-[12px] font-semibold text-turf-700" data-testid="price-save">
                  {`توفّر ${info.basePrice - info.price} ر.ق`}
                </div>
              )}
              <div className="mt-0.5 text-xs text-sand-600">دفعة واحدة • استخدام مدى الحياة</div>
            </div>
            {(
              [
                { k: 'name', ph: 'الاسم', label: 'الاسم', props: { autoComplete: 'name' } },
                { k: 'phone', ph: 'رقم الجوال (8 أرقام)', label: 'رقم الجوال', props: { inputMode: 'tel', dir: 'ltr', autoComplete: 'tel' } },
                ...(info.online ? [{ k: 'email', ph: 'الإيميل (اختياري — لإيصال الدفع)', label: 'الإيميل', props: { type: 'email', dir: 'ltr', autoComplete: 'email', inputMode: 'email' } }] : []),
              ] as { k: 'name' | 'phone' | 'email'; ph: string; label: string; props: React.InputHTMLAttributes<HTMLInputElement> }[]
            ).map((f) => (
              <div key={f.k} className="relative">
                {f.k === 'phone' && <span className="pointer-events-none absolute top-0 left-3 flex h-10 items-center text-[13px] font-semibold text-sand-500" dir="ltr">🇶🇦 +974</span>}
                <input
                  {...f.props}
                  value={buyer[f.k]}
                  onChange={(e) => onField(f.k, e.target.value)}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v) setFieldErr((x) => ({ ...x, [f.k]: checkField(f.k, v) }));
                  }}
                  placeholder={f.ph}
                  aria-label={f.label}
                  aria-invalid={!!fieldErr[f.k]}
                  className={`h-10 w-full rounded-lg border bg-white px-3 outline-none ${f.k === 'phone' ? 'pl-20' : ''} ${f.props.dir === 'ltr' ? 'text-right' : ''} ${fieldErr[f.k] ? 'border-red-400 focus:border-red-500' : 'border-sand-300 focus:border-gold-500'}`}
                  data-testid={`buyer-${f.k}`}
                />
                {fieldErr[f.k] && <div className="mt-1 px-1 text-[12px] text-red-700" data-testid={`err-${f.k}`}>{fieldErr[f.k]}</div>}
              </div>
            ))}
            {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</div>}
            <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gold-500 font-bold text-dune disabled:opacity-50" data-testid="buy">
              {busy && <Loader2 size={18} className="animate-spin" />} {info.online ? 'ادفع الآن (سكيب كاش)' : 'اطلب الآن'}
            </button>
            {info.online && !demoUsed() && (
              <button
                type="button"
                onClick={() => {
                  if (demoLeft() === 0) trackTrial();
                  startDemo();
                  skipIntro();
                  setDemoActive(true);
                  setState('open');
                }}
                disabled={demoUsed()}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border-2 border-gold-500/60 bg-white font-semibold text-dune disabled:opacity-50"
                data-testid="try-demo"
              >
                {demoLeft() > 0 ? '👀 كمّل التجربة المجانية' : demoUsed() ? 'خلصت تجربتك المجانية' : '👀 جرّب مجاناً 30 ثانية — بدون تسجيل'}
              </button>
            )}
            <p className="text-center text-[11px] text-sand-600">{info.content.buyNote || (info.online ? 'دفع آمن عبر سكيب كاش، والكود يظهر لك مباشرة بعد الدفع.' : 'بنرسل لك رابط الدفع على الواتساب.')}</p>
            <p className="text-center text-[11px] text-sand-600" data-testid="seller-note">{`البائع: ${OWNER_AR} — هالاسم يطلع في إيصال الدفع`}</p>
          </form>
          )}
          {info.content.support && (
            <a href={waLink(info.content.support, 'هلا، عندي سؤال عن مخطط العنة')} target="_blank" rel="noreferrer" className="block text-center text-[12px] font-semibold text-turf-700" data-testid="support-footer">
              💬 تحتاج مساعدة؟ كلمنا واتساب
            </a>
          )}
          <p className="text-center text-[11px] text-sand-500 lg:hidden" data-testid="owner-footer">{OWNER_LINE} · <a href="/privacy" target="_blank" rel="noopener" className="underline" data-testid="privacy-link">سياسة الخصوصية</a></p>
        </div>
      </div>
    </div>
    </div>
  );
}

const FEATURES = [
  ['🧊', 'مجسم 3D تتمشّى فيه'],
  ['🌙', 'إنارة الليل قبل الشراء'],
  ['✨', 'يولّد لك 5 أفكار توزيع'],
  ['📐', 'المقاسات والكميات محسوبة'],
];
/** «🧊 نص» → [أيقونة، نص] — إذا ما بدأ بإيموجي نخلي الأيقونة الافتراضية */
function splitFeature(v: string | undefined, def: string[]): string[] {
  if (!v) return def;
  const m = v.match(/^(\S+)\s+(.+)$/u);
  if (m && !/[\p{L}\p{N}]/u.test(m[1])) return [m[1], m[2]];
  return [def[0], v];
}
function Features({ dark, items = [] }: { dark?: boolean; items?: (string | undefined)[] }) {
  return (
    <ul className={`grid grid-cols-2 gap-2 text-[12px] font-semibold ${dark ? 'text-sand-50' : 'text-dune'}`}>
      {FEATURES.map((d, k) => splitFeature(items[k], d)).map(([i, t]) => (
        <li key={t} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${dark ? 'bg-white/10' : 'bg-white'}`}>
          <span className="text-base">{i}</span>
          {t}
        </li>
      ))}
    </ul>
  );
}

function Field({ label, testid, err, value, onChange, placeholder, inputProps }: { label: string; testid: string; err?: string | null; value: string; onChange: (v: string) => void; placeholder: string; inputProps?: React.InputHTMLAttributes<HTMLInputElement> }) {
  return (
    <div>
      <input
        {...inputProps}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={!!err}
        className={`h-10 w-full rounded-lg border bg-white px-3 text-right outline-none ${err ? 'border-red-400 focus:border-red-500' : 'border-sand-300 focus:border-gold-500'}`}
        data-testid={testid}
      />
      {err && <div className="mt-1 px-1 text-[12px] text-red-700" data-testid={`${testid}-err`}>{err}</div>}
    </div>
  );
}

/** تعيين كلمة مرور للدخول برقم الجوال من أي جهاز */
function SetPassword({ initialPhone, onDone, onSkip, skipLabel }: { initialPhone: string; onDone: () => void; onSkip: () => void; skipLabel: string }) {
  const [phone, setPhone] = useState(initialPhone);
  const [pw, setPw] = useState('');
  const [errs, setErrs] = useState<{ phone?: string; password?: string }>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const ph = parsePhone(phone);
    const v = { phone: ph.error, password: pw.length < 6 ? 'كلمة المرور 6 أحرف أو أرقام على الأقل' : undefined };
    setErrs(v);
    if (v.phone || v.password) return;
    setBusy(true);
    try {
      const { data } = await post('/api/account/password', { token: get(TOKEN_KEY), phone, password: pw });
      if (data.ok) {
        set(PW_SKIP_KEY, null);
        setDone(localPhone(data.phone));
      } else if (data.errors) setErrs(data.errors);
      else setError(data.error || 'ما انحفظت — حاول مرة ثانية');
    } catch {
      setError('ما قدرنا نتصل — حاول مرة ثانية');
    } finally {
      setBusy(false);
    }
  };
  if (done)
    return (
      <div className="space-y-3 text-center" data-testid="pw-done">
        <div className="rounded-lg bg-turf-500/10 p-3 text-sm text-turf-700">
          تم ✓ من أي جهاز ثاني: اختر «دخول» واكتب رقمك <b dir="ltr">{done}</b> وكلمة المرور.
        </div>
        <button type="button" onClick={onDone} className="h-11 w-full rounded-lg bg-gold-500 font-bold text-dune">ابدأ تصميم عنتك ⛺</button>
      </div>
    );
  return (
    <form onSubmit={save} className="space-y-2.5" data-testid="setpw-form">
      <p className="text-center text-sm text-sand-700">حط كلمة مرور، وبعدها تدخل من جوالك أو اللابتوب أو أي جهاز برقم جوالك — بدون الكود.</p>
      <Field label="رقم الجوال" testid="setpw-phone" err={errs.phone} value={phone} onChange={(v) => { setPhone(v); if (errs.phone) setErrs((x) => ({ ...x, phone: parsePhone(v).error })); }} placeholder="رقم الجوال (مثل 55123456)" inputProps={{ inputMode: 'tel', dir: 'ltr', autoComplete: 'username' }} />
      <Field label="كلمة المرور" testid="setpw-password" err={errs.password} value={pw} onChange={(v) => { setPw(v); if (errs.password && v.length >= 6) setErrs((x) => ({ ...x, password: undefined })); }} placeholder="كلمة مرور جديدة (6 على الأقل)" inputProps={{ type: 'password', dir: 'ltr', autoComplete: 'new-password' }} />
      {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</div>}
      <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gold-500 font-bold text-dune disabled:opacity-50" data-testid="setpw-save">
        {busy && <Loader2 size={18} className="animate-spin" />} حفظ وابدأ
      </button>
      <button type="button" onClick={onSkip} className="w-full text-[12px] text-sand-600 underline" data-testid="setpw-skip">{skipLabel}</button>
    </form>
  );
}

/** شريط التجربة المجانية: العد التنازلي + زر الشراء + علامة خفيفة على الشاشة (لو أحد صوّر) */
function DemoBar({ onBuy, onEnd }: { onBuy: () => void; onEnd: () => void }) {
  const [left, setLeft] = useState(demoLeft());
  useEffect(() => {
    const t = setInterval(() => {
      const l = demoLeft();
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        onEnd();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [onEnd]);
  const m = Math.floor(left / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  const low = left < 10000;
  // ننزّل التطبيق تحت الشريط بدل ما يغطي عليه
  useEffect(() => {
    const r = document.getElementById('root');
    if (!r) return;
    r.style.marginTop = '2rem';
    r.style.height = 'calc(100% - 2rem)';
    return () => {
      r.style.marginTop = '';
      r.style.height = '';
    };
  }, []);
  return (
    <>
      <div className="no-print pointer-events-none fixed inset-0 z-[35] overflow-hidden opacity-[0.07]" aria-hidden="true" data-testid="demo-watermark">
        <div className="absolute -inset-1/2 flex rotate-[-20deg] flex-wrap content-center gap-x-24 gap-y-20 text-2xl font-bold text-dune">
          {Array.from({ length: 60 }, (_, i) => (
            <span key={i} className="whitespace-nowrap">نسخة تجربة • i3enna.qa</span>
          ))}
        </div>
      </div>
      <div className={`no-print fixed inset-x-0 top-0 z-[60] flex h-8 items-center justify-center gap-2 whitespace-nowrap px-2 text-[12px] font-semibold ${low ? 'bg-red-600 text-white' : 'bg-gold-500 text-dune'}`} data-testid="demo-bar">
        <span>👀 تجربة مجانية</span>
        <span className="tabular-nums" dir="ltr">{m}:{String(sec).padStart(2, '0')}</span>
        <span className="hidden opacity-80 sm:inline">• التصدير بعد الشراء • تصميمك ينحفظ</span>
        <button type="button" onClick={onBuy} className={`rounded-full px-2.5 py-0.5 font-bold ${low ? 'bg-white text-red-700' : 'bg-dune text-sand-50'}`}>اشترِ الآن</button>
      </div>
    </>
  );
}

/** نهاية التجربة: نعرض للعميل تصميمه هو (الناس تشتري لما تشوف شغلها محفوظ) */
function TrialOverCard() {
  const thumb = useMemo(() => {
    try {
      const plan = getPlan();
      if (!plan.elements.length) return '';
      return renderPlanCanvas(plan, { width: 760, footer: false, names: false, dims: false }).toDataURL('image/jpeg', 0.82);
    } catch {
      return '';
    }
  }, []);
  const ref = useRef<HTMLDivElement>(null);
  // على الجوال الكرت تحت الصورة والمميزات — ننزل له على طول
  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150);
    return () => clearTimeout(t);
  }, []);
  return (
    <div ref={ref} className="scroll-mt-4 overflow-hidden rounded-xl border-2 border-gold-500 bg-white" data-testid="demo-over">
      <div className="bg-gold-500 px-3 py-1.5 text-center text-[13px] font-bold text-dune">خلصت تجربتك 🙌 هذا تصميمك</div>
      {thumb && <img src={thumb} alt="تصميمك في التجربة" className="max-h-56 w-full object-contain bg-sand-100" data-testid="demo-thumb" />}
      <div className="px-3 py-2 text-center text-[12px] leading-relaxed text-dune">
        <b>محفوظ ويرجع لك أول ما تشتري</b> — كمّل عليه، شوفه 3D بالإنارة، وصدّره للمقاول.
      </div>
    </div>
  );
}
