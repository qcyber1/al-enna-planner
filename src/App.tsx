import { Suspense, lazy, useEffect, useState } from 'react';
import { PanelRight, PanelLeft, X } from 'lucide-react';
import { TopBar } from './components/TopBar';
import { Library } from './components/Library';
import { PropertiesPanel } from './components/PropertiesPanel';
import { DesignsDialog, HelpDialog, LandDialog, ProjectsDialog, ShareDialog, SharedLinkDialog, SummaryDialog, WelcomeDialog } from './components/Dialogs';
import { Toasts } from './components/Toasts';
import { GeneratorDialog } from './components/GeneratorDialog';
import { InviteDialog } from './components/InviteDialog';
import Editor2D from './editor2d/Editor2D';
import { startAutosave, useEditor } from './store/editorStore';
import { useMediaQuery } from './hooks/useDerived';
import { useShortcuts } from './hooks/useShortcuts';
import { clearShareHash, readShareFromHash } from './lib/share';
import { storageAvailable } from './lib/storage';
import { cx } from './components/ui';

const Scene3D = lazy(() => import('./scene3d/Scene3D'));

function Loading3D() {
  return <div className="flex h-full items-center justify-center bg-[#cfd9e3] text-sand-800">جاري تحميل العرض ثلاثي الأبعاد…</div>;
}

export default function App() {
  const view = useEditor((s) => s.view);
  const selection = useEditor((s) => s.selection);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isPhone = !useMediaQuery('(min-width: 640px)');
  const [libOpen, setLibOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  useShortcuts();

  useEffect(() => startAutosave(), []);
  useEffect(() => {
    const st = useEditor.getState();
    if (!storageAvailable()) st.toast('التخزين المحلي غير متاح في هذا المتصفح — صدّر المشروع كملف للحفظ', 'warning');
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
    if (!isDesktop && selection.length) setPropsOpen(true);
  }, [selection, isDesktop]);

  const effectiveView = view === 'split' && !isDesktop ? '2d' : view;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar compact={isPhone} />
      <div className="relative flex min-h-0 flex-1">
        {/* مكتبة العناصر (يمين في الواجهة العربية) */}
        {isDesktop ? (
          <aside className="no-print w-64 shrink-0 border-l border-sand-200 bg-sand-50">
            <Library />
          </aside>
        ) : (
          libOpen && (
            <aside className="no-print absolute inset-y-0 right-0 z-20 w-72 max-w-[85%] border-l border-sand-200 bg-sand-50 shadow-2xl">
              <button type="button" className="absolute top-2 left-2 z-10 rounded p-1 text-sand-700" onClick={() => setLibOpen(false)} aria-label="إغلاق"><X size={18} /></button>
              <Library onPicked={() => setLibOpen(false)} />
            </aside>
          )
        )}

        <main className="relative flex min-w-0 flex-1">
          {(effectiveView === '2d' || effectiveView === 'split') && (
            <div className={cx('relative h-full min-w-0', effectiveView === 'split' ? 'w-1/2 border-l border-sand-300' : 'w-full')}>
              <Editor2D />
            </div>
          )}
          {(effectiveView === '3d' || effectiveView === 'split') && (
            <div className={cx('relative h-full min-w-0', effectiveView === 'split' ? 'w-1/2' : 'w-full')}>
              <Suspense fallback={<Loading3D />}>
                <Scene3D />
              </Suspense>
            </div>
          )}
          {!isDesktop && (
            <div className="no-print absolute bottom-3 right-3 z-10 flex flex-col gap-2">
              <button type="button" onClick={() => setLibOpen(true)} className="flex items-center gap-1 rounded-full bg-dune px-3 py-2 text-sm text-sand-50 shadow-lg">
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
      <WelcomeDialog />
      <LandDialog />
      <SummaryDialog />
      <DesignsDialog />
      <ShareDialog />
      <ProjectsDialog />
      <SharedLinkDialog />
      <HelpDialog />
      <GeneratorDialog />
      <InviteDialog />
      <Toasts />
    </div>
  );
}
