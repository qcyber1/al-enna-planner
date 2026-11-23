// تحليل العزبة: بطاقات سريعة (الحلال، الماي، العلف، الخزان، الكهرباء) + تنبيهات
import { useMemo } from 'react';
import type { Plan } from '../types/plan';
import type { Summary } from '../lib/quantities';
import { izbaInsights } from '../lib/izbaInsights';
import { izbaIrrigation } from '../lib/irrigation';
import { formatNumber } from '../lib/geometry';
import { penShade, shadeFix } from '../lib/izbaShade';
import { permitFacts, PERMIT_DOCS } from '../lib/izbaPermit';
import { useEditor } from '../store/editorStore';

const n = (v: number) => formatNumber(v, 0);

function Card({ icon, label, value, sub, warn }: { icon: string; label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-2.5 ${warn ? 'border-red-300 bg-red-50' : 'border-sand-200 bg-white'}`}>
      <div className="text-[11px] text-sand-600">
        {icon} {label}
      </div>
      <div className="text-lg font-bold text-dune tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-sand-600">{sub}</div>}
    </div>
  );
}

export function IzbaInsightsPanel({ plan, summary, hideIrrigation }: { plan: Plan; summary: Summary; hideIrrigation?: boolean }) {
  const x = useMemo(() => izbaInsights(plan, summary), [plan, summary]);
  const herd = [x.sheep && `${n(x.sheep)} غنم`, x.camels && `${n(x.camels)} إبل`, x.horses && `${n(x.horses)} خيل`].filter(Boolean).join(' • ');
  return (
    <div className="space-y-2" data-testid="izba-insights">
      <h3 className="font-bold text-dune">📊 تحليل العزبة</h3>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Card icon="🏠" label="المباني" value={`${n(x.builtArea)} م²`} sub={`${x.coveragePct}% من الأرض`} />
        <Card icon="🐑" label="سعة الحلال التقريبية" value={herd || '—'} sub={herd ? 'حسب مساحة الحظاير' : 'ما في حظاير'} />
        <Card icon="💧" label="الماي باليوم" value={`${n(x.waterPerDay)} لتر`} sub={`${n(x.palms)} نخلة • ${n(x.trees)} شجرة`} />
        <Card icon="🛢️" label="الخزانات تكفي" value={x.tankDays === null ? '—' : `${x.tankDays} يوم`} sub={`${x.tanks} خزان`} warn={x.tankDays !== null ? x.tankDays < 2 : x.waterPerDay > 0} />
        <Card icon="🌾" label="العلف باليوم" value={x.feedPerDay ? `${n(x.feedPerDay)} كجم` : '—'} sub={x.feedPerDay ? `≈ ${n(x.feedPerDay * 30)} كجم بالشهر` : undefined} />
        <Card icon="❄️" label="التكييف" value={x.acTons ? `${x.acTons} طن` : '—'} sub="تقريباً طن لكل 15 م²" />
        <Card icon="⚡" label="الحمل الكهربائي" value={`${x.powerKw} kW`} sub="تكييف + إنارة + مضخات" />
        <Card icon="🔌" label="المولد المناسب" value={x.generatorKva ? `${x.generatorKva} KVA` : '—'} sub="مع هامش تشغيل المكيفات" />
      </div>
      <ShadeCard plan={plan} />
      <PermitCard plan={plan} />
      {!hideIrrigation && <IzbaIrrigationPanel plan={plan} />}
      {x.tips.length > 0 && (
        <ul className="space-y-1" data-testid="izba-tips">
          {x.tips.map((t) => (
            <li key={t.text} className={`rounded-lg px-3 py-1.5 text-sm ${t.level === 'warn' ? 'bg-red-50 text-red-800' : 'bg-sand-100 text-sand-800'}`}>
              {t.level === 'warn' ? '⚠️' : '💡'} {t.text}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-sand-500">أرقام تقريبية لصيف قطر للتخطيط فقط — الماي والعلف يختلفون حسب السلالة والموسم.</p>
    </div>
  );
}

/** شبكة الري بالتنقيط (بطاقات) */
export function IzbaIrrigationPanel({ plan }: { plan: Plan }) {
  const irr = useMemo(() => izbaIrrigation(plan), [plan]);
  if (!irr.flowLph) return <p className="rounded-lg bg-sand-100 p-3 text-sm text-sand-700">ما في زرع في المخطط — حط نخل أو شجر أو أحواض زراعة من المكتبة وتطلع لك شبكة الري.</p>;
  return (
        <div className="space-y-2 pt-1" data-testid="izba-irrigation">
          <h3 className="font-bold text-dune">💧 شبكة الري بالتنقيط</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Card icon="🚰" label="الخط الرئيسي (32 مم)" value={`${n(irr.mainM)} م`} sub={irr.hasTank ? 'من الخزان لكل الزرع' : 'ما في خزان — محسوب بين الزرع'} warn={!irr.hasTank} />
            <Card icon="〰️" label="خطوط التنقيط (16 مم)" value={`${n(irr.lateralM)} م`} sub={`${n(irr.drippers)} نقاطة${irr.sprinklers ? ` • ${irr.sprinklers} رشاش` : ''}`} />
            <Card icon="⚙️" label="المضخة" value={`${irr.pumpHp} حصان`} sub={`${n(irr.flowLph)} لتر/ساعة`} />
            <Card icon="⏱️" label="وقت الري باليوم" value={`${n(irr.minutesPerDay)} دقيقة`} sub={`${irr.zones} محبس (زون) — كل واحد لحاله`} />
          </div>
        </div>
  );
}

/** ☀️ ظل الحلال بالصيف: كل حظيرة كم راس يلقى ظل، وزر «أضف مظلة» للناقص */
function ShadeCard({ plan }: { plan: Plan }) {
  const pens = useMemo(() => penShade(plan), [plan]);
  if (!pens.length) return null;
  const add = (id: string) => {
    const el = shadeFix(plan, id);
    if (!el) return;
    const st = useEditor.getState();
    st.addElement(el);
    st.toast(`تمت إضافة «${el.name}» داخل الحظيرة ✓`, 'success');
  };
  const bad = pens.filter((p) => !p.ok);
  return (
    <div className={`rounded-xl border p-3 ${bad.length ? 'border-amber-300 bg-amber-50' : 'border-turf-500/30 bg-turf-500/5'}`} data-testid="izba-shade">
      <div className="mb-1 text-sm font-bold text-dune">☀️ ظل الحلال وقت الصيف {bad.length ? '' : '— يكفي ✓'}</div>
      <ul className="space-y-1">
        {pens.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span>
              {p.ok ? '✅' : '⚠️'} <b>{p.name}</b>: الظل يكفي <b className="tabular-nums">{n(p.shadedHeads)}</b> من <b className="tabular-nums">{n(p.heads)}</b> {p.kind === 'sheep' ? 'راس' : 'بعير'}
              {!p.ok && <span className="text-sand-600"> (ناقص ~{n(p.missingM2)} م²)</span>}
            </span>
            {!p.ok && plan.elements.find((e) => e.id === p.id)?.kind !== 'pen-fence' && (
              <button type="button" onClick={() => add(p.id)} className="rounded-lg bg-gold-500 px-2.5 py-1 text-[12px] font-bold text-dune" data-testid={`shade-fix-${p.id}`}>
                + أضف مظلة تكفي
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] text-sand-500">بالصيف الحلال يحتاج ظل طول اليوم: تقريباً 1.2 م² للراس الغنم و4 م² للبعير.</p>
    </div>
  );
}

/** 📋 قبل الرخصة: قياسات تاخذها للمكتب الهندسي + الأوراق المعتادة */
function PermitCard({ plan }: { plan: Plan }) {
  const f = useMemo(() => permitFacts(plan), [plan]);
  return (
    <details className="rounded-xl border border-sand-200 bg-white p-3" data-testid="izba-permit">
      <summary className="cursor-pointer text-sm font-bold text-dune">📋 قبل الرخصة — أرقام تاخذها للمكتب الهندسي</summary>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[13px] md:grid-cols-4">
        <div className="rounded-lg bg-sand-50 p-2">مساحة المباني<b className="block tabular-nums text-dune">{n(f.builtArea)} م² ({f.builtPct}%)</b></div>
        <div className="rounded-lg bg-sand-50 p-2">عدد المباني<b className="block tabular-nums text-dune">{f.buildings}</b></div>
        <div className="rounded-lg bg-sand-50 p-2">أقرب مبنى للسور<b className="block tabular-nums text-dune">{f.closestBuilding ? `${f.closestBuilding.m} م` : '—'}</b>{f.closestBuilding && <span className="block truncate text-[11px] text-sand-500">{f.closestBuilding.name}</span>}</div>
        <div className="rounded-lg bg-sand-50 p-2">أقرب حظيرة للسور<b className="block tabular-nums text-dune">{f.closestPen ? `${f.closestPen.m} م` : '—'}</b>{f.closestPen && <span className="block truncate text-[11px] text-sand-500">{f.closestPen.name}</span>}</div>
      </div>
      <div className="mt-2 text-[12px] font-bold text-dune">الأوراق المعتادة:</div>
      <ul className="mt-1 list-inside list-disc text-[12px] text-sand-800">
        {PERMIT_DOCS.map((d) => <li key={d}>{d}</li>)}
      </ul>
      <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-900">الاشتراطات (نسبة البناء، الارتدادات عن السور، بُعد الحظاير، عدد المباني) تتحدث وتختلف حسب المنطقة — اسأل المكتب الهندسي أو البلدية عن الحد المسموح لأرضك وقارنه بهالأرقام.</p>
    </details>
  );
}
