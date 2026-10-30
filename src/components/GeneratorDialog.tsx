import { useMemo, useState } from 'react';
import { Minus, Plus, Sparkles, Check, Layers } from 'lucide-react';
import { useEditor, usePlan } from '../store/editorStore';
import { Button, Modal, Toggle, cx } from './ui';
import { DEFAULT_GEN, generateDesigns, type GenInput, type GenResult } from '../lib/generator';
import { planThumbnail } from '../render2d/exportImage';
import { landBounds } from '../lib/geometry';
import { useViewport } from '../editor2d/viewport';

function Counter({ label, icon, value, onChange, max = 12 }: { label: string; icon: string; value: number; onChange: (n: number) => void; max?: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-sand-200 bg-white px-3 py-2">
      <span className="flex items-center gap-2 text-sm font-medium text-dune">
        <span className="text-lg">{icon}</span>
        {label}
      </span>
      <span className="flex items-center gap-2">
        <button type="button" aria-label={`إنقاص ${label}`} onClick={() => onChange(Math.max(0, value - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-sand-100 text-dune active:scale-95">
          <Minus size={16} />
        </button>
        <span className="w-6 text-center text-base font-bold tabular-nums">{value}</span>
        <button type="button" aria-label={`زيادة ${label}`} onClick={() => onChange(Math.min(max, value + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-dune text-sand-50 active:scale-95">
          <Plus size={16} />
        </button>
      </span>
    </div>
  );
}

export function GeneratorDialog() {
  const open = useEditor((s) => s.dialog === 'generator');
  const openDialog = useEditor((s) => s.openDialog);
  const plan = usePlan();
  const [input, setInput] = useState<GenInput>(DEFAULT_GEN);
  const [results, setResults] = useState<GenResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<GenInput>) => setInput((i) => ({ ...i, ...p }));
  const b = landBounds(plan.land);
  const thumbs = useMemo(() => (results ? results.map((r) => planThumbnail(r.plan, 520)) : []), [results]);

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      setResults(generateDesigns(plan.land, { ...input, tents: Math.max(1, input.tents) }));
      setBusy(false);
    }, 30);
  };
  const adopt = (list: GenResult[]) => {
    const st = useEditor.getState();
    for (const r of list) {
      st.addDesign(r.title, 'blank');
      st.setPlan(() => r.plan, { history: false });
    }
    openDialog(null);
    setResults(null);
    setTimeout(() => useViewport.getState().requestFit(), 60);
    st.toast(list.length > 1 ? `تمت إضافة ${list.length} تصاميم — بدّل بينها من قائمة التصاميم بالأعلى` : `تم فتح «${list[0].title}» — عدّل عليه براحتك`, 'success');
  };

  return (
    <Modal
      open={open}
      onClose={() => openDialog(null)}
      wide={results ? 'xl' : true}
      title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-gold-600" /> مولّد تصاميم العنة</span>}
      footer={
        results ? (
          <>
            <Button onClick={() => setResults(null)}>تعديل المتطلبات</Button>
            <Button variant="primary" onClick={() => adopt(results)} data-testid="gen-add-all">
              <Layers size={15} /> أضف الأفكار الخمس كتصاميم للمقارنة
            </Button>
          </>
        ) : (
          <Button variant="gold" onClick={run} disabled={busy} data-testid="gen-run">
            <Sparkles size={16} /> {busy ? 'جاري التوليد…' : 'ولّد 5 أفكار'}
          </Button>
        )
      }
    >
      {!results ? (
        <div className="space-y-4 p-5">
          <p className="text-sm text-sand-700">
            حدّد وش تبي في عنتك، والمولّد يوزّعها لك بخمس طرق مختلفة على أرضك ({Math.round(b.maxX - b.minX)} × {Math.round(b.maxY - b.minY)} م) مع الممرات والإنارة، بدون تداخل.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Counter icon="⛺" label="الخيام (أولها المجلس)" value={input.tents} onChange={(n) => set({ tents: Math.max(1, n) })} />
            <Counter icon="🛏️" label="كبائن رقدة" value={input.sleepCabins} onChange={(n) => set({ sleepCabins: n })} />
            <Counter icon="🍲" label="كبائن مطبخ" value={input.kitchenCabins} onChange={(n) => set({ kitchenCabins: n })} />
            <Counter icon="🚻" label="حمامات" value={input.toilets} onChange={(n) => set({ toilets: n })} />
            <Counter icon="🚰" label="مغاسل" value={input.sinks} onChange={(n) => set({ sinks: n })} />
            <Counter icon="🚙" label="مواقف سيارات" value={input.parking} onChange={(n) => set({ parking: n })} />
          </div>
          <div className="grid gap-x-6 rounded-xl border border-sand-200 bg-white px-4 py-2 sm:grid-cols-2">
            <Toggle label="🏐 ملعب كرة طائرة" checked={input.court} onChange={(v) => set({ court: v })} />
            <Toggle label="🔥 الضو (شبّة)" checked={input.firePit} onChange={(v) => set({ firePit: v })} />
            <Toggle label="🍢 منطقة شواء" checked={input.bbq} onChange={(v) => set({ bbq: v })} />
            <Toggle label="🕌 مصلّى" checked={input.prayer} onChange={(v) => set({ prayer: v })} />
            <Toggle label="📺 شاشة مباريات" checked={input.screen} onChange={(v) => set({ screen: v })} />
            <Toggle label="🛝 ألعاب أطفال" checked={input.kids} onChange={(v) => set({ kids: v })} />
          </div>
          <p className="text-[12px] text-sand-600">التصميم الحالي ما يتغيّر — الأفكار تنضاف كتصاميم جديدة تقدر تقارن بينها.</p>
        </div>
      ) : (
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3" data-testid="gen-results">
          {results.map((r, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-sand-200 bg-white">
              <img src={thumbs[i]} alt={r.title} className="aspect-square w-full bg-sand-100 object-contain" />
              <div className="space-y-2 p-3">
                <div className="font-bold text-dune">
                  {i + 1}. {r.title}
                </div>
                <p className="text-[12px] leading-relaxed text-sand-700">{r.description}</p>
                <div className={cx('text-[12px]', r.issues ? 'text-amber-700' : 'text-turf-700')}>
                  {r.issues ? `⚠ ${r.issues} تنبيه` : '✓ بدون تداخلات'}
                  {r.skipped.length > 0 && <span className="text-amber-700"> • ما اتسع: {r.skipped.join('، ')}</span>}
                </div>
                <Button size="sm" variant="primary" className="w-full" onClick={() => adopt([r])}>
                  <Check size={14} /> اعتمد هذي الفكرة
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
