// تحليل العزبة: بطاقات سريعة (الحلال، الماي، العلف، الخزان، الكهرباء) + تنبيهات
import { useMemo } from 'react';
import type { Plan } from '../types/plan';
import type { Summary } from '../lib/quantities';
import { izbaInsights } from '../lib/izbaInsights';
import { formatNumber } from '../lib/geometry';

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

export function IzbaInsightsPanel({ plan, summary }: { plan: Plan; summary: Summary }) {
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
