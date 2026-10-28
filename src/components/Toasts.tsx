import { X } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { cx } from './ui';

export function Toasts() {
  const toasts = useEditor((s) => s.toasts);
  const dismiss = useEditor((s) => s.dismissToast);
  return (
    <div className="no-print pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm shadow-lg',
            t.kind === 'error' && 'bg-red-700 text-white',
            t.kind === 'warning' && 'bg-amber-500 text-dune',
            t.kind === 'success' && 'bg-turf-600 text-white',
            t.kind === 'info' && 'bg-dune text-sand-50',
          )}
        >
          <span className="flex-1">{t.text}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="إغلاق"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}
