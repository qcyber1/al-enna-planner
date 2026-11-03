import { useEffect, useState, type ReactNode } from 'react';
import { checkEmail, checkName, parsePhone } from '../lib/buyer';
import { KeyRound, Loader2 } from 'lucide-react';

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
async function post(url: string, body: unknown): Promise<{ status: number; data: { ok?: boolean; error?: string; token?: string } }> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

type State = 'checking' | 'locked' | 'open' | 'paid';
const ORDER_KEY = 'enna.order';
const REF_KEY = 'enna.ref';
export { TOKEN_KEY };

/** شاشة إدخال كود الشراء قبل فتح التطبيق */
export function LicenseGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>('checking');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'code' | 'buy'>('buy');
  const [info, setInfo] = useState<{ price: number; online: boolean; basePrice: number; refValid: boolean }>({ price: 349, online: false, basePrice: 349, refValid: false });
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
        setInfo({ price: s.price ?? 349, online: !!s.online, basePrice: s.basePrice ?? s.price ?? 349, refValid: !!s.refValid });
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
              set(ORDER_KEY, null);
              setPaidCode(code);
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
      if (!token) return setState('locked');
      try {
        const { status, data } = await post('/api/check', { token });
        if (data.ok) return setState('open');
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
        setState('open');
      } else setError(data.error || 'ما تفعّل الكود — حاول مرة ثانية');
    } catch {
      setError('ما قدرنا نتصل — تأكد من الإنترنت وحاول مرة ثانية');
    } finally {
      setBusy(false);
    }
  };

  const buy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const errs = { name: checkName(buyer.name), phone: parsePhone(buyer.phone).error ?? null, email: info.online ? checkEmail(buyer.email) : null };
    setFieldErr(errs);
    if (errs.name || errs.phone || errs.email) return;
    setBusy(true);
    try {
      if (info.online) {
        const { data } = await post('/api/checkout', { ...buyer, ref: get(REF_KEY) || undefined });
        const d = data as { ok?: boolean; error?: string; payUrl?: string; orderId?: string };
        if (d.ok && d.payUrl) {
          if (d.orderId) set(ORDER_KEY, d.orderId);
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

  if (state === 'open') return <>{children}</>;
  if (state === 'paid')
    return (
      <div className="flex h-full items-center justify-center bg-dune p-4">
        <div className="w-full max-w-sm space-y-4 rounded-2xl bg-sand-50 p-6 text-center shadow-2xl" data-testid="paid">
          <div className="text-4xl">🎉</div>
          <h1 className="text-xl font-bold text-dune">تم الدفع بنجاح</h1>
          <p className="text-sm text-sand-700">هذا كود التفعيل الخاص فيك — احفظه (صوّره أو انسخه) لتستخدمه على أجهزتك الثانية:</p>
          <div className="rounded-lg border-2 border-gold-500 bg-white p-3 font-mono text-lg font-bold tracking-wider text-dune" dir="ltr">{paidCode}</div>
          <button type="button" onClick={() => navigator.clipboard?.writeText(paidCode).catch(() => undefined)} className="h-10 w-full rounded-lg border border-sand-300 bg-white font-semibold">نسخ الكود</button>
          <button type="button" onClick={() => setState('open')} className="h-11 w-full rounded-lg bg-gold-500 font-bold text-dune">ابدأ تصميم عنتك ⛺</button>
        </div>
      </div>
    );
  if (state === 'checking')
    return (
      <div className="flex h-full items-center justify-center bg-sand-100 text-sand-800">
        <Loader2 className="animate-spin" />
      </div>
    );
  return (
    <div className="flex h-full items-center justify-center bg-dune p-4">
      <div className="w-full max-w-sm space-y-4 overflow-hidden rounded-2xl bg-sand-50 shadow-2xl" data-testid="license-gate">
        <div className="relative">
          <img src="./og.jpg" alt="مجسم عنة قطرية في الليل" className="aspect-[1200/630] w-full object-cover object-left" />
          <div className="sadu-band absolute inset-x-0 bottom-0 h-1.5" />
        </div>
        <div className="space-y-4 px-6 pb-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-dune">مخطط العنة ⛺</h1>
          <p className="mt-1 text-sm text-sand-700">صمّم عنتك قبل لا تركّبها، واتفقوا على كل شي قبل ما تشترون</p>
        </div>
        <ul className="grid grid-cols-2 gap-2 text-[12px] font-semibold text-dune">
          {[
            ['🧊', 'مجسم 3D تتمشّى فيه'],
            ['🌙', 'إنارة الليل قبل الشراء'],
            ['✨', 'يولّد لك 5 أفكار توزيع'],
            ['📐', 'المقاسات والكميات محسوبة'],
          ].map(([i, t]) => (
            <li key={t} className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5">
              <span className="text-base">{i}</span>
              {t}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-sand-200 p-1 text-sm font-semibold">
          <button type="button" onClick={() => { setMode('buy'); setError(''); }} className={mode === 'buy' ? 'rounded-md bg-white py-1.5 text-dune shadow' : 'py-1.5 text-sand-700'}>شراء</button>
          <button type="button" onClick={() => { setMode('code'); setError(''); }} className={mode === 'code' ? 'rounded-md bg-white py-1.5 text-dune shadow' : 'py-1.5 text-sand-700'}>عندي كود</button>
        </div>
        {mode === 'code' ? (
          <form onSubmit={submit} className="space-y-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ENNA-XXXX-XXXX-XXXX-XXXX"
              dir="ltr"
              aria-label="كود التفعيل"
              className="h-11 w-full rounded-lg border border-sand-300 bg-white px-3 text-center font-mono tracking-wider outline-none focus:border-gold-500"
              data-testid="license-input"
            />
            {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</div>}
            <button type="submit" disabled={busy || code.trim().length < 10} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gold-500 font-bold text-dune disabled:opacity-50">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />} تفعيل
            </button>
          </form>
        ) : notice ? (
          <div className="rounded-lg bg-turf-500/10 p-3 text-sm text-turf-700">{notice}</div>
        ) : (
          <form onSubmit={buy} className="space-y-2.5">
            <div className="rounded-lg bg-white p-3 text-center">
              {info.refValid && info.basePrice > info.price && (
                <div className="mb-1 rounded-md bg-turf-500/10 px-2 py-1 text-xs font-semibold text-turf-700">🎁 وصلك خصم من صديقك</div>
              )}
              <div className="text-2xl font-bold text-dune">
                {info.refValid && info.basePrice > info.price && <span className="ml-2 text-base text-sand-500 line-through">{info.basePrice}</span>}
                {info.price} ر.ق
              </div>
              <div className="text-xs text-sand-600">دفعة واحدة • استخدام مدى الحياة</div>
            </div>
            {(
              [
                { k: 'name', ph: 'الاسم', label: 'الاسم', props: { autoComplete: 'name' } },
                { k: 'phone', ph: 'رقم الجوال (مثل 55123456)', label: 'رقم الجوال', props: { inputMode: 'tel', dir: 'ltr', autoComplete: 'tel' } },
                ...(info.online ? [{ k: 'email', ph: 'الإيميل (لإيصال الدفع)', label: 'الإيميل', props: { type: 'email', dir: 'ltr', autoComplete: 'email', inputMode: 'email' } }] : []),
              ] as { k: 'name' | 'phone' | 'email'; ph: string; label: string; props: React.InputHTMLAttributes<HTMLInputElement> }[]
            ).map((f) => (
              <div key={f.k}>
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
                  className={`h-10 w-full rounded-lg border bg-white px-3 outline-none ${f.props.dir === 'ltr' ? 'text-right' : ''} ${fieldErr[f.k] ? 'border-red-400 focus:border-red-500' : 'border-sand-300 focus:border-gold-500'}`}
                  data-testid={`buyer-${f.k}`}
                />
                {fieldErr[f.k] && <div className="mt-1 px-1 text-[12px] text-red-700" data-testid={`err-${f.k}`}>{fieldErr[f.k]}</div>}
              </div>
            ))}
            {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</div>}
            <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gold-500 font-bold text-dune disabled:opacity-50" data-testid="buy">
              {busy && <Loader2 size={18} className="animate-spin" />} {info.online ? 'ادفع الآن (سكيب كاش)' : 'اطلب الآن'}
            </button>
            <p className="text-center text-[11px] text-sand-600">{info.online ? 'دفع آمن عبر سكيب كاش، والكود يظهر لك مباشرة بعد الدفع.' : 'بنرسل لك رابط الدفع على الواتساب.'}</p>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}
