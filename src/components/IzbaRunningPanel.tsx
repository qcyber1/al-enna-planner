// «💵 المصاريف الشهرية» في ملف العزبة: المجموع الكبير، التوزيع، وأرقام تقدر تغيّرها بسهولة
import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Plan } from '../types/plan';
import type { Summary } from '../lib/quantities';
import { useEditor } from '../store/editorStore';
import { izbaRunning, runInputs, RUN_DEFAULTS, type RunKey, type Season } from '../lib/izbaRunning';
import { formatNumber } from '../lib/geometry';
import { Segmented, cx } from './ui';

const COLORS: Record<string, string> = { workers: '#8b5e34', feed: '#c99a2e', water: '#3b82c4', power: '#e0a100', vet: '#2f8f5b', maint: '#7a7a7a' };
const n0 = (n: number) => formatNumber(Math.round(n), 0);

export function IzbaRunningPanel({ plan, summary, buildCost }: { plan: Plan; summary: Summary; buildCost: number }) {
  const prices = useEditor((s) => s.project.prices);
  const setPrice = useEditor((s) => s.setPrice);
  const [season, setSeason] = useState<Season>('summer');
  const r = useMemo(() => izbaRunning(plan, summary, prices, buildCost, season), [plan, summary, prices, buildCost, season]);
  const inp = runInputs(prices);
  const custom = Object.keys(prices).some((k) => k.startsWith('run.'));
  const set = (k: RunKey | 'power', v: number | null) => setPrice('run.' + k, v);
  const reset = () => {
    for (const k of Object.keys(RUN_DEFAULTS)) set(k as RunKey, null);
  };
  const hasAnimals = r.capacity.sheep + r.capacity.camels + r.capacity.horses > 0 || r.sheep + r.camels + r.horses > 0;

  return (
    <div className="space-y-3" data-testid="izba-running">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-sand-700">كم تكلفك العزبة كل شهر بعد ما تخلص؟ غيّر أي رقم تحت ويتحدث المجموع.</p>
        <Segmented
          size="sm"
          value={season}
          onChange={setSeason}
          options={[
            { value: 'summer', label: '☀️ صيف' },
            { value: 'winter', label: '❄️ شتا' },
          ]}
        />
      </div>

      {/* المجموع */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="col-span-2 rounded-xl bg-dune p-3 text-sand-50 sm:col-span-1">
          <div className="text-[12px] opacity-80">بالشهر ({season === 'summer' ? 'الصيف' : 'الشتا'})</div>
          <div className="text-2xl font-extrabold tabular-nums" data-testid="run-monthly">
            {n0(r.monthly)} <span className="text-sm font-bold">ر.ق</span>
          </div>
        </div>
        <div className="rounded-xl border border-sand-200 bg-white p-3">
          <div className="text-[12px] text-sand-600">بالسنة (متوسط الصيف والشتا)</div>
          <div className="text-lg font-extrabold text-dune tabular-nums sm:text-xl" data-testid="run-yearly">
            {n0(r.yearlyAvg)} <span className="text-sm font-bold">ر.ق</span>
          </div>
        </div>
        <div className="rounded-xl border border-sand-200 bg-white p-3">
          <div className="text-[12px] text-sand-600">كل زيارة (زيارتين بالأسبوع)</div>
          <div className="text-lg font-extrabold text-dune tabular-nums sm:text-xl">
            ~{n0(r.perVisitDay)} <span className="text-sm font-bold">ر.ق</span>
          </div>
        </div>
      </div>

      {/* شريط التوزيع */}
      {r.monthly > 0 && (
        <div className="flex h-3 overflow-hidden rounded-full bg-sand-100" aria-hidden>
          {r.lines.map((l) => (
            <div key={l.key} style={{ width: `${(l.monthly / r.monthly) * 100}%`, background: COLORS[l.key] }} title={l.label} />
          ))}
        </div>
      )}

      {/* البنود */}
      <div className="space-y-1.5">
        {r.lines.map((l) => (
          <div key={l.key} className="flex items-center justify-between gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2" data-testid={`run-line-${l.key}`}>
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[l.key] }} />
              <span className="min-w-0">
                {l.icon} <b>{l.label}</b>
                <span className="block truncate text-[11px] text-sand-500">{l.detail}</span>
              </span>
            </span>
            <span className="shrink-0 text-left">
              <b className="text-dune tabular-nums">{n0(l.monthly)}</b>
              <span className="block text-[10px] text-sand-500">{r.monthly ? Math.round((l.monthly / r.monthly) * 100) : 0}%</span>
            </span>
          </div>
        ))}
      </div>

      {r.tips.length > 0 && (
        <ul className="space-y-1">
          {r.tips.map((t) => (
            <li key={t.text} className={cx('rounded-lg px-3 py-2 text-[13px]', t.level === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-sky-50 text-sky-900')}>
              {t.level === 'warn' ? '⚠️ ' : '💡 '}
              {t.text}
            </li>
          ))}
        </ul>
      )}

      {/* الأرقام اللي تتغير */}
      <details className="rounded-xl border border-sand-200 bg-sand-50 p-3" open={custom}>
        <summary className="cursor-pointer text-sm font-bold text-dune">✏️ غيّر الأرقام (العمال، الحلال، الأسعار)</summary>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Num label="👷 عدد العمال" value={r.workers} hint={r.workers !== r.suggestedWorkers ? `المقترح ${r.suggestedWorkers}` : 'مقترح'} onChange={(v) => set('workers', v)} testid="run-in-workers" />
          <Num label="راتب العامل" value={inp.salary} unit="ر.ق" onChange={(v) => set('salary', v)} />
          <Num label="أكل وسكن وإقامة" value={inp.workerExtra} unit="ر.ق" onChange={(v) => set('workerExtra', v)} />
          {hasAnimals && (
            <>
              <Num label="🐑 غنم" value={r.sheep} hint={`الحظيرة تكفي ${r.capacity.sheep}`} onChange={(v) => set('sheep', v)} testid="run-in-sheep" />
              <Num label="🐪 هجن" value={r.camels} hint={`تكفي ${r.capacity.camels}`} onChange={(v) => set('camels', v)} />
              <Num label="🐎 خيل" value={r.horses} hint={`مواقف ${r.capacity.horses}`} onChange={(v) => set('horses', v)} />
              <Num label="🌾 سعر كيلو العلف" value={inp.feedPrice} unit="ر.ق" step={0.1} onChange={(v) => set('feedPrice', v)} />
            </>
          )}
          <Num label="💧 سعر التانكر" value={inp.tankerPrice} unit="ر.ق" onChange={(v) => set('tankerPrice', v)} />
          <Num label="👥 زوار باليوم" value={inp.people} onChange={(v) => set('people', v)} />
          <Num label="❄️ ساعات المكيف (صيف)" value={inp.acHours} step={1} onChange={(v) => set('acHours', Math.min(24, v))} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-dune">⚡ الكهرباء من:</span>
          <Segmented
            size="sm"
            value={inp.power}
            onChange={(v) => set('power', v === 'diesel' ? 1 : null)}
            options={[
              { value: 'grid', label: 'كهرماء' },
              { value: 'diesel', label: 'مولد ديزل' },
            ]}
          />
          {inp.power === 'grid' ? (
            <Num inline label="سعر الكيلوواط" value={inp.kwhPrice} unit="ر.ق" step={0.01} onChange={(v) => set('kwhPrice', v)} />
          ) : (
            <Num inline label="لتر الديزل" value={inp.dieselPrice} unit="ر.ق" step={0.05} onChange={(v) => set('dieselPrice', v)} />
          )}
        </div>
        {custom && (
          <button type="button" onClick={reset} className="mt-3 flex items-center gap-1 text-[12px] text-sand-600 underline hover:text-dune" data-testid="run-reset">
            <RotateCcw size={12} /> رجّع كل الأرقام التقريبية
          </button>
        )}
      </details>

      <p className="text-[11px] text-sand-500">أرقام تقريبية لقطر عشان تخطط ميزانيتك — الأسعار الحقيقية تختلف حسب المورد والموسم. الأرقام اللي تغيّرها تنحفظ مع المشروع.</p>
    </div>
  );
}

function Num({ label, value, onChange, unit, hint, step = 1, inline, testid }: { label: string; value: number; onChange: (v: number) => void; unit?: string; hint?: string; step?: number; inline?: boolean; testid?: string }) {
  return (
    <label className={cx('text-[12px] text-sand-700', inline ? 'flex items-center gap-1.5' : 'block')}>
      <span className={cx('font-bold', !inline && 'mb-0.5 block')}>{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ''}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v) && v >= 0) onChange(v);
          }}
          data-testid={testid}
          className={cx('h-9 rounded-lg border border-sand-300 bg-white px-2 text-sm tabular-nums focus:border-gold-500 focus:outline-none', inline ? 'w-20' : 'w-full')}
        />
        {unit && <span className="shrink-0 text-[11px] text-sand-500">{unit}</span>}
      </span>
      {hint && <span className="mt-0.5 block text-[10px] text-sand-500">{hint}</span>}
    </label>
  );
}
