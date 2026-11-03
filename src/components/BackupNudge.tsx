import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { exportProjectJson } from '../lib/files';

const K_FIRST = 'enna.v1.firstSeen';
const K_BACKUP = 'enna.v1.lastBackup';
const K_SNOOZE = 'enna.v1.backupSnooze';
const DAY = 86_400_000;

const get = (k: string) => {
  try {
    return Number(localStorage.getItem(k) || 0);
  } catch {
    return 0;
  }
};
const set = (k: string, v: number) => {
  try {
    localStorage.setItem(k, String(v));
  } catch {
    /* تجاهل */
  }
};

/** يسجّل إن المستخدم أخذ نسخة احتياطية (من أي مكان في التطبيق) */
export const markBackup = () => set(K_BACKUP, Date.now());

/** هل التطبيق مثبّت على الشاشة الرئيسية؟ (المثبّت ما تنمسح بياناته بعد 7 أيام في Safari) */
const installed = () =>
  (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

/**
 * تذكير لطيف بالنسخة الاحتياطية: المخطط محفوظ في المتصفح بس،
 * وسفاري يمسح بيانات المواقع اللي ما تنزار 7 أيام.
 * يطلع بعد 3 أيام من أول استخدام، إذا فيه تعديلات بعد آخر نسخة، ومو أكثر من مرة كل 3 أيام.
 */
export function BackupNudge() {
  const project = useEditor((s) => s.project);
  const dialog = useEditor((s) => s.dialog);
  const selecting = useEditor((s) => s.selection.length > 0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const now = Date.now();
    if (!get(K_FIRST)) set(K_FIRST, now);
    const first = get(K_FIRST);
    const last = get(K_BACKUP);
    const snooze = get(K_SNOOZE);
    const changed = project.updatedAt > last;
    const elements = project.designs.reduce((n, d) => n + d.plan.elements.length, 0);
    setShow(now - first > 3 * DAY && changed && now > snooze && elements > 0 && !installed());
  }, [project.updatedAt, project.designs]);

  if (!show || dialog !== null || selecting) return null;
  const later = () => {
    set(K_SNOOZE, Date.now() + 3 * DAY);
    setShow(false);
  };
  const save = () => {
    exportProjectJson(project);
    set(K_BACKUP, Date.now());
    setShow(false);
    useEditor.getState().toast('نزلت النسخة الاحتياطية ✓ — احتفظ بالملف، وتقدر تفتحه من «مشاركة وتصدير» ← استيراد ملف', 'success');
  };
  return (
    <div
      className="no-print fixed inset-x-3 z-[44] mx-auto max-w-md rounded-2xl border border-gold-400 bg-white p-3 shadow-2xl sm:left-4 sm:right-auto"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
      role="status"
      data-testid="backup-nudge"
    >
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none">💾</span>
        <div className="flex-1 text-[13px] leading-relaxed text-sand-800">
          <b className="text-dune">خذ نسخة احتياطية من مخططك</b>
          <div>تصاميمك محفوظة في هذا المتصفح بس، والآيفون يمسح بيانات المواقع اللي ما تنفتح أسبوع. احفظها ملف، أو أضف التطبيق للشاشة الرئيسية.</div>
        </div>
        <button type="button" onClick={later} className="rounded p-1 text-sand-600" aria-label="لاحقاً">
          <X size={16} />
        </button>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={later} className="rounded-lg px-3 py-1.5 text-[13px] text-sand-700">لاحقاً</button>
        <button type="button" onClick={save} className="flex items-center gap-1 rounded-lg bg-dune px-3 py-1.5 text-[13px] font-bold text-sand-50" data-testid="backup-save">
          <Download size={14} /> حفظ نسخة
        </button>
      </div>
    </div>
  );
}
