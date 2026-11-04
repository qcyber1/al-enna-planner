import { Wand2 } from 'lucide-react';
import { getPlan, useEditor } from '../store/editorStore';
import { fixAll, fixIssue } from '../lib/autofix';
import type { Issue } from '../lib/validation';
import { cx } from './ui';

const m1 = (n: number) => (Math.round(n * 10) / 10).toString();

export function runFix(issue: Issue) {
  const st = useEditor.getState();
  const f = fixIssue(getPlan(), issue, 25, st.selection.length === 1 ? st.selection[0] : undefined);
  if (!f) {
    st.toast('ما لقينا مكان أنسب قريب — حرّكه بيدك أو صغّره', 'warning');
    return;
  }
  st.updateElements({ [f.id]: f.patch });
  st.select([f.id]);
  st.toast(`انصلحت ✓ نقلنا «${f.name}» ${m1(f.moved)} م — إذا ما عجبك اضغط تراجع ↶ أو حرّكه بيدك`, 'success');
}

export function runFixAll() {
  const st = useEditor.getState();
  const before = getPlan();
  const r = fixAll(before);
  if (!r.fixed) {
    st.toast('ما قدرنا نصلح شي تلقائياً — حرّك العناصر بيدك', 'warning');
    return;
  }
  const patches: Record<string, Partial<(typeof before.elements)[number]>> = {};
  for (const e of r.plan.elements) {
    const o = before.elements.find((x) => x.id === e.id);
    if (o && (o.x !== e.x || o.y !== e.y || o.points !== e.points)) patches[e.id] = e.points ? { points: e.points } : { x: e.x, y: e.y };
  }
  st.updateElements(patches);
  st.toast(`صلّحنا ${r.fixed}${r.left ? ` — باقي ${r.left} تحتاج تعديل بيدك` : ' ✓ كل شي تمام'}. ما عجبك؟ اضغط تراجع ↶`, r.left ? 'info' : 'success');
}

export function FixButton({ issue, className }: { issue: Issue; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        runFix(issue);
      }}
      className={cx('inline-flex shrink-0 items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-bold text-dune shadow-sm ring-1 ring-sand-300 hover:bg-sand-50 active:scale-95', className)}
      data-testid="fix-issue"
    >
      <Wand2 size={12} /> أصلحها
    </button>
  );
}
