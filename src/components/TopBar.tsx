import { useState } from 'react';
import {
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
  Loader2,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { IconButton, Segmented, cx } from './ui';
import type { TimeOfDay, ViewMode } from '../types/plan';

export function TopBar({ compact }: { compact: boolean }) {
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
  const saveState = useEditor((s) => s.saveState);
  const saveError = useEditor((s) => s.saveError);
  const switchDesign = useEditor((s) => s.switchDesign);
  const [menu, setMenu] = useState(false);
  const active = project.designs.find((d) => d.id === project.activeDesignId);

  const viewOpts: { value: ViewMode; label: string }[] = compact
    ? [
        { value: '2d', label: '2D' },
        { value: '3d', label: '3D' },
      ]
    : [
        { value: '2d', label: 'مخطط 2D' },
        { value: '3d', label: 'مجسم 3D' },
        { value: 'split', label: 'مقسوم' },
      ];
  const timeOpts: { value: TimeOfDay; label: React.ReactNode; title: string }[] = [
    { value: 'day', label: <Sun size={15} />, title: 'نهار' },
    { value: 'sunset', label: <Sunset size={15} />, title: 'غروب' },
    { value: 'night', label: <Moon size={15} />, title: 'ليل' },
  ];

  return (
    <header className="no-print relative z-30 flex h-14 shrink-0 items-center gap-2 bg-dune px-2 text-sand-50 shadow-md sm:px-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-500 text-lg">⛺</div>
        {!compact && (
          <div className="leading-tight">
            <div className="text-[15px] font-bold">مخطط العنة</div>
            <div className="text-[10px] text-sand-300">Al Enna Planner</div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => openDialog('projects')}
        className="hidden max-w-40 items-center gap-1 truncate rounded-lg px-2 py-1 text-sm hover:bg-white/10 md:flex"
        title="المشاريع"
      >
        <FolderOpen size={15} className="shrink-0 text-gold-400" />
        <span className="truncate">{project.name}</span>
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          className="flex max-w-44 items-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-sm hover:bg-white/15"
          data-testid="design-menu"
        >
          <Layers size={15} className="shrink-0 text-gold-400" />
          <span className="truncate">{active?.name}</span>
          {project.finalDesignId === active?.id && <span className="text-gold-400">★</span>}
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
            <div className="absolute top-11 right-0 z-50 w-64 overflow-hidden rounded-xl border border-sand-200 bg-white text-sand-900 shadow-xl">
              <div className="max-h-72 overflow-y-auto py-1">
                {project.designs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      switchDesign(d.id);
                      setMenu(false);
                    }}
                    className={cx('flex w-full items-center justify-between px-3 py-2 text-right text-sm hover:bg-sand-100', d.id === project.activeDesignId && 'bg-sand-100 font-bold')}
                  >
                    <span className="truncate">{d.name}</span>
                    <span className="flex items-center gap-1 text-xs text-sand-600">
                      {project.finalDesignId === d.id && <span className="text-gold-600">★ نهائي</span>}
                      {d.id === project.activeDesignId && <Check size={14} />}
                    </span>
                  </button>
                ))}
              </div>
              <div className="border-t border-sand-200 p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    openDialog('designs');
                  }}
                  className="w-full rounded-lg px-3 py-2 text-right text-sm font-semibold text-dune hover:bg-sand-100"
                >
                  إدارة التصاميم والبدائل…
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mx-auto flex items-center gap-2">
        <Segmented tone="dark" value={view} onChange={setView} options={viewOpts} />
        <Segmented tone="dark" value={time} onChange={setTime} options={timeOpts} />
        {!compact && (
          <IconButton tone="dark" label={lights ? 'إطفاء كل الإنارة' : 'تشغيل كل الإنارة'} active={lights} onClick={() => setLights(!lights)}>
            {lights ? <Lightbulb size={17} /> : <LightbulbOff size={17} />}
          </IconButton>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <IconButton tone="dark" label="تراجع (Ctrl+Z)" disabled={!canUndo} onClick={undo} data-testid="undo">
          <Undo2 size={17} />
        </IconButton>
        <IconButton tone="dark" label="إعادة (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo} className="hidden sm:inline-flex">
          <Redo2 size={17} />
        </IconButton>
        <span
          className="hidden items-center gap-1 px-1.5 text-[11px] text-sand-300 lg:flex"
          title={saveError ?? 'يحفظ تلقائياً في المتصفح'}
          data-testid="save-state"
        >
          {saveState === 'saved' && (
            <>
              <Check size={13} className="text-turf-400" /> محفوظ
            </>
          )}
          {saveState === 'pending' && (
            <>
              <Loader2 size={13} className="animate-spin" /> يحفظ…
            </>
          )}
          {saveState === 'error' && (
            <>
              <AlertCircle size={13} className="text-red-400" /> فشل الحفظ
            </>
          )}
        </span>
        {!compact && (
          <>
            <IconButton tone="dark" label="إعدادات الأرض" onClick={() => openDialog('land')} data-testid="open-land">
              <Map size={17} />
            </IconButton>
            <IconButton tone="dark" label="القياسات وحصر الكميات" onClick={() => openDialog('summary')} data-testid="open-summary">
              <Calculator size={17} />
            </IconButton>
            <IconButton tone="dark" label="مقارنة التصاميم" onClick={() => openDialog('compare')}>
              <Columns2 size={17} />
            </IconButton>
            <IconButton tone="dark" label="المساعدة والاختصارات" onClick={() => openDialog('help')}>
              <HelpCircle size={17} />
            </IconButton>
          </>
        )}
        <button
          type="button"
          onClick={() => openDialog('generator')}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-sm font-semibold text-gold-300 hover:bg-white/15"
          data-testid="open-generator"
          title="مولّد التصاميم"
        >
          <Sparkles size={16} /> {!compact && 'ولّد تصاميم'}
        </button>
        <button
          type="button"
          onClick={() => openDialog('share')}
          className="mr-1 flex h-9 items-center gap-1.5 rounded-lg bg-gold-500 px-3 text-sm font-semibold text-dune hover:bg-gold-400"
          data-testid="open-share"
        >
          <Share2 size={16} /> {!compact && 'مشاركة وتصدير'}
        </button>
      </div>
    </header>
  );
}
