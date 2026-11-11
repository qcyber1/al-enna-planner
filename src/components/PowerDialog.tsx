// نافذة «كهرباء العنة»: الموسم، الأجهزة لكل خيمة، الحمل، المولد، الديزل، والكيابل
import { useMemo, useState } from 'react';
import { Minus, Plus, Zap } from 'lucide-react';
import { useActiveDesign, useEditor } from '../store/editorStore';
import { Button, Modal, cx } from './ui';
import { APPLIANCES, APPLIANCE_BY_ID, DEFAULT_POWER, computePower, suggestAppliances, type ApplianceId } from '../lib/power';
import { formatNumber } from '../lib/geometry';

const n0 = (v: number) => formatNumber(v, 0);

function Stat({ icon, label, value, sub, warn }: { icon: string; label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={cx('rounded-xl border p-2.5', warn ? 'border-red-300 bg-red-50' : 'border-sand-200 bg-white')}>
      <div className="text-[11px] text-sand-600">
        {icon} {label}
      </div>
      <div className="text-lg font-bold text-dune tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-sand-600">{sub}</div>}
    </div>
  );
}

export function PowerDialog() {
  const open = useEditor((s) => s.dialog === 'power');
  const openDialog = useEditor((s) => s.openDialog);
  const setPower = useEditor((s) => s.setPower);
  const saved = useEditor((s) => s.project.power);
  const design = useActiveDesign();
  const st = useMemo(() => ({ ...DEFAULT_POWER, ...saved }), [saved]);
  const r = useMemo(() => computePower(design.plan, st), [design.plan, st]);
  const [edit, setEdit] = useState<string | null>(null);
  if (!open) return null;

  const elOf = (id: string) => design.plan.elements.find((e) => e.id === id)!;
  const cfgOf = (id: string) => st.appliances[id] ?? suggestAppliances(elOf(id), st.season);
  const setCount = (id: string, a: ApplianceId, v: number) => {
    const cur = { ...cfgOf(id), [a]: Math.max(0, Math.min(20, v)) };
    setPower({ appliances: { ...st.appliances, [id]: cur } });
  };
  const resetAuto = (id: string) => {
    const next = { ...st.appliances };
    delete next[id];
    setPower({ appliances: next });
  };
  const visible = APPLIANCES.filter((a) => !a.season || a.season === st.season);
  const genWarn = st.generatorKva > 0 && r.generatorKva > st.generatorKva;

  return (
    <Modal open={open} onClose={() => openDialog(null)} wide="xl" title={design.plan.land.site === 'izba' ? '⚡ كهرباء العزبة' : '⚡ كهرباء العنة'} footer={<Button variant="primary" onClick={() => openDialog(null)}>تم</Button>}>
      <div className="space-y-4 p-5" data-testid="power">
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-sand-100 p-1" role="tablist">
            {(
              [
                ['winter', '❄️ شتا (دفايات)'],
                ['summer', '☀️ صيف (مكيفات)'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setPower({ season: k })} data-testid={`power-${k}`} className={cx('h-9 rounded-lg px-3 text-sm font-bold', st.season === k ? 'bg-white text-dune shadow-sm' : 'text-sand-700')}>
                {l}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-sm">
            ساعات التشغيل بالليلة
            <input type="number" min={1} max={24} value={st.hours} onChange={(e) => setPower({ hours: Math.max(1, Math.min(24, +e.target.value || 10)) })} className="h-9 w-16 rounded border border-sand-300 px-2 text-center" dir="ltr" />
          </label>
          <label className="flex items-center gap-1 text-sm">
            مولدك (KVA)
            <input type="number" min={0} max={2000} value={st.generatorKva || ''} placeholder="—" onChange={(e) => setPower({ generatorKva: Math.max(0, +e.target.value || 0) })} className="h-9 w-20 rounded border border-sand-300 px-2 text-center" dir="ltr" data-testid="power-mygen" />
          </label>
          <label className="flex items-center gap-1 text-sm">
            خزان الديزل (لتر)
            <input type="number" min={50} max={50000} value={st.tankL} onChange={(e) => setPower({ tankL: Math.max(50, +e.target.value || 1000) })} className="h-9 w-20 rounded border border-sand-300 px-2 text-center" dir="ltr" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat icon="⚡" label="أعلى حمل" value={`${r.peakKw} kW`} sub={`المتوسط ${r.avgKw} kW`} />
          <Stat icon="🔌" label="المولد المناسب" value={r.generatorKva ? `${r.generatorKva} KVA` : '—'} sub={genWarn ? `مولدك ${st.generatorKva} KVA ما يكفي` : st.season === 'summer' ? 'مع هامش تشغيل المكيفات' : 'مع هامش 15–25% للأمان'} warn={genWarn} />
          <Stat icon="⛽" label="الديزل بالليلة" value={r.litersPerNight ? `${r.litersPerNight} لتر` : '—'} sub={`${st.hours} ساعة تشغيل`} />
          <Stat icon="🛢️" label="الخزان يكفي" value={r.tankNights === null ? '—' : `${r.tankNights} ليلة`} sub={r.tankNights === null ? 'ما في خزان ديزل' : `${n0(st.tankL)} لتر`} warn={r.tankNights !== null && r.tankNights < 3} />
        </div>

        {r.warnings.length > 0 && (
          <ul className="space-y-1" data-testid="power-warnings">
            {r.warnings.map((w) => (
              <li key={w} className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-800">
                ⚠️ {w}
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-xl border border-sand-200 bg-white p-3">
          <h3 className="mb-1 font-bold text-dune">الأجهزة في كل مكان</h3>
          <p className="mb-2 text-[12px] text-sand-600">حطينا اقتراح تلقائي حسب نوع المكان ومساحته — اضغط «تعديل» وغيّر العدد.</p>
          <div className="divide-y divide-sand-100">
            {r.lines.map((l) => (
              <div key={l.id} className="py-2" data-testid="power-line">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-dune">
                      {l.name} {l.auto && <span className="rounded bg-sand-100 px-1.5 text-[10px] text-sand-600">تلقائي</span>}
                    </div>
                    <div className="text-[12px] text-sand-700">
                      {l.items.length
                        ? l.items
                            .filter((i) => !APPLIANCE_BY_ID[i.id].season || APPLIANCE_BY_ID[i.id].season === st.season)
                            .map((i) => `${APPLIANCE_BY_ID[i.id].icon} ${i.n > 1 ? i.n + '× ' : ''}${APPLIANCE_BY_ID[i.id].label}`)
                            .join(' • ') || 'ما في أجهزة هالموسم'
                        : 'ما في أجهزة'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm tabular-nums">
                    <span>
                      <b>{formatNumber(l.watts / 1000, 1)}</b> kW
                    </span>
                    <button type="button" onClick={() => setEdit(edit === l.id ? null : l.id)} className="text-gold-700 underline" data-testid="power-edit">
                      {edit === l.id ? 'تم' : 'تعديل'}
                    </button>
                  </div>
                </div>
                {edit === l.id && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {visible.map((a) => {
                      const v = cfgOf(l.id)[a.id] ?? 0;
                      return (
                        <div key={a.id} className="flex items-center justify-between rounded-lg bg-sand-50 px-2 py-1 text-[13px]">
                          <span>
                            {a.icon} {a.label}
                          </span>
                          <span className="flex items-center gap-1">
                            <button type="button" aria-label="أقل" onClick={() => setCount(l.id, a.id, v - 1)} className="rounded bg-white p-1 shadow-sm">
                              <Minus size={12} />
                            </button>
                            <b className="w-5 text-center tabular-nums">{v}</b>
                            <button type="button" aria-label="أكثر" onClick={() => setCount(l.id, a.id, v + 1)} className="rounded bg-white p-1 shadow-sm" data-testid={`power-add-${a.id}`}>
                              <Plus size={12} />
                            </button>
                          </span>
                        </div>
                      );
                    })}
                    {!l.auto && (
                      <button type="button" onClick={() => resetAuto(l.id)} className="text-[12px] text-sand-600 underline">
                        رجّع الاقتراح التلقائي
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="font-semibold text-dune">💡 الإنارة (من المخطط)</span>
              <span className="tabular-nums">
                <b>{formatNumber(r.lightingW / 1000, 1)}</b> kW
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-sand-200 bg-white p-3">
          <h3 className="mb-1 flex items-center gap-1 font-bold text-dune">
            <Zap size={16} /> الكيابل من المولد
          </h3>
          {r.generator ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="text-[11px] text-sand-600">
                    <tr>
                      <th className="text-right">المكان</th>
                      <th>المسافة</th>
                      <th>التيار</th>
                      <th>الكيبل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.lines
                      .filter((l) => l.watts > 0)
                      .map((l) => (
                        <tr key={l.id} className="border-t border-sand-100">
                          <td className="py-1">{l.name}</td>
                          <td className="text-center tabular-nums">{l.cableM} م</td>
                          <td className="text-center tabular-nums">{l.amps} A</td>
                          <td className={cx('text-center tabular-nums', !l.cableMm2 && 'font-bold text-red-700')}>{l.cableMm2 ? `${l.cableMm2} مم²` : 'لوحة فرعية'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {r.cableByMm2.length > 0 && (
                <div className="mt-2 rounded-lg bg-sand-50 p-2 text-sm" data-testid="power-cables">
                  <b>المطلوب تقريباً:</b> {r.cableByMm2.map((c) => `${n0(c.m)} م كيبل ${c.mm2} مم²`).join(' • ')}
                  {r.lightingCableM ? <span className="text-sand-600"> (منها {n0(r.lightingCableM)} م للإنارة)</span> : null}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-sand-700">حط «مولد كهرباء» في المخطط (من المكتبة ← المرافق) عشان نحسب طول الكيابل ومقاساتها.</p>
          )}
        </div>
        <p className="text-[11px] text-sand-500">حسابات تقريبية (230 فولت، كيبل نحاس، هبوط جهد 5% أو أقل) للتخطيط وطلب المولد — الكهربائي يعتمد المقاسات النهائية.</p>
      </div>
    </Modal>
  );
}
