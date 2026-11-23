// لوحة «التكلفة التقديرية» للعزبة: إجمالي بمدى، توزيع حسب الأقسام، وجدول بأسعار تقريبية قابلة للتعديل
import { useMemo, useState } from 'react';
import { useEditor } from '../store/editorStore';
import { formatNumber } from '../lib/geometry';
import { budgetFit, CONTINGENCY_PCT, izbaEstimate, izbaPhases, phasePlan } from '../lib/izbaCost';
import type { Plan } from '../types/plan';
import type { Summary } from '../lib/quantities';

const qar = (n: number) => formatNumber(Math.round(n), 0);

export function IzbaCostPanel({ plan, summary }: { plan: Plan; summary: Summary }) {
  const prices = useEditor((s) => s.project.prices);
  const setPrice = useEditor((s) => s.setPrice);
  const est = useMemo(() => izbaEstimate(plan, summary, prices), [plan, summary, prices]);
  const [open, setOpen] = useState(false);
  const phases = useMemo(() => izbaPhases(est), [est]);
  /** تصميم جديد فيه بس اللي ينبني لين هالمرحلة — تشوفه بالمخطط والمجسم */
  const showPhase = (n: 1 | 2, title: string) => {
    const st = useEditor.getState();
    st.addDesign(`المرحلة ${n} — ${title}`, 'blank', true);
    st.setPlan(() => phasePlan(plan, n), { history: false });
    st.openDialog(null);
    st.toast(`هذي العزبة بعد «المرحلة ${n}» — التصميم الأصلي محفوظ في «التصاميم»`, 'success');
  };
  const budget = prices['izba.budget'] ?? 0;
  const fit = useMemo(() => (budget > 0 ? budgetFit(est, budget) : null), [est, budget]);
  const setBudget = (n: number | null) => setPrice('izba.budget', n && n > 0 ? Math.round(n) : null);
  const statusOf = (n: number) => fit?.phases.find((p) => p.n === n)?.status;
  const top = Math.max(1, ...est.byGroup.map((g) => g.total));
  const customCount = est.lines.filter((l) => l.custom).length;

  return (
    <div className="space-y-3 rounded-xl border-2 border-gold-500 bg-white p-4" data-testid="izba-cost">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-bold text-dune">💰 التكلفة التقديرية للعزبة</h3>
          <p className="text-[12px] text-sand-600">أسعار تقريبية لسوق قطر — تختلف حسب المقاول والمواد. عدّل أي سعر من الجدول.</p>
        </div>
        <div className="text-left">
          <div className="text-2xl font-bold text-dune tabular-nums" data-testid="izba-cost-total">
            {qar(est.total)} <span className="text-base">ر.ق</span>
          </div>
          <div className="text-[12px] text-sand-600 tabular-nums" data-testid="izba-cost-range">
            المتوقع بين {qar(est.low)} و {qar(est.high)} ر.ق
          </div>
        </div>
      </div>

      {/* 💰 ميزانيتي */}
      <div className="rounded-xl bg-sand-50 p-3" data-testid="izba-budget">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-dune">💰 ميزانيتي:</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={10000}
            dir="ltr"
            placeholder="مثلاً 300000"
            value={budget || ''}
            onChange={(e) => setBudget(e.target.value === '' ? null : parseFloat(e.target.value))}
            className="h-9 w-36 rounded-lg border border-sand-300 bg-white px-2 text-left text-base tabular-nums focus:border-gold-500 focus:outline-none"
            data-testid="izba-budget-input"
          />
          <span className="text-sm text-sand-600">ر.ق</span>
          <span className="flex flex-wrap gap-1">
            {[200000, 300000, 500000, 1000000].map((v) => (
              <button key={v} type="button" onClick={() => setBudget(v)} className={`rounded-full border px-2 py-0.5 text-[12px] font-semibold ${budget === v ? 'border-gold-500 bg-gold-500 text-dune' : 'border-sand-300 bg-white text-sand-700'}`}>
                {v >= 1000000 ? `${v / 1000000} مليون` : `${v / 1000} ألف`}
              </button>
            ))}
          </span>
          {budget > 0 && (
            <button type="button" onClick={() => setBudget(null)} className="text-[11px] text-sand-500 underline">
              مسح
            </button>
          )}
        </div>
        {fit && (
          <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${fit.all ? 'bg-turf-500/10 text-turf-700' : 'bg-amber-50 text-amber-900'}`} data-testid="izba-budget-result">
            {fit.all ? (
              <>✅ ميزانيتك تكفي العزبة كاملة — ويبقى لك تقريباً <b className="tabular-nums">{qar(fit.budget - est.total)}</b> ر.ق</>
            ) : fit.phases.some((p) => p.status === 'in') ? (
              <>
                ✅ تكفي {fit.phases.filter((p) => p.status === 'in').map((p) => `المرحلة ${p.n}`).join(' و')}
                {fit.left > 0 && <> ويبقى <b className="tabular-nums">{qar(fit.left)}</b></>} — والعزبة كاملة تحتاج <b className="tabular-nums">{qar(fit.shortfall)}</b> ر.ق زيادة
              </>
            ) : (
              <>⚠️ المرحلة 1 (السور والخدمات) لحالها تحتاج <b className="tabular-nums">{qar(fit.phases[0]?.total ?? est.total)}</b> ر.ق — صغّر العزبة أو ابدأ بالسور والماي بس</>
            )}
            {fit.wholeLater && (
              <div className="mt-1 text-[12px]" data-testid="izba-budget-later">
                💡 بالباقي تقدر تسوي «المرحلة {fit.wholeLater.n}: {fit.wholeLater.title}» كاملة ({qar(fit.wholeLater.total)}) وتأجّل اللي قبلها
              </div>
            )}
            {fit.startWith.length > 0 && (
              <div className="mt-1 text-[12px]">💡 بالباقي تقدر تبدأ من المرحلة الجاية بـ: {fit.startWith.slice(0, 4).map((x) => x.label).join('، ')}</div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {est.byGroup.map((g) => (
          <div key={g.id} className="grid grid-cols-[8.5rem_1fr_6.5rem] items-center gap-2 text-sm">
            <span>
              {g.icon} {g.title}
            </span>
            <div className="h-2.5 overflow-hidden rounded-full bg-sand-100">
              <div className="h-full rounded-full bg-gold-500" style={{ width: `${(g.total / top) * 100}%` }} />
            </div>
            <span className="text-left tabular-nums">{qar(g.total)}</span>
          </div>
        ))}
        <div className="grid grid-cols-[8.5rem_1fr_6.5rem] items-center gap-2 text-sm text-sand-700">
          <span>
            🛟 احتياطي {CONTINGENCY_PCT}%
            <span className="block text-[10px] leading-tight text-sand-500">توصيلات، تسوية، رخص</span>
          </span>
          <span />
          <span className="text-left tabular-nums">{qar(est.contingency)}</span>
        </div>
      </div>

      {phases.length > 1 && (
        <div className="space-y-1.5" data-testid="izba-phases">
          <div className="text-sm font-bold text-dune">🗓️ إذا بتبنيها على مراحل</div>
          {phases.map((p, i) => (
            <div key={p.n} className="rounded-lg bg-sand-50 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold text-dune">
                  {p.icon} المرحلة {p.n}: {p.title}
                  {statusOf(p.n) === 'in' && <span className="mr-1.5 rounded-full bg-turf-500/15 px-1.5 text-[10px] font-bold text-turf-700">✓ داخل الميزانية</span>}
                  {statusOf(p.n) === 'partial' && <span className="mr-1.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">جزء منها</span>}
                  {statusOf(p.n) === 'out' && <span className="mr-1.5 rounded-full bg-sand-200 px-1.5 text-[10px] font-bold text-sand-700">بعدين</span>}
                </span>
                <span className="tabular-nums">
                  <b>{qar(p.total)}</b>
                  {i > 0 && <span className="text-[11px] text-sand-500"> • المجموع {qar(phases.slice(0, i + 1).reduce((t, x) => t + x.total, 0))}</span>}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-sand-600">{p.hint}</span>
                {p.n < 3 && (
                  <button type="button" onClick={() => showPhase(p.n as 1 | 2, p.title)} className="shrink-0 rounded-md border border-gold-500 bg-white px-2 py-0.5 text-[11px] font-bold text-dune" data-testid={`show-phase-${p.n}`}>
                    👁 شوفها
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-semibold text-gold-700 underline" data-testid="izba-cost-toggle">
        {open ? 'إخفاء التفاصيل' : `تفاصيل البنود (${est.lines.length})${customCount ? ` — عدّلت ${customCount}` : ''}`}
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] text-sand-600">
              <tr>
                <th className="text-right">البند</th>
                <th>الكمية</th>
                <th>سعر الوحدة</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {est.lines.map((l) => (
                <tr key={l.key} className="border-t border-sand-100">
                  <td className="py-1">{l.label}</td>
                  <td className="whitespace-nowrap px-1 text-center tabular-nums">
                    {formatNumber(l.qty, 1)} <span className="text-[10px] text-sand-500">{l.unit}</span>
                  </td>
                  <td className="w-24 py-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        dir="ltr"
                        value={l.unitPrice}
                        onChange={(e) => setPrice(l.key, e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0))}
                        className={`h-8 w-full min-w-0 rounded border px-1.5 text-left text-sm ${l.custom ? 'border-gold-500 bg-gold-50 font-semibold' : 'border-sand-300'}`}
                        aria-label={`سعر ${l.label}`}
                        data-testid={`izba-price-${l.key}`}
                      />
                      {l.custom && (
                        <button type="button" title={`رجّع السعر التقريبي (${l.price})`} onClick={() => setPrice(l.key, null)} className="text-xs text-sand-500 hover:text-dune">
                          ↺
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-1 text-left tabular-nums">{qar(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-sand-500">التقدير للتخطيط فقط وما يغني عن عرض سعر رسمي من المقاول. الأسعار المعدّلة تنحفظ في مشروعك.</p>
    </div>
  );
}
