import {
  Check,
  Grid3x3,
  Hand,
  Lightbulb,
  Magnet,
  Maximize,
  MousePointer2,
  Ruler,
  Route,
  ScanLine,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  Tag,
} from 'lucide-react';
import { useEditor, usePlan } from '../store/editorStore';
import { useViewport } from './viewport';
import { IconButton, cx } from '../components/ui';
import { LUX_STOPS } from '../lib/lighting';
import { landBounds } from '../lib/geometry';
import type { Tool } from '../types/plan';

const TOOLS: { id: Tool; label: string; icon: typeof MousePointer2; key: string }[] = [
  { id: 'select', label: 'تحديد وتحريك (V)', icon: MousePointer2, key: 'V' },
  { id: 'pan', label: 'تحريك العرض (H أو مسطرة المسافة)', icon: Hand, key: 'H' },
  { id: 'path', label: 'رسم ممر (P)', icon: Route, key: 'P' },
  { id: 'string-lights', label: 'رسم سلسلة لمبات (T)', icon: Sparkles, key: 'T' },
  { id: 'measure', label: 'قياس مسافة (M)', icon: Ruler, key: 'M' },
];

const HINTS: Partial<Record<Tool, string>> = {
  path: 'انقر لإضافة نقاط الممر • انقر مرتين أو Enter للإنهاء • Shift لزوايا 45° • Backspace للتراجع عن نقطة',
  'string-lights': 'انقر على الأعمدة لتعليق السلسلة بينها • انقر مرتين أو Enter للإنهاء',
  measure: 'اسحب من نقطة إلى أخرى لقياس المسافة (تلتصق بمراكز العناصر وزواياها)',
  pan: 'اسحب لتحريك العرض • استخدم العجلة للتكبير',
};

function niceScale(maxMeters: number): number {
  const opts = [0.5, 1, 2, 5, 10, 20, 25, 50, 100];
  let best = opts[0];
  for (const o of opts) if (o <= maxMeters) best = o;
  return best;
}

export function EditorOverlay({
  drawing,
  draftCount,
  onFinish,
  onCancel,
  selectedMeasure,
  onDeleteMeasure,
}: {
  drawing: boolean;
  draftCount: number;
  onFinish: () => void;
  onCancel: () => void;
  selectedMeasure: string | null;
  onDeleteMeasure: () => void;
}) {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const grid = useEditor((s) => s.grid);
  const setGrid = useEditor((s) => s.setGrid);
  const overlays = useEditor((s) => s.overlays);
  const setOverlays = useEditor((s) => s.setOverlays);
  const plan = usePlan();
  const scale = useViewport((s) => s.scale);
  const cursor = useViewport((s) => s.cursor);
  const requestFit = useViewport((s) => s.requestFit);
  const requestZoom = useViewport((s) => s.requestZoom);
  const lb = landBounds(plan.land);

  const barM = niceScale(110 / scale);
  const barPx = barM * scale;

  return (
    <div data-overlay dir="rtl" className="pointer-events-none absolute inset-0">
      {/* شريط الأدوات */}
      <div className="pointer-events-auto absolute top-2 right-2 left-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-sand-300/80 bg-white/95 p-1 shadow-md backdrop-blur">
          {TOOLS.map((t) => (
            <IconButton key={t.id} label={t.label} active={tool === t.id} onClick={() => setTool(t.id)} data-testid={`tool-${t.id}`}>
              <t.icon size={17} />
            </IconButton>
          ))}
          <span className="mx-1 h-6 w-px bg-sand-300" />
          <IconButton label="إظهار الشبكة (G)" active={grid.show} onClick={() => setGrid({ show: !grid.show })}>
            <Grid3x3 size={17} />
          </IconButton>
          <IconButton label="الالتصاق بالشبكة (Alt لتعطيله مؤقتاً)" active={grid.snap} onClick={() => setGrid({ snap: !grid.snap })}>
            <Magnet size={17} />
          </IconButton>
          <select
            aria-label="خطوة الشبكة"
            title="خطوة الشبكة"
            value={grid.size}
            onChange={(e) => setGrid({ size: parseFloat(e.target.value) })}
            className="h-8 rounded-lg border border-sand-300 bg-white px-1 text-xs text-sand-800"
          >
            {[0.1, 0.25, 0.5, 1, 2].map((s) => (
              <option key={s} value={s}>
                {s} م
              </option>
            ))}
          </select>
          <span className="mx-1 h-6 w-px bg-sand-300" />
          <IconButton label="أسماء العناصر" active={overlays.labels} onClick={() => setOverlays({ labels: !overlays.labels })}>
            <Tag size={17} />
          </IconButton>
          <IconButton label="عرض الأبعاد على المخطط" active={overlays.dims} onClick={() => setOverlays({ dims: !overlays.dims })}>
            <ScanLine size={17} />
          </IconButton>
          <IconButton label="المسافات حول العنصر المحدد" active={overlays.distances} onClick={() => setOverlays({ distances: !overlays.distances })}>
            <Ruler size={15} className="rotate-90" />
          </IconButton>
          <IconButton label="منطقة أمان الملعب ومداخل الخيام" active={overlays.safety} onClick={() => setOverlays({ safety: !overlays.safety })}>
            <ShieldAlert size={17} />
          </IconButton>
          <IconButton
            label="خريطة الإضاءة التقديرية (لكشف الأماكن المظلمة)"
            active={overlays.lightMap}
            onClick={() => setOverlays({ lightMap: !overlays.lightMap })}
            data-testid="toggle-lightmap"
          >
            <Lightbulb size={17} />
          </IconButton>
        </div>
      </div>

      {/* تلميحات الأداة */}
      {HINTS[tool] && (
        <div className="absolute top-16 right-1/2 max-w-[92%] translate-x-1/2 rounded-lg bg-dune/90 px-3 py-1.5 text-center text-xs text-sand-50 shadow">
          {HINTS[tool]}
        </div>
      )}

      {/* أزرار إنهاء الرسم (مهمة للجوال) */}
      {drawing && (
        <div className="pointer-events-auto absolute bottom-16 right-1/2 flex translate-x-1/2 gap-2">
          <button
            type="button"
            onClick={onFinish}
            disabled={draftCount < 2}
            className="flex items-center gap-1 rounded-full bg-turf-600 px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
          >
            <Check size={16} /> إنهاء ({draftCount} نقاط)
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-sand-900 shadow-lg"
          >
            <X size={16} /> إلغاء
          </button>
        </div>
      )}

      {selectedMeasure && (
        <div className="pointer-events-auto absolute bottom-16 right-1/2 translate-x-1/2">
          <button
            type="button"
            onClick={onDeleteMeasure}
            className="flex items-center gap-1 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          >
            <Trash2 size={15} /> حذف القياس
          </button>
        </div>
      )}

      {/* التكبير */}
      <div className="pointer-events-auto absolute bottom-3 left-3 flex flex-col gap-1 rounded-xl border border-sand-300/80 bg-white/95 p-1 shadow-md">
        <IconButton label="تكبير" onClick={() => requestZoom(1.25)}>
          <ZoomIn size={17} />
        </IconButton>
        <IconButton label="تصغير" onClick={() => requestZoom(0.8)}>
          <ZoomOut size={17} />
        </IconButton>
        <IconButton label="ملاءمة الأرض في الشاشة (F)" onClick={requestFit}>
          <Maximize size={17} />
        </IconButton>
      </div>

      {/* مقياس الرسم والإحداثيات */}
      <div className="absolute bottom-3 left-16 flex flex-col items-start gap-1">
        <div className="rounded-md bg-white/90 px-2 py-1 shadow-sm" dir="ltr">
          <div className="flex h-2 border border-dune" style={{ width: barPx }}>
            <div className="h-full w-1/2 bg-dune" />
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] font-semibold text-dune" style={{ width: barPx }}>
            <span>0</span>
            <span>{barM} م</span>
          </div>
        </div>
        {cursor && (
          <div className="rounded-md bg-white/90 px-2 py-0.5 text-[11px] text-sand-800 tabular-nums shadow-sm" dir="ltr">
            x {(cursor.x - lb.minX).toFixed(2)} م · y {(cursor.y - lb.minY).toFixed(2)} م
          </div>
        )}
      </div>

      {/* سهم الشمال */}
      <div className="absolute top-16 left-3 flex h-14 w-14 items-center justify-center rounded-full border border-sand-300 bg-white/90 shadow" title="اتجاه الشمال">
        <div style={{ transform: `rotate(${plan.land.northAngle}deg)` }} className="flex flex-col items-center">
          <span className="text-[11px] font-bold leading-none text-red-700">ش</span>
          <svg width="16" height="28" viewBox="0 0 16 28" aria-hidden>
            <path d="M8 0 L14 14 L8 11 L2 14 Z" fill="#b23a2a" />
            <path d="M8 28 L14 14 L8 17 L2 14 Z" fill="#3b2a1e" />
          </svg>
        </div>
      </div>

      {/* مفتاح خريطة الإضاءة */}
      {overlays.lightMap && (
        <div className="absolute top-32 left-3 rounded-lg bg-white/95 p-2 text-[11px] shadow">
          <div className="mb-1 font-bold text-dune">الإضاءة التقديرية</div>
          {LUX_STOPS.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="h-3 w-4 rounded-sm" style={{ background: `rgb(${s.color.join(',')})` }} />
              <span className={cx('text-sand-800')}>{s.label}</span>
            </div>
          ))}
          <div className="mt-1 max-w-[150px] text-[10px] text-sand-600">تقدير بصري تقريبي وليس حساباً هندسياً</div>
        </div>
      )}
    </div>
  );
}
