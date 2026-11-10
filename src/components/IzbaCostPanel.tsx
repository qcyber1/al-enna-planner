// لوحة «التكلفة التقديرية» للعزبة: إجمالي بمدى، توزيع حسب الأقسام، وجدول بأسعار تقريبية قابلة للتعديل
import { useMemo, useState } from 'react';
import { useEditor } from '../store/editorStore';
import { formatNumber } from '../lib/geometry';
import { CONTINGENCY_PCT, izbaEstimate } from '../lib/izbaCost';
import type { Plan } from '../types/plan';
import type { Summary } from '../lib/quantities';

const qar = (n: number) => formatNumber(Math.round(n), 0);

export function IzbaCostPanel({ plan, summary }: { plan: Plan; summary: Summary }) {
  const prices = useEditor((s) => s.project.prices);
  const setPrice = useEditor((s) => s.setPrice);
  const est = useMemo(() => izbaEstimate(plan, summary, prices), [plan, summary, prices]);
  const [open, setOpen] = useState(false);
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
