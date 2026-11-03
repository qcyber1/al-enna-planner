import { useEffect, useLayoutEffect, useState } from 'react';
import { isFirstRun, useEditor } from '../store/editorStore';
import { Button } from './ui';

const DONE_KEY = 'enna.v1.tourDone';

interface Step {
  target: string;
  title: string;
  text: (narrow: boolean) => string;
  /** وسط العنصر بدل تحته/فوقه (للمساحات الكبيرة) */
  center?: boolean;
}

const STEPS: Step[] = [
  {
    target: 'library',
    title: '① مكتبة العناصر',
    text: (n) => (n ? 'من زر «العناصر» تضيف خيام، ملعب، كبائن، ليتات وكل شي تحتاجه العنة.' : 'من هنا تضيف خيام، ملعب، كبائن، ليتات — اسحب العنصر للمخطط أو اضغط عليه.'),
  },
  {
    target: 'canvas',
    title: '② حرّك ولفّ',
    text: (n) => (n ? 'المس أي عنصر لتحديده واسحبه بإصبعك، وتحت يطلع لك شريط فيه تدوير ونسخ وحذف.' : 'اسحب أي عنصر لتحريكه، ولفّه من المقبض الدائري. Ctrl+Z للتراجع.'),
    center: true,
  },
  {
    target: 'view',
    title: '③ شوفها مجسمة 3D',
    text: () => 'بدّل بين المخطط 2D والمجسم 3D، وتقدر تتجول داخل العنة كأنك واقف فيها.',
  },
  {
    target: 'time',
    title: '④ الليل والليتات',
    text: (n) => (n ? 'من القائمة ☰ حوّل للمغرب أو الليل وشوف توزيع الليتات قبل لا تشتريها.' : 'حوّل للمغرب أو الليل وشوف توزيع الليتات — وفي 3D شريط «الساعة» من العصر لليل.'),
  },
];

function done(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return true;
  }
}

function markDone() {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    /* تجاهل */
  }
}

const findTarget = (name: string): HTMLElement | null => {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return all.find((e) => e.getBoundingClientRect().width > 0) ?? null;
};

/** جولة تعريفية أول مرة: 4 فقاعات غير مزعجة (ما تمنع استخدام التطبيق) مع زر تخطي */
export function Tour() {
  const dialog = useEditor((s) => s.dialog);
  // ما نغطي شريط التحديد: الجولة تختفي مؤقتاً وقت ما المستخدم شغّال على عنصر
  const selecting = useEditor((s) => s.selection.length > 0);
  const [active, setActive] = useState(() => isFirstRun() && !done());
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vw, setVw] = useState(() => window.innerWidth);
  const narrow = vw < 1200;
  const visible = active && dialog === null && !selecting;
  const s = STEPS[step];

  useLayoutEffect(() => {
    if (!visible) return;
    const update = () => {
      setVw(window.innerWidth);
      setRect(findTarget(s.target)?.getBoundingClientRect() ?? null);
    };
    update();
    const t = setInterval(update, 500);
    window.addEventListener('resize', update);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', update);
    };
  }, [visible, s.target]);

  useEffect(() => {
    if (visible && !findTarget(s.target)) {
      // العنصر مو موجود (مثلاً شاشة مختلفة) — ننتقل للي بعده
      const t = setTimeout(() => (step < STEPS.length - 1 ? setStep(step + 1) : finish()), 800);
      return () => clearTimeout(t);
    }
  });

  if (!visible || !rect) return null;

  function finish() {
    markDone();
    setActive(false);
  }

  const W = Math.min(300, vw - 24);
  const vh = window.innerHeight;
  const CARD_H = 170;
  let top: number;
  if (s.center) top = rect.top + rect.height / 2 - CARD_H / 2;
  else if (rect.bottom + 12 + CARD_H < vh) top = rect.bottom + 12;
  else top = rect.top - 12 - CARD_H;
  top = Math.max(8, Math.min(vh - CARD_H - 8, top));
  const left = Math.max(12, Math.min(vw - W - 12, rect.left + rect.width / 2 - W / 2));
  const last = step === STEPS.length - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-[45]" dir="rtl" data-testid="tour">
      {!s.center && (
        <div
          className="absolute rounded-xl ring-4 ring-gold-400/80 transition-all duration-300"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8, boxShadow: '0 0 0 4px rgba(255,255,255,0.35)' }}
        />
      )}
      <div
        className="pointer-events-auto absolute rounded-2xl border border-gold-400 bg-white p-3.5 shadow-2xl transition-all duration-300"
        style={{ left, top, width: W }}
        role="dialog"
        aria-label="جولة تعريفية"
      >
        <div className="mb-1 flex items-center justify-between">
          <b className="text-[15px] text-dune">{s.title}</b>
          <span className="text-[11px] text-sand-600 tabular-nums">{step + 1}/{STEPS.length}</span>
        </div>
        <p className="text-[13px] leading-relaxed text-sand-800">{s.text(narrow)}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" className="text-[12px] text-sand-600 underline" onClick={finish} data-testid="tour-skip">
            تخطي الجولة
          </button>
          <Button size="sm" variant={last ? 'gold' : 'primary'} onClick={() => (last ? finish() : setStep(step + 1))} data-testid="tour-next">
            {last ? 'يلا نبدأ 👍' : 'التالي'}
          </Button>
        </div>
      </div>
    </div>
  );
}
