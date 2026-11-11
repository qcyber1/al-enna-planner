import { Suspense, lazy, useEffect, useState } from 'react';
import { UpgradeIzbaDialog } from './components/UpgradeIzba';
import { PanelRight, PanelLeft, X } from 'lucide-react';
import { TopBar } from './components/TopBar';
import { MobileTopBar } from './components/MobileTopBar';
import { Library } from './components/Library';
import { PropertiesPanel } from './components/PropertiesPanel';
import { DesignsDialog, HelpDialog, LandDialog, ProjectsDialog, ShareDialog, SharedLinkDialog, SummaryDialog, WelcomeDialog } from './components/Dialogs';
import { Toasts } from './components/Toasts';
import { GeneratorDialog } from './components/GeneratorDialog';
import { InviteDialog } from './components/InviteDialog';
import { FeedbackDialog } from './components/FeedbackDialog';
import { Tour } from './components/Tour';
import { BackupNudge } from './components/BackupNudge';
import { ChecklistDialog } from './components/ChecklistDialog';
import { PowerDialog } from './components/PowerDialog';
import { IzbaHubDialog } from './components/IzbaHubDialog';
import { BottomSheet } from './components/BottomSheet';
import Editor2D from './editor2d/Editor2D';
import { startAutosave, useEditor } from './store/editorStore';
import { useMediaQuery } from './hooks/useDerived';
import { useShortcuts } from './hooks/useShortcuts';
import { clearShareHash, readShareFromHash } from './lib/share';
import { storageAvailable } from './lib/storage';
import { cx } from './components/ui';
import { ErrorBoundary, isChunkError, reloadOnce } from './components/ErrorBoundary';

const loadScene3D = () => import('./scene3d/Scene3D');

// ملف ناقص بعد نشر نسخة جديدة (الصفحة كانت مفتوحة من قبل): Vite يبلغنا ← نحدّث مرة وحدة
if (typeof window !== 'undefined') window.addEventListener('vite:preloadError', () => void reloadOnce());

/** بدل الشاشة البيضاء: رسالة واضحة والمخطط 2D يظل شغال */
function Error3D({ error, reset }: { error: Error; reset: () => void }) {
  const setView = useEditor((s) => s.setView);
  const chunk = isChunkError(error);
  return (
    <div className="flex h-full items-center justify-center bg-sand-50 p-6" data-testid="error-3d">
      <div className="max-w-sm space-y-3 rounded-2xl bg-white p-5 text-center shadow">
        <div className="text-3xl">🧊</div>
        <div className="font-bold text-dune">{chunk ? 'في نسخة جديدة من الموقع' : 'ما قدرنا نعرض المجسم 3D'}</div>
        <p className="text-sm text-sand-700">{chunk ? 'حدّث الصفحة عشان يشتغل المجسم — تصميمك محفوظ.' : 'تصميمك محفوظ وما تأثر. جرّب تحدّث الصفحة، أو كمّل على المخطط 2D.'}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-gold-500 px-4 py-2 font-bold text-dune">
            حدّث الصفحة
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setView('2d');
            }}
            className="rounded-lg border border-sand-300 px-4 py-2 font-semibold text-dune"
          >
            ارجع للمخطط 2D
          </button>
        </div>
        {!chunk && <p className="select-all break-all text-[10px] text-sand-500" dir="ltr">{String(error.message).slice(0, 200)}</p>}
      </div>
    </div>
  );
}
const Scene3D = lazy(loadScene3D);

// تحميل الـ3D بهدوء بعد ما تستقر الصفحة (أول فتح صار أسرع، والتبديل لـ3D يظل فوري)
if (typeof window !== 'undefined') {
  const warm = () => void loadScene3D().catch(() => {});
  window.addEventListener('load', () => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (ric) ric(warm, { timeout: 6000 });
    else setTimeout(warm, 3000);
  });
}

function Loading3D() {
  return <div className="flex h-full items-center justify-center bg-[#cfd9e3] text-sand-800">جاري تحميل العرض ثلاثي الأبعاد…</div>;
}

export default function App() {
  const view = useEditor((s) => s.view);
  const selection = useEditor((s) => s.selection);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isPhone = !useMediaQuery('(min-width: 640px)');
  const isNarrow = !useMediaQuery('(min-width: 1200px)');
  const [libOpen, setLibOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  useShortcuts();

  useEffect(() => startAutosave(), []);
  useEffect(() => {
    const st = useEditor.getState();
    if (!storageAvailable()) st.toast('المتصفح ما يسمح بالحفظ (يمكن التصفح الخفي) — صدّر المشروع كملف عشان ما يضيع', 'warning');
    try {
      const shared = readShareFromHash();
      if (shared) {
        st.setPendingShared(shared);
        if (st.dialog === 'welcome') st.openDialog(null);
      }
    } catch (e) {
      st.toast(e instanceof Error ? e.message : 'رابط المشاركة غير صالح', 'error');
    }
    clearShareHash();
  }, []);
  useEffect(() => {
    // في الجوال لا نفتح الخصائص تلقائياً — الشريط السريع يظهر وزر «تعديل» يفتحها
    const open = () => setPropsOpen(true);
    window.addEventListener('enna-open-props', open);
    return () => window.removeEventListener('enna-open-props', open);
  }, []);
  useEffect(() => {
    if (!selection.length) setPropsOpen(false);
  }, [selection.length]);

  const effectiveView = view === 'split' && !isDesktop ? '2d' : view;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {isNarrow ? <MobileTopBar /> : <TopBar compact={isPhone} />}
      <div className="relative flex min-h-0 flex-1">
        {/* مكتبة العناصر (يمين في الواجهة العربية) */}
        {isDesktop ? (
          <aside className="no-print w-64 shrink-0 border-l border-sand-200 bg-sand-50" data-tour="library">
            <Library />
          </aside>
        ) : isPhone ? (
          libOpen && (
            <BottomSheet title="مكتبة عناصر العنة" onClose={() => setLibOpen(false)} testId="library-sheet">
              <Library sheet onPicked={() => setLibOpen(false)} />
            </BottomSheet>
          )
        ) : (
          libOpen && (
            <aside className="no-print absolute inset-y-0 right-0 z-20 w-72 max-w-[85%] border-l border-sand-200 bg-sand-50 shadow-2xl">
              <button type="button" className="absolute top-2 left-2 z-10 rounded p-1 text-sand-700" onClick={() => setLibOpen(false)} aria-label="إغلاق"><X size={18} /></button>
              <Library onPicked={() => setLibOpen(false)} />
            </aside>
          )
        )}

        <main className="relative flex min-w-0 flex-1" data-tour="canvas">
          {(effectiveView === '2d' || effectiveView === 'split') && (
            <div className={cx('relative h-full min-w-0', effectiveView === 'split' ? 'w-1/2 border-l border-sand-300' : 'w-full')}>
              <Editor2D />
            </div>
          )}
          {(effectiveView === '3d' || effectiveView === 'split') && (
            <div className={cx('relative h-full min-w-0', effectiveView === 'split' ? 'w-1/2' : 'w-full')}>
              <ErrorBoundary
                onError={(e) => {
                  // ملف ناقص بعد تحديث الموقع: نحدّث الصفحة مرة وحدة وتنحل
                  if (isChunkError(e)) reloadOnce();
                }}
                fallback={(e, reset) => <Error3D error={e} reset={reset} />}
              >
                <Suspense fallback={<Loading3D />}>
                  <Scene3D />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}
          {!isDesktop && (
            <div className="no-print absolute right-3 z-10 flex gap-2" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
              <button type="button" onClick={() => setLibOpen(true)} className="flex items-center gap-1 rounded-full bg-dune px-3 py-2 text-sm text-sand-50 shadow-lg" data-testid="open-library" data-tour="library">
                <PanelRight size={16} /> العناصر
              </button>
              <button type="button" onClick={() => setPropsOpen(true)} className="flex items-center gap-1 rounded-full bg-white px-3 py-2 text-sm text-dune shadow-lg">
                <PanelLeft size={16} /> الخصائص
              </button>
            </div>
          )}
        </main>

        {/* لوحة الخصائص (يسار) */}
        {isDesktop ? (
          <aside className="no-print scroll-thin w-80 shrink-0 overflow-y-auto border-r border-sand-200 bg-sand-50" data-testid="properties">
            <PropertiesPanel />
          </aside>
        ) : (
          propsOpen && (
            <aside className="no-print scroll-thin absolute inset-x-0 bottom-0 z-20 max-h-[62%] overflow-y-auto rounded-t-2xl border-t border-sand-200 bg-sand-50 shadow-2xl sm:inset-x-auto sm:inset-y-0 sm:left-0 sm:max-h-none sm:w-80 sm:rounded-none">
              <div className="sticky top-0 z-10 flex justify-between bg-sand-50/95 px-3 py-2">
                <span className="text-sm font-bold text-dune">الخصائص</span>
                <button type="button" onClick={() => setPropsOpen(false)} aria-label="إغلاق"><X size={18} /></button>
              </div>
              <PropertiesPanel />
            </aside>
          )
        )}
      </div>
      <Tour />
      <BackupNudge />
      <ChecklistDialog />
      <PowerDialog />
      <IzbaHubDialog />
      <WelcomeDialog />
      <LandDialog />
      <SummaryDialog />
      <DesignsDialog />
      <ShareDialog />
      <ProjectsDialog />
      <SharedLinkDialog />
      <HelpDialog />
      <GeneratorDialog />
      <UpgradeIzbaDialog />
      <InviteDialog />
      <FeedbackDialog />
      <Toasts />
    </div>
  );
}
