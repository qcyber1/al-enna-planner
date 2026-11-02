import { useState } from 'react';
import {
  Menu,
  Undo2,
  Redo2,
  Sun,
  Sunset,
  Moon,
  Lightbulb,
  LightbulbOff,
  Calculator,
  Columns2,
  Share2,
  Map,
  FolderOpen,
  Layers,
  Check,
  HelpCircle,
  Sparkles,
  Gift,
  X,
} from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { Segmented, cx } from './ui';
import type { DialogName } from '../store/editorStore';

function hasLicense(): boolean {
  try {
    const t = localStorage.getItem('enna.license.token');
    return !!t && t !== 'open';
  } catch {
    return false;
  }
}

/** شريط علوي مبسّط للجوال: الأساسيات ظاهرة والباقي في قائمة */
export function MobileTopBar() {
  const project = useEditor((s) => s.project);
  const view = useEditor((s) => s.view);
  const setView = useEditor((s) => s.setView);
  const time = useEditor((s) => s.time);
  const setTime = useEditor((s) => s.setTime);
  const lights = useEditor((s) => s.lightsMaster);
  const setLights = useEditor((s) => s.setLightsMaster);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const openDialog = useEditor((s) => s.openDialog);
  const switchDesign = useEditor((s) => s.switchDesign);
  const [menu, setMenu] = useState(false);
  const [designs, setDesigns] = useState(false);
  const active = project.designs.find((d) => d.id === project.activeDesignId);

  const go = (d: DialogName) => {
    setMenu(false);
    openDialog(d);
  };
  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-[15px] font-semibold text-dune active:bg-sand-200';

  return (
    <header className="no-print relative z-30 shrink-0 bg-dune text-sand-50 shadow-md" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex h-14 items-center gap-1.5 px-2">
        <button type="button" onClick={() => setMenu(true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10" aria-label="القائمة" data-testid="mobile-menu">
          <Menu size={21} />
        </button>
        <button
          type="button"
          onClick={() => setDesigns(true)}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-xl bg-white/10 px-2.5 py-2 text-[13px]"
          data-testid="design-menu"
        >
          <Layers size={15} className="shrink-0 text-gold-400" />
          <span className="truncate">{active?.name}</span>
        </button>
        <Segmented tone="dark" value={view === 'split' ? '2d' : view} onChange={setView} options={[{ value: '2d', label: '2D' }, { value: '3d', label: '3D' }]} />
        <button type="button" onClick={undo} disabled={!canUndo} className="flex h-10 w-9 shrink-0 items-center justify-center rounded-xl disabled:opacity-30" aria-label="تراجع" data-testid="undo">
          <Undo2 size={19} />
        </button>
        <button type="button" onClick={() => openDialog('share')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-dune" aria-label="مشاركة وتصدير" data-testid="open-share">
          <Share2 size={18} />
        </button>
      </div>

      {menu && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setMenu(false)}>
          <div className="absolute inset-0 bg-dune/50" />
          <div
            className="relative mr-0 ml-auto h-full w-[86%] max-w-sm overflow-y-auto bg-sand-50 p-3 shadow-2xl"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
            onClick={(e) => e.stopPropagation()}
            data-testid="mobile-menu-sheet"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500 text-lg">⛺</div>
                <div>
                  <div className="font-bold text-dune">مخطط العنة</div>
                  <div className="text-[11px] text-sand-600">{project.name}</div>
                </div>
              </div>
              <button type="button" onClick={() => setMenu(false)} className="rounded-lg p-2 text-sand-700" aria-label="إغلاق">
                <X size={20} />
              </button>
            </div>
            <div className="mb-3 space-y-2 rounded-2xl bg-white p-3">
              <div className="text-[12px] font-semibold text-sand-600">الوقت في المجسم</div>
              <Segmented
                value={time}
                onChange={setTime}
                options={[
                  { value: 'day', label: <span className="flex items-center gap-1"><Sun size={15} /> نهار</span> },
                  { value: 'sunset', label: <span className="flex items-center gap-1"><Sunset size={15} /> غروب</span> },
                  { value: 'night', label: <span className="flex items-center gap-1"><Moon size={15} /> ليل</span> },
                ]}
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setLights(!lights)} className={cx('flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold', lights ? 'bg-gold-500 text-dune' : 'bg-sand-200 text-sand-800')}>
                  {lights ? <Lightbulb size={16} /> : <LightbulbOff size={16} />} {lights ? 'الإنارة شغّالة' : 'الإنارة طافية'}
                </button>
                <button type="button" onClick={redo} disabled={!canRedo} className="flex items-center gap-1 rounded-xl bg-sand-200 px-3 py-2 text-sm font-semibold disabled:opacity-40">
                  <Redo2 size={16} /> إعادة
                </button>
              </div>
            </div>
            <div className="space-y-0.5">
              <button type="button" className={cx(item, 'bg-gold-500/15')} onClick={() => go('generator')} data-testid="open-generator">
                <Sparkles size={19} className="text-gold-600" /> ولّد لي تصاميم (5 أفكار)
              </button>
              {hasLicense() && (
                <button type="button" className={item} onClick={() => go('invite')} data-testid="open-invite">
                  <Gift size={19} className="text-gold-600" /> ادعُ أصحابك (خصم ومكافأة)
                </button>
              )}
              <button type="button" className={item} onClick={() => go('share')}>
                <Share2 size={19} /> مشاركة وتصدير الصور
              </button>
              <button type="button" className={item} onClick={() => go('summary')} data-testid="open-summary">
                <Calculator size={19} /> القياسات والكميات والتكلفة
              </button>
              <button type="button" className={item} onClick={() => go('compare')}>
                <Columns2 size={19} /> مقارنة التصاميم
              </button>
              <button type="button" className={item} onClick={() => go('land')} data-testid="open-land">
                <Map size={19} /> الأرض والمدخل وما حولها
              </button>
              <button type="button" className={item} onClick={() => go('projects')}>
                <FolderOpen size={19} /> المشاريع
              </button>
              <button type="button" className={item} onClick={() => go('help')}>
                <HelpCircle size={19} /> المساعدة
              </button>
            </div>
          </div>
        </div>
      )}

      {designs && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setDesigns(false)}>
          <div className="absolute inset-0 bg-dune/50" />
          <div className="relative w-full rounded-t-2xl bg-sand-50 p-3 text-dune shadow-2xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 font-bold">التصاميم</div>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {project.designs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    switchDesign(d.id);
                    setDesigns(false);
                  }}
                  className={cx('flex w-full items-center justify-between rounded-xl px-3 py-3 text-right', d.id === project.activeDesignId ? 'bg-white font-bold' : 'active:bg-sand-200')}
                >
                  <span className="truncate">
                    {d.name} {project.finalDesignId === d.id && <span className="text-gold-600">★</span>}
                  </span>
                  {d.id === project.activeDesignId && <Check size={16} />}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { setDesigns(false); openDialog('designs'); }} className="mt-2 w-full rounded-xl bg-dune py-3 font-semibold text-sand-50">
              إدارة ومقارنة التصاميم
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
