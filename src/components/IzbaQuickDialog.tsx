// «🐑 أضف حلالك» و«🏠 صمّم مجلسك»: تكتب العدد أو تختار المقاس، ويتحط لك جاهز في مكان فاضي
import { useMemo, useState } from 'react';
import { useEditor, usePlan } from '../store/editorStore';
import { Button, Modal, Toggle, cx } from './ui';
import { herdGroup, majlisGroup, MAJLIS_SIZES } from '../lib/izbaQuick';
import { addGroup } from './Library';

export function IzbaQuickDialog() {
  const dialog = useEditor((s) => s.dialog);
  if (dialog !== 'herd' && dialog !== 'majlis') return null;
  return dialog === 'herd' ? <Herd /> : <Majlis />;
}

function Count({ icon, label, value, onChange, step = 1, testid, hint }: { icon: string; label: string; value: number; onChange: (n: number) => void; step?: number; testid: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2">
      <span className="text-sm">
        <span className="text-xl">{icon}</span> <b className="text-dune">{label}</b>
        {hint && <span className="block text-[11px] text-sand-500">{hint}</span>}
      </span>
      <span className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(Math.max(0, value - step))} className="h-9 w-9 rounded-lg bg-sand-100 text-lg font-bold text-dune">−</button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(2000, Math.round(Number(e.target.value) || 0))))}
          className="h-9 w-16 rounded-lg border border-sand-300 text-center text-base tabular-nums"
          data-testid={testid}
        />
        <button type="button" onClick={() => onChange(value + step)} className="h-9 w-9 rounded-lg bg-sand-100 text-lg font-bold text-dune">+</button>
      </span>
    </div>
  );
}

function Herd() {
  const openDialog = useEditor((s) => s.openDialog);
  const [sheep, setSheep] = useState(50);
  const [camels, setCamels] = useState(0);
  const [horses, setHorses] = useState(0);
  const [feed, setFeed] = useState(true);
  const [worker, setWorker] = useState(true);
  const plan = usePlan();
  const hasFeedStore = plan.elements.some((e) => e.kind === 'feed-store');
  const hasWorker = plan.elements.some((e) => e.kind === 'worker-room' || (e.kind === 'room' && /عامل|العمال/.test(e.name)));
  const g = useMemo(() => herdGroup({ sheep, camels, horses, feed, worker, hasFeedStore, hasWorker }), [sheep, camels, horses, feed, worker, hasFeedStore, hasWorker]);
  const pens = g.els.filter((e) => ['sheep-pen', 'camel-pen', 'horse-stable'].includes(e.kind));
  const go = () => {
    addGroup(g, 'تمت إضافة الحلال ✓ — حطيناه جهة تحت الريح بعيد عن المجلس، وتقدر تسحبه أو تكبّره من الخصائص', true);
    openDialog(null);
  };
  return (
    <Modal
      open
      onClose={() => openDialog(null)}
      title="🐑 أضف حلالك"
      footer={
        <>
          <Button onClick={() => openDialog(null)}>إلغاء</Button>
          <Button variant="gold" disabled={!pens.length} onClick={go} data-testid="herd-add">حطها في العزبة</Button>
        </>
      }
    >
      <div className="space-y-2.5 p-4" data-testid="herd">
        <p className="text-[13px] text-sand-700">اكتب كم عندك، ونحط لك الحظاير بالمقاس الصح مع المعالف والشبك.</p>
        <Count icon="🐑" label="غنم" value={sheep} onChange={setSheep} step={10} testid="herd-sheep" hint="تقريباً 2 م² للراس مع الظل" />
        <Count icon="🐪" label="إبل" value={camels} onChange={setCamels} testid="herd-camels" hint="تقريباً 12 م² للراس" />
        <Count icon="🐎" label="خيل" value={horses} onChange={setHorses} testid="herd-horses" hint="بوكس 3.6 م لكل خيل" />
        <div className="rounded-xl bg-sand-50 px-3 py-1">
          <Toggle label="🪣 معلف لكل حظيرة + 🌾 مخزن علف" checked={feed} onChange={setFeed} />
          <Toggle label="🛖 غرفة عامل (لو الحلال أكثر من 20)" checked={worker} onChange={setWorker} />
        </div>
        {pens.length > 0 && (
          <ul className="space-y-1 rounded-xl border border-gold-500/40 bg-gold-50 p-3 text-[13px] text-dune" data-testid="herd-preview">
            {pens.map((p) => (
              <li key={p.id}>
                • {p.name}: <b className="tabular-nums">{p.width} × {p.depth} م</b>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-sand-500">تبي حوش بشكل خاص؟ من المكتبة ← الحلال ← «شبك غنم (بالرسم)» وارسمه نقطة بنقطة.</p>
      </div>
    </Modal>
  );
}

function Majlis() {
  const openDialog = useEditor((s) => s.openDialog);
  const [w, setW] = useState(8);
  const [d, setD] = useState(6);
  const [bath, setBath] = useState(true);
  const [kitchen, setKitchen] = useState(true);
  const g = useMemo(() => majlisGroup({ width: w, depth: d, bath, kitchen }), [w, d, bath, kitchen]);
  const go = () => {
    addGroup(g, 'تم بناء المجلس ✓ — اضغط أي غرفة وغيّر الأرضية والجدران، وشوف الداخل من 3D');
    openDialog(null);
  };
  return (
    <Modal
      open
      onClose={() => openDialog(null)}
      title="🏠 صمّم مجلسك"
      footer={
        <>
          <Button onClick={() => openDialog(null)}>إلغاء</Button>
          <Button variant="gold" onClick={go} data-testid="majlis-add">ابنِ المجلس</Button>
        </>
      }
    >
      <div className="space-y-3 p-4" data-testid="majlis-builder">
        <p className="text-[13px] text-sand-700">اختار المقاس، وتنبني الغرفة مع الجلسة والتلفزيون — والحمام والمطبخ جنبه بجدار مشترك.</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {MAJLIS_SIZES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setW(s.w);
                setD(s.d);
              }}
              className={cx('rounded-xl border p-2 text-center', w === s.w && d === s.d ? 'border-gold-500 bg-gold-50' : 'border-sand-200 bg-white hover:border-gold-500')}
              data-testid={`majlis-size-${s.w}`}
            >
              <b className="block text-sm text-dune">{s.label}</b>
              <span className="text-[12px] tabular-nums text-sand-600">
                {s.w} × {s.d} م
              </span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Count icon="↔️" label="الطول" value={w} onChange={(n) => setW(Math.max(4, Math.min(30, n)))} testid="majlis-w" />
          <Count icon="↕️" label="العرض" value={d} onChange={(n) => setD(Math.max(3, Math.min(20, n)))} testid="majlis-d" />
        </div>
        <div className="rounded-xl bg-sand-50 px-3 py-1">
          <Toggle label="🚿 حمام" checked={bath} onChange={setBath} />
          <Toggle label="🍳 مطبخ (ركن القهوة والشاي)" checked={kitchen} onChange={setKitchen} />
        </div>
        <div className="rounded-xl border border-gold-500/40 bg-gold-50 p-3 text-[13px] text-dune">
          المبنى كامل تقريباً <b className="tabular-nums">{Math.round(g.width * 10) / 10} × {g.depth} م</b> — المجلس <b className="tabular-nums">{w * d} م²</b> يكفي تقريباً <b>{Math.floor((2 * (w + d) - 4) / 0.7)}</b> شخص جلوس
        </div>
        <p className="text-[11px] text-sand-500">تبي مبنى أكبر (غرف نوم وغرفة ألعاب)؟ من المكتبة ← المباني ← «مبنى عزبة كامل».</p>
      </div>
    </Modal>
  );
}
