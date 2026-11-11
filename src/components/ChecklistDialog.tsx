import { computePower } from '../lib/power';
import { useMemo, useState } from 'react';
import { ClipboardCheck, MessageCircle, RotateCcw } from 'lucide-react';
import { useActiveDesign, useEditor } from '../store/editorStore';
import { useSummary } from '../hooks/useDerived';
import { buildChecklist, checklistCount } from '../lib/checklist';
import { Button, Modal, cx } from './ui';

const key = (designId: string) => `enna.v1.check.${designId}`;
function load(designId: string): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(key(designId)) || '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}
function save(designId: string, v: Record<string, boolean>) {
  try {
    localStorage.setItem(key(designId), JSON.stringify(v));
  } catch {
    /* تجاهل */
  }
}

/** قائمة التجهيز قبل التركيب — تتشيّك وتنحفظ لكل تصميم */
export function ChecklistDialog() {
  const open = useEditor((s) => s.dialog === 'checklist');
  if (!open) return null;
  return <ChecklistBody />;
}

function ChecklistBody() {
  const openDialog = useEditor((s) => s.openDialog);
  const design = useActiveDesign();
  const s = useSummary();
  const power = useEditor((st) => st.project.power);
  const groups = useMemo(() => buildChecklist(s, computePower(design.plan, power)), [s, design.plan, power]);
  const [done, setDone] = useState<Record<string, boolean>>(() => load(design.id));
  const total = checklistCount(groups);
  const ids = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));
  const checked = Object.keys(done).filter((k) => done[k] && ids.has(k)).length;
  const pct = total ? Math.round((checked / total) * 100) : 0;
  const toggle = (id: string) => {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    save(design.id, next);
  };
  const shareRemaining = () => {
    const lines = groups
      .map((g) => {
        const rest = g.items.filter((i) => !done[i.id]);
        return rest.length ? `${g.icon} ${g.title}\n` + rest.map((i) => `▫️ ${i.text}`).join('\n') : '';
      })
      .filter(Boolean)
      .join('\n\n');
    const text = `قائمة تجهيز العنة — ${design.name}\n(الباقي ${total - checked} من ${total})\n\n${lines}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };
  return (
    <Modal
      open
      onClose={() => openDialog(null)}
      wide
      title={<span className="flex items-center gap-2"><ClipboardCheck size={18} className="text-turf-700" /> قائمة التجهيز — {design.name}</span>}
      footer={
        <>
          <Button
            onClick={() => {
              setDone({});
              save(design.id, {});
            }}
          >
            <RotateCcw size={15} /> تصفير
          </Button>
          <Button onClick={shareRemaining} data-testid="checklist-share">
            <MessageCircle size={15} /> أرسل الباقي واتساب
          </Button>
          <Button variant="primary" onClick={() => openDialog(null)}>تم</Button>
        </>
      }
    >
      <div className="space-y-4 p-5" data-testid="checklist">
        <div>
          <div className="mb-1 flex justify-between text-[13px] text-sand-700">
            <span>جهّزت <b data-testid="checklist-done">{checked}</b> من <b>{total}</b></span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-sand-200">
            <div className="h-full rounded-full bg-turf-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-sand-600">مستخرجة من مخططك تلقائياً — أي تعديل في المخطط ينعكس هنا.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.title} className="rounded-xl border border-sand-200 bg-white p-3">
              <h3 className="mb-1.5 font-bold text-dune">{g.icon} {g.title}</h3>
              <ul className="space-y-1">
                {g.items.map((i) => (
                  <li key={i.id}>
                    <label className={cx('flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1.5 text-[13px] hover:bg-sand-50', done[i.id] && 'text-sand-500 line-through')}>
                      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#3f7d2c]" checked={!!done[i.id]} onChange={() => toggle(i.id)} data-testid="check-item" />
                      <span>
                        {i.text}
                        {i.hint && <span className="block text-[11px] text-sand-600 no-underline">{i.hint}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
