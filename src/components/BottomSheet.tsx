import { useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** شريط سفلي قابل للسحب (للجوال): اسحب المقبض لتحت للإغلاق، أو لفوق للتكبير */
export function BottomSheet({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId?: string }) {
  const [dy, setDy] = useState(0);
  const [tall, setTall] = useState(false);
  const start = useRef<number | null>(null);
  const dyRef = useRef(0);
  const begin = (y: number) => {
    start.current = y;
    dyRef.current = 0;
  };
  const move = (y: number) => {
    if (start.current == null) return;
    dyRef.current = y - start.current;
    setDy(dyRef.current);
  };
  const end = () => {
    if (start.current == null) return;
    start.current = null;
    const d = dyRef.current;
    dyRef.current = 0;
    setDy(0);
    if (d > 90) {
      if (tall) setTall(false);
      else onClose();
    } else if (d < -60) setTall(true);
  };
  // اللمس (آيفون/أندرويد) عن طريق أحداث touch لأن المتصفح ممكن يلغي pointer أثناء السحب
  const touch = {
    onTouchStart: (e: React.TouchEvent) => begin(e.touches[0].clientY),
    onTouchMove: (e: React.TouchEvent) => move(e.touches[0].clientY),
    onTouchEnd: end,
    onTouchCancel: end,
  };
  const mouse = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      begin(e.clientY);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => e.pointerType === 'mouse' && move(e.clientY),
    onPointerUp: (e: React.PointerEvent) => e.pointerType === 'mouse' && end(),
  };
  return (
    <>
      <div className="no-print absolute inset-0 z-[35] bg-dune/20" onClick={onClose} />
      <aside
        className="no-print absolute inset-x-0 bottom-0 z-[36] flex flex-col rounded-t-2xl border-t border-sand-200 bg-sand-50 shadow-2xl"
        style={{
          height: tall ? '88%' : '58%',
          transform: `translateY(${Math.max(dy, tall ? 0 : -40)}px)`,
          transition: start.current == null ? 'transform 0.2s, height 0.25s' : 'none',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        data-testid={testId}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none items-center justify-between px-3 pt-1.5 pb-1"
          {...touch}
          {...mouse}
          data-testid={testId ? `${testId}-handle` : undefined}
        >
          <span className="w-8" />
          <div className="flex flex-col items-center">
            <span className="mb-1 h-1.5 w-12 rounded-full bg-sand-300" />
            <span className="text-sm font-bold text-dune">{title}</span>
          </div>
          <button type="button" className="rounded p-1.5 text-sand-700" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </aside>
    </>
  );
}
