import { useState } from 'react';
import { WIND_FROM } from '../lib/wind';
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
  RotateCw,
  Copy,
  Lock,
  Unlock,
  SlidersHorizontal,
  MoreHorizontal,
  Plus,
  Minus,
} from 'lucide-react';
import { useEditor, usePlan } from '../store/editorStore';
import { useViewport } from './viewport';
import { IconButton, cx } from '../components/ui';
import { LUX_STOPS } from '../lib/lighting';
import { landBounds } from '../lib/geometry';
import { CATALOG_BY_KIND } from '../lib/catalog';
import type { Tool } from '../types/plan';

const TOOLS: { id: Tool; label: string; icon: typeof MousePointer2; key: string }[] = [
  { id: 'select', label: 'تحديد وتحريك (V)', icon: MousePointer2, key: 'V' },
  { id: 'pan', label: 'تحريك العرض (H أو مسطرة المسافة)', icon: Hand, key: 'H' },
  { id: 'path', label: 'رسم ممر (P)', icon: Route, key: 'P' },
  { id: 'string-lights', label: 'رسم سلسلة ليتات (T)', icon: Sparkles, key: 'T' },
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
  const [more, setMore] = useState(false);

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
          <IconButton label="خيارات العرض (الشبكة، الأبعاد، الإضاءة)" active={more} onClick={() => setMore(!more)} className="sm:hidden" data-testid="toolbar-more">
            <MoreHorizontal size={17} />
          </IconButton>
          <div className={more ? 'flex basis-full flex-wrap items-center gap-1 border-t border-sand-200 pt-1 sm:contents' : 'hidden items-center gap-1 sm:contents'}>
          <span className="mx-1 hidden h-6 w-px bg-sand-300 sm:block" />
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

      {!drawing && !selectedMeasure && <SelectionBar />}

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
      <div className="pointer-events-auto absolute bottom-3 left-3 hidden flex-col gap-1 rounded-xl sm:flex border border-sand-300/80 bg-white/95 p-1 shadow-md">
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
      <div className="absolute bottom-3 left-16 hidden flex-col items-start gap-1 sm:flex">
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

      {/* ريح الشمال السائدة: السهم يبيّن وين تروح الريح */}
      <div
        className="absolute top-16 left-[4.5rem] flex h-14 w-14 flex-col items-center justify-center rounded-full border border-sky-200 bg-white/90 shadow"
        title="الريح السائدة شتاءً (الشمال): تهب من الشمال/الشمال الغربي"
        data-testid="wind-arrow"
      >
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden style={{ transform: `rotate(${plan.land.northAngle + WIND_FROM + 180}deg)` }}>
          <path d="M15 3 L21 11 L17 11 L17 27 L13 27 L13 11 L9 11 Z" fill="#2f7fb5" />
                  </svg>
        <span className="-mt-0.5 text-[9px] font-bold leading-none text-sky-800">الريح</span>
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

function SelectionBar() {
  const selection = useEditor((s) => s.selection);
  const plan = usePlan();
  const [copyMenu, setCopyMenu] = useState<string | null>(null);
  if (!selection.length) return null;
  const els = plan.elements.filter((e) => selection.includes(e.id));
  if (!els.length) return null;
  const st = useEditor.getState();
  const locked = els.every((e) => e.locked);
  const btn = 'flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-dune hover:bg-sand-100 active:scale-95 disabled:opacity-35 sm:px-3';
  // تكبير/تصغير سريع لعنصر واحد (مو الممرات)
  const one = els.length === 1 ? els[0] : null;
  const cat = one ? CATALOG_BY_KIND[one.kind] : null;
  const canSize = !!one && !!cat && cat.geometry !== 'polyline' && !one.locked;
  const step = one && Math.min(one.width, one.depth) >= 2 ? 0.5 : 0.1;
  const resize = (dir: 1 | -1) => {
    if (!one || !cat) return;
    const r = (v: number) => Math.round(v * 100) / 100;
    const w = r(Math.min(200, Math.max(cat.minSize, one.width + dir * step)));
    const d = r(Math.min(200, Math.max(cat.minSize, one.depth + dir * step)));
    if (w === one.width && d === one.depth) return;
    st.updateElement(one.id, { width: w, depth: d }, { mergeKey: `${one.id}:quick-size` });
  };
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString();
  return (
    <div className="pointer-events-auto absolute bottom-[4.5rem] right-1/2 flex max-w-[98vw] translate-x-1/2 items-center gap-0.5 rounded-2xl border border-sand-300 bg-white/97 p-1 shadow-xl" data-testid="selection-bar">
      <span className={cx('max-w-28 truncate px-2 text-[12px] font-bold text-sand-700', canSize && 'hidden sm:block')}>{els.length > 1 ? `${els.length} عناصر` : els[0].name}</span>
      {canSize && one && cat && (
        <div className="flex items-center rounded-xl bg-sand-100 px-0.5" data-testid="sel-size">
          <button type="button" className="rounded-lg p-1.5 text-dune active:scale-90 disabled:opacity-30" onClick={() => resize(1)} disabled={one.width >= 200 && one.depth >= 200} aria-label="تكبير" data-testid="sel-grow">
            <Plus size={16} />
          </button>
          <span className="min-w-[3.4rem] text-center text-[11px] font-bold tabular-nums text-sand-800" dir="ltr" data-testid="sel-size-label">
            {fmt(one.width)}×{fmt(one.depth)}
          </span>
          <button type="button" className="rounded-lg p-1.5 text-dune active:scale-90 disabled:opacity-30" onClick={() => resize(-1)} disabled={one.width <= cat.minSize && one.depth <= cat.minSize} aria-label="تصغير" data-testid="sel-shrink">
            <Minus size={16} />
          </button>
        </div>
      )}
      <button type="button" className={btn + ' lg:hidden'} onClick={() => window.dispatchEvent(new CustomEvent('enna-open-props'))} data-testid="sel-edit">
        <SlidersHorizontal size={17} /> تعديل
      </button>
      <button type="button" className={btn} onClick={() => st.rotateElements(selection, 90)} disabled={locked}>
        <RotateCw size={17} /> تدوير
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => (one && cat?.geometry !== 'polyline' ? setCopyMenu(copyMenu === one.id ? null : one.id) : st.duplicateElements(selection))}
        data-testid="sel-copy"
      >
        <Copy size={17} /> نسخ
      </button>
      {one && copyMenu === one.id && <RepeatMenu key={one.id} id={one.id} onDone={() => setCopyMenu(null)} />}
      <button type="button" className={btn} onClick={() => st.setLocked(selection, !locked)}>
        {locked ? <Unlock size={17} /> : <Lock size={17} />} {locked ? 'فك' : 'قفل'}
      </button>
      <button type="button" className={btn + ' text-red-700'} onClick={() => st.removeElements(selection)} disabled={locked}>
        <Trash2 size={17} /> حذف
      </button>
    </div>
  );
}

/** قائمة النسخ: نسخة وحدة أو صف (مثلاً 6 ليتات أو 4 خيام بمسافة ثابتة) */
function RepeatMenu({ id, onDone }: { id: string; onDone: () => void }) {
  const [count, setCount] = useState(4);
  const [gap, setGap] = useState(1);
  const [axis, setAxis] = useState<'x' | 'y'>('x');
  const st = useEditor.getState();
  const stepper = (label: string, value: string, dec: () => void, inc: () => void, testId: string) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] text-sand-700">{label}</span>
      <div className="flex items-center rounded-lg bg-sand-100">
        <button type="button" className="px-2.5 py-1.5 text-dune" onClick={dec} aria-label={`تقليل ${label}`}><Minus size={14} /></button>
        <span className="min-w-[3.2rem] text-center text-[13px] font-bold tabular-nums" data-testid={testId}>{value}</span>
        <button type="button" className="px-2.5 py-1.5 text-dune" onClick={inc} aria-label={`زيادة ${label}`}><Plus size={14} /></button>
      </div>
    </div>
  );
  return (
    <div className="absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 space-y-2 rounded-2xl border border-sand-300 bg-white p-3 shadow-xl" data-testid="repeat-menu">
      <button
        type="button"
        className="w-full rounded-lg bg-sand-100 py-2 text-[13px] font-semibold text-dune active:scale-95"
        onClick={() => {
          st.duplicateElements([id]);
          onDone();
        }}
      >
        نسخة وحدة
      </button>
      <div className="border-t border-sand-200 pt-2 text-[12px] font-bold text-dune">أو صف كامل:</div>
      {stepper('العدد', `${count}`, () => setCount(Math.max(2, count - 1)), () => setCount(Math.min(30, count + 1)), 'repeat-count')}
      {stepper('المسافة بينها', `${gap} م`, () => setGap(Math.max(0, Math.round((gap - 0.5) * 10) / 10)), () => setGap(Math.min(20, Math.round((gap + 0.5) * 10) / 10)), 'repeat-gap')}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-sand-100 p-0.5 text-[12px]">
        {(['x', 'y'] as const).map((a) => (
          <button key={a} type="button" className={cx('rounded-md py-1.5', axis === a ? 'bg-white font-bold text-dune shadow' : 'text-sand-700')} onClick={() => setAxis(a)}>
            {a === 'x' ? 'جنب بعض' : 'ورا بعض'}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="w-full rounded-lg bg-dune py-2 text-[13px] font-bold text-sand-50 active:scale-95"
        onClick={() => {
          st.repeatElement(id, count, gap, axis);
          st.toast(`تم — صار عندك ${count} في صف`, 'success');
          onDone();
        }}
        data-testid="repeat-go"
      >
        سوّ الصف ({count})
      </button>
    </div>
  );
}
