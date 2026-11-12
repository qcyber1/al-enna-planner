// «📸 صورة حقيقية»: لقطة المجسم ← الذكاء الاصطناعي ← صورة كأنها مصوّرة بالدرون (بنفس التوزيع)
// الرصيد: صور مجانية مع الشراء + باقات — والمفتاح والحساب كله على السيرفر
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { Download, Loader2, Share2 } from 'lucide-react';
import { Modal, cx } from './ui';
import { activeDesign, useEditor } from '../store/editorStore';
import { CATALOG_BY_KIND } from '../lib/catalog';
import { checkName, fullBuyerPhone, GCC, guessGcc, parseBuyerPhone } from '../lib/buyer';
import { shareOrDownload, safeFileName, stamp } from '../lib/files';
import { trackCheckout } from '../lib/pixel';
import type { Plan } from '../types/plan';

const TOKEN_KEY = 'enna.license.token';
const ORDER_KEY = 'enna.order';
type Mood = 'day' | 'sunset' | 'night';
interface Status {
  on: boolean;
  left: number;
  free: number;
  packSize: number;
  packPrice: number;
  online: boolean;
  signedIn: boolean;
}

const token = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

let cached: Status | null = null;
export async function loadAiStatus(force = false): Promise<Status | null> {
  if (cached && !force) return cached;
  try {
    const r = await fetch('/api/ai-photo/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: token() }) });
    cached = (await r.json()) as Status;
    return cached;
  } catch {
    return null;
  }
}

/** وصف العناصر للذكاء الاصطناعي عشان يحافظ عليها (مثل «2 × خيمة صغيرة») */
export function planHints(plan: Plan): string[] {
  const counts = new Map<string, number>();
  for (const e of plan.elements) {
    if (e.kind === 'path' || e.kind === 'string-lights' || e.kind === 'ground-light') continue;
    const label = CATALOG_BY_KIND[e.kind]?.label;
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([l, n]) => (n > 1 ? `${n} × ${l}` : l));
}

interface AiState {
  open: boolean;
  /** اللقطة اللي التقطها المجسم (يعبّيها CaptureHandler) */
  source: string | null;
  show: () => void;
  hide: () => void;
  gotSource: (url: string) => void;
}
export const useAiPhoto = create<AiState>((set) => ({
  open: false,
  source: null,
  show: () => set({ open: true, source: null }),
  hide: () => set({ open: false, source: null }),
  gotSource: (source) => set({ source }),
}));

const MOODS: [Mood, string][] = [
  ['day', '☀️ نهار'],
  ['sunset', '🌅 غروب'],
  ['night', '🌙 ليل'],
];

export function AiPhotoDialog() {
  const { open, hide, source } = useAiPhoto();
  const [st, setSt] = useState<Status | null>(cached);
  const [mood, setMood] = useState<Mood>('sunset');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [buying, setBuying] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setErr('');
    setBuying(false);
    void loadAiStatus(true).then(setSt);
  }, [open]);

  // لما توصل اللقطة من المجسم نرسلها للسيرفر
  useEffect(() => {
    if (!open || !source || !waiting) return;
    setWaiting(false);
    const st0 = useEditor.getState();
    const plan = activeDesign(st0.project).plan;
    (async () => {
      try {
        const r = await fetch('/api/ai-photo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: token(), image: source, mood, hints: planHints(plan), izba: plan.land.site === 'izba' }),
        });
        const d = (await r.json()) as { ok?: boolean; image?: string; left?: number; error?: string };
        if (d.ok && d.image) {
          setResult(d.image);
          setSt((s) => (s ? { ...s, left: d.left ?? s.left } : s));
        } else {
          setErr(d.error || 'ما طلعت الصورة — جرّب مرة ثانية');
          if (r.status === 402) setSt((s) => (s ? { ...s, left: 0 } : s));
        }
      } catch {
        setErr('انقطع الاتصال — جرّب مرة ثانية (ما انخصمت من رصيدك)');
      } finally {
        setBusy(false);
      }
    })();
  }, [source, waiting, open, mood]);

  const start = () => {
    setErr('');
    setResult(null);
    setBusy(true);
    setWaiting(true);
    useAiPhoto.setState({ source: null });
    useEditor.getState().requestCapture3d('ai');
  };

  const save = async () => {
    if (!result) return;
    const blob = await (await fetch(result)).blob();
    const st0 = useEditor.getState();
    const d = activeDesign(st0.project);
    await shareOrDownload(blob, `i3enna-photo-${safeFileName(d.name)}-${stamp()}.png`, d.name);
  };

  if (!open) return null;
  const left = st?.left ?? 0;
  return (
    <Modal open onClose={hide} wide title="📸 صورة حقيقية بالذكاء الاصطناعي">
      <div className="space-y-3 p-4 sm:p-5" data-testid="ai-photo">
        {!st ? (
          <div className="flex items-center gap-2 text-sm text-sand-700">
            <Loader2 size={16} className="animate-spin" /> لحظة…
          </div>
        ) : !st.on ? (
          <p className="rounded-lg bg-sand-100 p-3 text-sm text-sand-700">الخدمة غير متاحة حالياً.</p>
        ) : !st.signedIn ? (
          <p className="rounded-lg bg-sand-100 p-3 text-sm text-sand-700">الصور الحقيقية متاحة بعد الشراء — ومعها {st.free} صور مجانية 🎁</p>
        ) : buying ? (
          <BuyPack st={st} onBack={() => setBuying(false)} />
        ) : (
          <>
            <p className="text-[13px] text-sand-700">نصوّر المجسم من نفس الزاوية اللي قدامك، والذكاء الاصطناعي يحوّله لصورة كأنها مصوّرة بالدرون — بنفس التوزيع. الصورة تاخذ تقريباً نص دقيقة.</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-sand-100 p-1">
                {MOODS.map(([k, l]) => (
                  <button key={k} type="button" disabled={busy} onClick={() => setMood(k)} data-testid={`ai-mood-${k}`} className={cx('h-9 rounded-lg px-3 text-sm font-bold', mood === k ? 'bg-white text-dune shadow-sm' : 'text-sand-700')}>
                    {l}
                  </button>
                ))}
              </div>
              <span className="text-sm text-sand-700" data-testid="ai-left">
                رصيدك: <b className="text-dune">{left}</b> صورة
              </span>
            </div>
            {result ? (
              <div className="space-y-2">
                <img src={result} alt="صورة حقيقية للتصميم" className="w-full rounded-xl border border-sand-200" data-testid="ai-result" />
                <p className="text-[11px] text-sand-500">تصوّر تقريبي بالذكاء الاصطناعي — ممكن تختلف تفاصيل صغيرة عن التصميم.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void save()} className="flex h-10 items-center gap-1.5 rounded-lg bg-gold-500 px-4 font-bold text-dune" data-testid="ai-save">
                    <Download size={16} /> حفظ / مشاركة
                  </button>
                  <button type="button" onClick={start} disabled={busy || left <= 0} className="flex h-10 items-center gap-1.5 rounded-lg border border-sand-300 px-4 font-semibold text-dune disabled:opacity-50">
                    <Share2 size={16} /> صورة ثانية
                  </button>
                </div>
              </div>
            ) : busy ? (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-sand-50 p-8 text-center text-sm text-sand-700" data-testid="ai-busy">
                <Loader2 size={28} className="animate-spin text-gold-600" />
                جاري تجهيز الصورة… لا تسكّر الصفحة (تقريباً 30–60 ثانية)
              </div>
            ) : left > 0 ? (
              <button type="button" onClick={start} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-gold-500 to-gold-600 text-base font-bold text-white shadow" data-testid="ai-start">
                📸 صوّرها الحين
              </button>
            ) : null}
            {err && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-800" data-testid="ai-err">{err}</div>}
            {left <= 0 && !busy && (
              <div className="space-y-2 rounded-xl border-2 border-gold-500 bg-gold-50 p-3 text-center">
                <div className="font-bold text-dune">خلص رصيد الصور</div>
                <button type="button" onClick={() => setBuying(true)} className="h-11 w-full rounded-lg bg-gold-500 font-bold text-dune" data-testid="ai-buy">
                  باقة {st.packSize} صور بـ {st.packPrice} ر.ق
                </button>
              </div>
            )}
            {left > 0 && !busy && (
              <button type="button" onClick={() => setBuying(true)} className="w-full text-[12px] font-semibold text-gold-700 underline">
                تبي صور أكثر؟ باقة {st.packSize} صور بـ {st.packPrice} ر.ق
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/** شراء باقة الصور (نفس سكيب كاش، وتنضاف لنفس الكود) */
function BuyPack({ st, onBack }: { st: Status; onBack: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cc, setCc] = useState(guessGcc);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
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
      const r = await fetch(st.online ? '/api/checkout' : '/api/order', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, phone: full, product: 'photos', upgradeToken: token() }) });
      const d = (await r.json()) as { ok?: boolean; error?: string; payUrl?: string; orderId?: string; errors?: Record<string, string> };
      if (d.ok && d.payUrl) {
        try {
          if (d.orderId) localStorage.setItem(ORDER_KEY, d.orderId);
        } catch {
          /* تجاهل */
        }
        trackCheckout(st.packPrice, d.orderId);
        window.location.href = d.payUrl;
        return;
      }
      if (d.ok) return setDone('وصلنا طلبك ✓ بنرسل لك رابط الدفع على الواتساب، وبعد الدفع تنضاف الصور لرصيدك.');
      setErr((d.errors && Object.values(d.errors)[0]) || d.error || 'ما انفتحت صفحة الدفع — حاول مرة ثانية');
    } catch {
      setErr('ما قدرنا نتصل — حاول مرة ثانية');
    } finally {
      setBusy(false);
    }
  };
  if (done) return <div className="p-2 text-sm text-turf-700">{done}</div>;
  return (
    <form onSubmit={pay} className="space-y-3" data-testid="ai-pack-form">
      <div className="rounded-lg bg-white p-3 text-center">
        <span className="text-3xl font-bold text-dune tabular-nums">{st.packPrice}</span> <span className="font-bold text-dune">ر.ق</span>
        <div className="text-xs text-sand-600">{st.packSize} صور حقيقية • تنضاف لرصيدك على نفس الحساب</div>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" aria-label="الاسم" className="h-10 w-full rounded-lg border border-sand-300 bg-white px-3" />
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
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={`رقم الجوال (${country.len} أرقام)`} aria-label="رقم الجوال" inputMode="tel" dir="ltr" className="h-10 w-full rounded-lg border border-sand-300 bg-white px-3 pl-24 text-right" />
      </div>
      {err && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{err}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="h-11 rounded-lg border border-sand-300 px-4 font-semibold text-dune">
          رجوع
        </button>
        <button type="submit" disabled={busy} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-gold-500 font-bold text-dune disabled:opacity-50">
          {busy && <Loader2 size={18} className="animate-spin" />} {st.online ? 'ادفع الآن (سكيب كاش)' : 'اطلب الباقة'}
        </button>
      </div>
    </form>
  );
}
