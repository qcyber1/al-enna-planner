// «🏗️ متابعة البناء» في ملف العزبة: صح على كل شغلة خلصت، وسجّل الدفعات للمقاول
import { useMemo, useState } from 'react';
import type { Plan } from '../types/plan';
import { useEditor } from '../store/editorStore';
import { buildProgress, buildTasks } from '../lib/izbaBuild';
import { formatNumber } from '../lib/geometry';
import { Button, cx } from './ui';

const qar = (n: number) => formatNumber(Math.round(n), 0);
const uid = () => Math.random().toString(36).slice(2, 10);

export function IzbaBuildPanel({ plan, estimate }: { plan: Plan; estimate: number }) {
  const log = useEditor((s) => s.project.build);
  const setBuild = useEditor((s) => s.setBuild);
  const phases = useMemo(() => buildTasks(plan), [plan]);
  const pr = buildProgress(phases, log);
  const done = new Set(log?.done ?? []);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const toggle = (id: string) =>
    setBuild((b) => ({ ...b, done: b.done.includes(id) ? b.done.filter((x) => x !== id) : [...b.done, id] }));
  const addPay = () => {
    const a = parseFloat(amount);
    if (!(a > 0)) return;
    setBuild((b) => ({ ...b, payments: [{ id: uid(), at: Date.now(), amount: Math.round(a), note: note.trim().slice(0, 120) }, ...b.payments] }));
    setAmount('');
    setNote('');
  };
  const paidPct = estimate ? Math.round((pr.paid / estimate) * 100) : 0;

  return (
    <div className="space-y-3" data-testid="izba-build">
      <p className="text-[13px] text-sand-700">بديت تبني؟ صحّح على اللي خلص، وسجّل كل دفعة للمقاول — وتعرف وين وصلت وكم صرفت.</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-dune p-3 text-sand-50">
          <div className="text-[12px] opacity-80">الشغل اللي خلص</div>
          <div className="text-2xl font-extrabold tabular-nums" data-testid="build-pct">{pr.pct}%</div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-gold-400" style={{ width: `${pr.pct}%` }} />
          </div>
          <div className="mt-1 text-[11px] opacity-80">
            {pr.done} من {pr.total} {pr.current ? `• الحين: ${pr.current.icon} ${pr.current.title}` : '• خلصت 🎉'}
          </div>
        </div>
        <div className="rounded-xl border border-sand-200 bg-white p-3">
          <div className="text-[12px] text-sand-600">دفعت للحين</div>
          <div className="text-xl font-extrabold text-dune tabular-nums" data-testid="build-paid">
            {qar(pr.paid)} <span className="text-sm">ر.ق</span>
          </div>
          <div className={cx('mt-1 text-[11px]', paidPct > pr.pct + 15 ? 'font-bold text-amber-700' : 'text-sand-600')}>
            {paidPct}% من التقدير ({qar(estimate)}){paidPct > pr.pct + 15 ? ' — الدفع سابق الشغل، انتبه' : ''}
          </div>
        </div>
      </div>

      {phases.map((p) => {
        const n = p.tasks.filter((x) => done.has(x.id)).length;
        return (
          <div key={p.n} className="rounded-xl border border-sand-200 bg-white p-3">
            <div className="mb-1.5 flex items-center justify-between text-sm font-bold text-dune">
              <span>
                {p.icon} المرحلة {p.n}: {p.title}
              </span>
              <span className={cx('rounded-full px-2 text-[11px]', n === p.tasks.length ? 'bg-turf-500/15 text-turf-700' : 'bg-sand-100 text-sand-700')}>
                {n}/{p.tasks.length}
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {p.tasks.map((x) => (
                <li key={x.id}>
                  <label className={cx('flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]', done.has(x.id) ? 'bg-turf-500/10 text-turf-800 line-through decoration-turf-600/40' : 'hover:bg-sand-50')}>
                    <input type="checkbox" checked={done.has(x.id)} onChange={() => toggle(x.id)} className="h-4 w-4 accent-turf-600" data-testid={`task-${x.id}`} />
                    {x.text}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <div className="rounded-xl border border-sand-200 bg-white p-3">
        <div className="mb-1.5 text-sm font-bold text-dune">💵 الدفعات للمقاول</div>
        <div className="flex flex-wrap gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            dir="ltr"
            placeholder="المبلغ"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9 w-28 rounded-lg border border-sand-300 px-2 text-left text-base tabular-nums sm:text-sm"
            data-testid="pay-amount"
          />
          <input
            placeholder="ملاحظة (مثلاً: دفعة السور)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPay()}
            className="h-9 min-w-0 flex-1 rounded-lg border border-sand-300 px-2 text-base sm:text-sm"
          />
          <Button size="sm" variant="gold" onClick={addPay} disabled={!(parseFloat(amount) > 0)} data-testid="pay-add">
            + أضف
          </Button>
        </div>
        {log?.payments.length ? (
          <ul className="mt-2 divide-y divide-sand-100 text-[13px]">
            {log.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">
                  <b className="tabular-nums text-dune">{qar(p.amount)}</b> ر.ق {p.note && <span className="text-sand-600">— {p.note}</span>}
                  <span className="block text-[11px] text-sand-500">{new Date(p.at).toLocaleDateString('en-GB')}</span>
                </span>
                <button type="button" onClick={() => setBuild((b) => ({ ...b, payments: b.payments.filter((x) => x.id !== p.id) }))} className="shrink-0 text-[12px] text-red-700">
                  حذف
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12px] text-sand-500">ما سجلت دفعات للحين.</p>
        )}
      </div>
      <p className="text-[11px] text-sand-500">كل شي ينحفظ مع المشروع — ولو صدّرت المشروع JSON تنتقل المتابعة معه.</p>
    </div>
  );
}
