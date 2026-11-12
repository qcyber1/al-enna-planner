// «قارن بين الاستخدامات»: قبل ما تختار قالب، شوف التكلفة والحلال والماي والمباني لكل استخدام على مقاس أرضك
import { useMemo } from 'react';
import { buildIzba, IZBA_USES, type IzbaPlots, type IzbaUse } from '../lib/izba';
import { computeSummary, DEFAULT_ESTIMATE } from '../lib/quantities';
import { izbaEstimate } from '../lib/izbaCost';
import { izbaInsights } from '../lib/izbaInsights';
import { izbaRunning } from '../lib/izbaRunning';
import { formatNumber } from '../lib/geometry';

export function IzbaCompare({ plots, onPick }: { plots: IzbaPlots; onPick: (u: IzbaUse) => void }) {
  const rows = useMemo(
    () =>
      IZBA_USES.map((u) => {
        const plan = buildIzba(u.id, plots);
        const s = computeSummary(plan, DEFAULT_ESTIMATE);
        const e = izbaEstimate(plan, s, {});
        const x = izbaInsights(plan, s);
        return { u, total: e.total, month: izbaRunning(plan, s, {}, e.total).monthly, herd: x.sheep + x.camels + x.horses, water: x.waterPerDay, built: x.builtArea };
      }),
    [plots],
  );
  const k = (n: number) => (n < 10000 ? formatNumber(Math.round(n / 100) / 10, 1) : formatNumber(Math.round(n / 1000), 0)) + ' ألف';
  const cheapest = Math.min(...rows.map((r) => r.total));
  return (
    <div className="overflow-x-auto rounded-xl border border-sand-200 bg-white" data-testid="izba-compare">
      <table className="w-full text-[12px]">
        <thead className="bg-sand-50 text-[11px] text-sand-600">
          <tr>
            <th className="p-2 text-right">الاستخدام</th>
            <th>التكلفة</th>
            <th>تشغيل/شهر</th>
            <th>الحلال</th>
            <th>الماي/يوم</th>
            <th>المباني</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.u.id} className="border-t border-sand-100">
              <td className="p-2 font-semibold text-dune">
                {r.u.icon} {r.u.title}
              </td>
              <td className="text-center tabular-nums">
                {k(r.total)}
                {r.total === cheapest && <span className="block text-[10px] text-turf-700">الأوفر</span>}
              </td>
              <td className="text-center tabular-nums" data-testid={`compare-month-${r.u.id}`}>{k(r.month)}</td>
              <td className="text-center tabular-nums">{r.herd ? `~${r.herd}` : '—'}</td>
              <td className="whitespace-nowrap text-center tabular-nums">{formatNumber(r.water, 0)} ل</td>
              <td className="whitespace-nowrap text-center tabular-nums">{formatNumber(r.built, 0)} م²</td>
              <td className="p-1">
                <button type="button" onClick={() => onPick(r.u.id)} className="rounded-lg bg-gold-500 px-2 py-1 text-[11px] font-bold text-dune" data-testid={`compare-pick-${r.u.id}`}>
                  اختار
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="p-2 text-[10px] text-sand-500">«تشغيل/شهر» = العمال والعلف والماي والكهرباء والصيانة بالصيف. تقديرات تقريبية للقالب الجاهز — تقدر تعدّل كل شي بعد ما تختار.</p>
    </div>
  );
}
