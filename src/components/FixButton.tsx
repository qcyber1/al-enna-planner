import { Wand2 } from 'lucide-react';
import { getPlan, useEditor } from '../store/editorStore';
import { fixAll, fixIssue } from '../lib/autofix';
import type { Issue } from '../lib/validation';
import { cx } from './ui';

const m1 = (n: number) => (Math.round(n * 10) / 10).toString();
type El = ReturnType<typeof getPlan>['elements'][number];

/** يحفظ القيم الأصلية للحقول اللي تغيّرت عشان «رجّعه» يرجعها بالضبط */
function snapshot(patches: Record<string, Partial<El>>): Record<string, Partial<El>> {
  const plan = getPlan();
  const out: Record<string, Partial<El>> = {};
  for (const [id, p] of Object.entries(patches)) {
    const el = plan.elements.find((e) => e.id === id);
    if (!el) continue;
    const o: Partial<El> = {};
    for (const k of Object.keys(p) as (keyof El)[]) (o as Record<string, unknown>)[k] = el[k];
    out[id] = o;
  }
  return out;
}
const undoAction = (orig: Record<string, Partial<El>>) => ({
  label: '↶ رجّعه',
  run: () => {
    useEditor.getState().updateElements(orig);
    useEditor.getState().toast('رجّعناه مثل ما كان', 'info');
  },
});

export function runFix(issue: Issue) {
  const st = useEditor.getState();
  const f = fixIssue(getPlan(), issue, 25, st.selection.length === 1 ? st.selection[0] : undefined);
  if (!f) {
    st.toast('ما لقينا مكان أنسب قريب — حرّكه بيدك أو صغّره', 'warning');
    return;
  }
  const orig = snapshot({ [f.id]: f.patch });
  st.updateElements({ [f.id]: f.patch });
  st.select([f.id]);
  const how = f.patch.rotation !== undefined ? (f.moved > 0.01 ? `دوّرنا «${f.name}» ونقلناه ${m1(f.moved)} م` : `دوّرنا «${f.name}» 90°`) : `نقلنا «${f.name}» ${m1(f.moved)} م`;
  st.toast(`انصلحت ✓ ${how}. ما عجبك؟ رجّعه أو حرّكه بيدك`, 'success', undoAction(orig));
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
    if (o && (o.x !== e.x || o.y !== e.y || o.points !== e.points || o.rotation !== e.rotation)) patches[e.id] = e.points ? { points: e.points } : { x: e.x, y: e.y, rotation: e.rotation };
  }
  const orig = snapshot(patches);
  st.updateElements(patches);
  st.toast(`صلّحنا ${r.fixed}${r.left ? ` — باقي ${r.left} تحتاج تعديل بيدك` : ' ✓ كل شي تمام'}. ما عجبك؟ رجّعه`, r.left ? 'info' : 'success', undoAction(orig));
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
