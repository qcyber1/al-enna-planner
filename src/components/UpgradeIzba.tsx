// العزبة منتج مستقل: بطاقة «مقفلة» + نافذة الترقية (صاحب العنة يدفع الفرق ويتفعل له على نفس الكود)
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { Loader2 } from 'lucide-react';
import { Modal } from './ui';
import { checkName, fullBuyerPhone, GCC, guessGcc, parseBuyerPhone } from '../lib/buyer';
import { getProducts } from '../lib/license';
import { trackCheckout } from '../lib/pixel';

const TOKEN_KEY = 'enna.license.token';
const ORDER_KEY = 'enna.order';

interface IzbaPrices {
  price: number;
  basePrice: number;
  upgrade: number;
  online: boolean;
}
let cache: IzbaPrices | null = null;
export async function loadIzbaPrices(): Promise<IzbaPrices | null> {
  if (cache) return cache;
  try {
    const r = await fetch('/api/status');
    const s = (await r.json()) as { online?: boolean; izba?: { price: number; basePrice: number; upgrade: number } };
    if (!s.izba) return null;
    cache = { ...s.izba, online: !!s.online };
    return cache;
  } catch {
    return null;
  }
}

export const useUpgrade = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

function token(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** بطاقة تطلع مكان مزايا العزبة لمن ما اشتراها */
export function IzbaLockedCard({ compact }: { compact?: boolean }) {
  const [p, setP] = useState<IzbaPrices | null>(cache);
  useEffect(() => {
    void loadIzbaPrices().then(setP);
  }, []);
  const hasEnna = getProducts().includes('enna') && !!token();
  return (
    <div className="space-y-3 rounded-xl border-2 border-gold-500 bg-gold-50 p-4 text-center" data-testid="izba-locked">
      <div className="text-3xl">🏡</div>
      <div className="text-base font-bold text-dune">العزبة منتج مستقل في i3enna</div>
      {!compact && (
        <ul className="mx-auto max-w-sm space-y-1 text-right text-[13px] text-sand-800">
          <li>✓ قوالب عزب جاهزة على مقاس أرضك (حلال، استراحة، زراعة)</li>
          <li>✓ المباني والغرف والتصميم الداخلي</li>
          <li>✓ الرندر الواقعي والمخطط الاحترافي A3 للمقاول</li>
          <li>✓ تنبيه الحلال فوق الريح واشتراطات البلدية</li>
        </ul>
      )}
      {hasEnna ? (
        <>
          <div className="text-sm text-dune">
            لأنك من عملاء العنة: رقّي بـ <b className="text-lg">{p?.upgrade ?? '…'} ر.ق</b>
            {p && p.price > p.upgrade && <span className="text-sand-500 line-through"> {p.price}</span>} — مرة وحدة مدى الحياة
          </div>
          <button type="button" onClick={() => useUpgrade.getState().show()} className="h-11 w-full rounded-lg bg-gold-500 font-bold text-dune" data-testid="izba-upgrade">
            رقّي للعزبة الحين
          </button>
        </>
      ) : (
        <a href="/izba" className="block h-11 w-full rounded-lg bg-gold-500 text-center font-bold leading-[2.75rem] text-dune" data-testid="izba-go">
          شوف العزبة وجرّبها مجاناً
        </a>
      )}
    </div>
  );
}

/** نافذة الدفع للترقية */
export function UpgradeIzbaDialog() {
  const { open, hide } = useUpgrade();
  const [p, setP] = useState<IzbaPrices | null>(cache);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cc, setCc] = useState(guessGcc);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  useEffect(() => {
    if (open) void loadIzbaPrices().then(setP);
  }, [open]);
  const country = GCC.find((g) => g.cc === cc) ?? GCC[0];

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const full = fullBuyerPhone(cc, phone);
    const ne = checkName(name);
    const pe = parseBuyerPhone(full).error;
    if (ne || pe) return setErr(ne || pe || '');
    setBusy(true);
    try {
      const body = JSON.stringify({ name, phone: full, product: 'izba', upgradeToken: token() });
      const url = p?.online ? '/api/checkout' : '/api/order';
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      const d = (await r.json()) as { ok?: boolean; error?: string; payUrl?: string; orderId?: string; errors?: Record<string, string> };
      if (d.ok && d.payUrl) {
        try {
          if (d.orderId) localStorage.setItem(ORDER_KEY, d.orderId);
        } catch {
          /* تجاهل */
        }
        trackCheckout(p?.upgrade ?? 0, d.orderId, 'izba');
        window.location.href = d.payUrl;
        return;
      }
      if (d.ok) return setDone('وصلنا طلب الترقية ✓ بنرسل لك رابط الدفع على الواتساب، وبعد الدفع تنفتح لك العزبة على نفس حسابك.');
      setErr((d.errors && Object.values(d.errors)[0]) || d.error || 'ما انفتحت صفحة الدفع — حاول مرة ثانية');
    } catch {
      setErr('ما قدرنا نتصل — حاول مرة ثانية');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={hide} title="🏡 رقّي للعزبة">
      {done ? (
        <div className="p-5 text-sm text-turf-700" data-testid="upgrade-done">{done}</div>
      ) : (
        <form onSubmit={pay} className="space-y-3 p-5" data-testid="upgrade-form">
          <div className="rounded-lg bg-white p-3 text-center">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-3xl font-bold text-dune tabular-nums">{p?.upgrade ?? '…'}</span>
              <span className="text-lg font-bold text-dune">ر.ق</span>
              {p && p.basePrice > p.upgrade && <span className="text-sand-500 line-through tabular-nums">{p.basePrice}</span>}
            </div>
            <div className="text-xs text-sand-600">سعر خاص لعملاء العنة • تنضاف العزبة لنفس حسابك وكودك</div>
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" aria-label="الاسم" className="h-10 w-full rounded-lg border border-sand-300 bg-white px-3" data-testid="upgrade-name" />
          <div className="relative">
            <span className="pointer-events-none absolute top-1 left-1 z-10 flex h-8 items-center gap-1 rounded-md bg-sand-100 px-2 text-[13px] font-semibold text-dune" dir="ltr">
              {country.flag} +{country.cc} <span className="text-[10px] text-sand-600">▾</span>
            </span>
            <select value={cc} onChange={(e) => setCc(e.target.value)} aria-label="الدولة" dir="ltr" className="absolute top-1 left-1 z-20 h-8 w-[5.6rem] cursor-pointer opacity-0">
              {GCC.map((g) => (
                <option key={g.cc} value={g.cc}>
                  {g.flag} +{g.cc} {g.name}
                </option>
              ))}
            </select>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={`رقم الجوال (${country.len} أرقام)`} aria-label="رقم الجوال" inputMode="tel" dir="ltr" className="h-10 w-full rounded-lg border border-sand-300 bg-white px-3 pl-24 text-right" data-testid="upgrade-phone" />
          </div>
          {err && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-800" data-testid="upgrade-err">{err}</div>}
          <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gold-500 font-bold text-dune disabled:opacity-50" data-testid="upgrade-pay">
            {busy && <Loader2 size={18} className="animate-spin" />} {p?.online ? 'ادفع الآن (سكيب كاش)' : 'اطلب الترقية'}
          </button>
        </form>
      )}
    </Modal>
  );
}
