import { useEffect, useState, type ReactNode } from 'react';
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

/** شاشة إدخال كود الشراء قبل فتح التطبيق */
export function LicenseGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>('checking');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'code' | 'buy'>('buy');
  const [info, setInfo] = useState<{ price: number; online: boolean }>({ price: 350, online: false });
  const [buyer, setBuyer] = useState({ name: '', phone: '', email: '' });
  const [paidCode, setPaidCode] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/status');
        const s = (await r.json()) as { licensing?: boolean; price?: number; online?: boolean };
        if (!s.licensing) return setState('open');
        setInfo({ price: s.price ?? 350, online: !!s.online });
      } catch {
        // بيئة التطوير بدون خادم: لا يوجد نظام أكواد
        if (import.meta.env.DEV) return setState('open');
        setError('تعذر الاتصال بالخادم — تأكد من الإنترنت وحدّث الصفحة');
        return setState('locked');
      }
      // العودة من صفحة الدفع
      const q = new URLSearchParams(window.location.search);
      const orderId = q.get('custom1') || q.get('transId') || get(ORDER_KEY);
      const paymentId = q.get('id');
      if ((q.has('id') || q.has('custom1') || q.has('paid')) && orderId) {
        history.replaceState(null, '', window.location.pathname);
        for (let i = 0; i < 6; i++) {
          try {
            const v = await post('/api/checkout/verify', { orderId, paymentId });
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
        setError('لم يتأكد الدفع بعد. إذا تم الخصم من حسابك تواصل معنا وسنرسل لك الكود.');
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
      } else setError(data.error || 'تعذر التفعيل');
    } catch {
      setError('تعذر الاتصال — تأكد من الإنترنت وحاول مرة ثانية');
    } finally {
      setBusy(false);
    }
  };

  const buy = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (info.online) {
        const { data } = await post('/api/checkout', buyer);
        const d = data as { ok?: boolean; error?: string; payUrl?: string; orderId?: string };
        if (d.ok && d.payUrl) {
          if (d.orderId) set(ORDER_KEY, d.orderId);
          window.location.href = d.payUrl;
          return;
        }
        setError(d.error || 'تعذر فتح صفحة الدفع');
      } else {
        const { data } = await post('/api/order', buyer);
        if (data.ok) setNotice('وصلنا طلبك ✓ بنرسل لك رابط الدفع على الواتساب خلال دقائق، وبعد الدفع يوصلك كود التفعيل.');
        else setError(data.error || 'تعذر إرسال الطلب');
      }
    } catch {
      setError('تعذر الاتصال — حاول مرة ثانية');
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
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-sand-50 p-6 shadow-2xl" data-testid="license-gate">
        <div className="sadu-band h-2 rounded" />
        <div className="text-center">
          <div className="text-4xl">⛺</div>
          <h1 className="mt-2 text-xl font-bold text-dune">مخطط العنة</h1>
          <p className="mt-1 text-sm text-sand-700">صمّم عنتك ثنائي وثلاثي الأبعاد قبل التركيب — خيام، ملعب، ممرات، وإنارة ليلية</p>
        </div>
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
              <div className="text-2xl font-bold text-dune">{info.price} ر.ق</div>
              <div className="text-xs text-sand-600">دفعة واحدة • استخدام مدى الحياة</div>
            </div>
            <input required value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} placeholder="الاسم" aria-label="الاسم" className="h-10 w-full rounded-lg border border-sand-300 bg-white px-3 outline-none focus:border-gold-500" />
            <input required value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} placeholder="رقم الجوال" aria-label="رقم الجوال" inputMode="tel" dir="ltr" className="h-10 w-full rounded-lg border border-sand-300 bg-white px-3 text-right outline-none focus:border-gold-500" />
            {info.online && (
              <input required type="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} placeholder="الإيميل (لإيصال الدفع)" aria-label="الإيميل" dir="ltr" className="h-10 w-full rounded-lg border border-sand-300 bg-white px-3 text-right outline-none focus:border-gold-500" />
            )}
            {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</div>}
            <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gold-500 font-bold text-dune disabled:opacity-50" data-testid="buy">
              {busy && <Loader2 size={18} className="animate-spin" />} {info.online ? 'ادفع الآن (سكيب كاش)' : 'اطلب الآن'}
            </button>
            <p className="text-center text-[11px] text-sand-600">{info.online ? 'دفع آمن عبر سكيب كاش، والكود يظهر لك مباشرة بعد الدفع.' : 'بنرسل لك رابط الدفع على الواتساب.'}</p>
          </form>
        )}
      </div>
    </div>
  );
}
