import type { MutableRefObject } from 'react';
import { Camera, Sparkles, Eye, Footprints, DoorOpen, Tent, Plane, Box, ArrowUp, ArrowDown, RotateCcw, RotateCw, X } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { startPhoto, usePhoto } from './PhotoRender';
import { izbaEnabled } from '../lib/izba';

const BETA = izbaEnabled();
import type { CameraPreset } from '../types/plan';
import { IconButton, Segmented } from '../components/ui';
import { HOUR_MAX, HOUR_MIN, SUNSET, formatHour } from '../lib/sunclock';

const shortHour = (h: number) => formatHour(h).replace(':00', '');

const PRESETS: { id: CameraPreset; label: string; icon: typeof Eye }[] = [
  { id: 'top', label: 'منظر علوي', icon: Plane },
  { id: 'oblique', label: 'منظر مائل', icon: Box },
  { id: 'human', label: 'مستوى الإنسان', icon: Eye },
  { id: 'entrance', label: 'من جهة المدخل', icon: DoorOpen },
  { id: 'main-tent', label: 'الخيمة الرئيسية', icon: Tent },
  { id: 'walk', label: 'وضع التجول', icon: Footprints },
];

export function Camera3DOverlay({ move }: { move: MutableRefObject<{ f: number; s: number; turn: number }> }) {
  const preset = useEditor((s) => s.camera.preset);
  const setCamera = useEditor((s) => s.setCamera);
  const quality = useEditor((s) => s.lightQuality);
  const setQuality = useEditor((s) => s.setLightQuality);
  const time = useEditor((s) => s.time);
  const hour = useEditor((s) => s.hour);
  const setHour = useEditor((s) => s.setHour);
  const capture = useEditor((s) => s.requestCapture3d);
  const walking = preset === 'walk';
  const photoBusy = usePhoto((s) => s.status !== 'idle');
  const hold = (k: 'f' | 's' | 'turn', v: number) => ({
    onPointerDown: () => (move.current[k] = v),
    onPointerUp: () => (move.current[k] = 0),
    onPointerLeave: () => (move.current[k] = 0),
  });
  return (
    <div data-overlay className="pointer-events-none absolute inset-0" dir="rtl">
      <div className="pointer-events-auto absolute top-2 right-2 left-2 flex flex-wrap items-center gap-1 rounded-xl border border-sand-300/80 bg-white/95 p-1 shadow-md sm:left-auto">
        {PRESETS.map((p) => (
          <IconButton key={p.id} label={p.label} active={preset === p.id} onClick={() => setCamera(p.id)} data-testid={`cam-${p.id}`}>
            <p.icon size={17} />
            <span className="hidden text-xs lg:inline">{p.label}</span>
          </IconButton>
        ))}
        <span className="mx-1 h-6 w-px bg-sand-300" />
        <IconButton label="حفظ لقطة 3D لهذا التصميم (للمقارنة)" onClick={() => capture('thumb')}>
          <Camera size={17} />
        </IconButton>
      </div>
      {BETA && !walking && !photoBusy && (
        <button
          type="button"
          onClick={startPhoto}
          title="رندر واقعي: صورة كأنها مصوّرة (محاكاة حقيقية للضوء)"
          data-testid="photo-render"
          className="pointer-events-auto absolute bottom-3 left-3 flex h-11 items-center gap-1.5 rounded-xl bg-gradient-to-l from-gold-500 to-gold-600 px-4 text-sm font-bold text-white shadow-lg hover:brightness-105"
        >
          <Sparkles size={17} /> رندر واقعي
        </button>
      )}
      {!walking && (
        <div className="pointer-events-auto absolute top-[3.6rem] right-2 w-52 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs shadow" data-testid="hour-slider">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sand-700">{time === 'day' ? '☀️' : time === 'sunset' ? '🌇' : '🌙'} الساعة</span>
            <b className="tabular-nums text-dune" data-testid="hour-label">{formatHour(hour)}</b>
          </div>
          <input
            type="range"
            className="mt-1 w-full accent-[#c9973f]"
            min={HOUR_MIN}
            max={HOUR_MAX}
            step={0.25}
            value={hour}
            onChange={(e) => setHour(parseFloat(e.target.value))}
            aria-label="الساعة"
            dir="ltr"
          />
          <div className="flex justify-between whitespace-nowrap text-[10px] text-sand-600" dir="ltr">
            <span dir="rtl">{shortHour(HOUR_MIN)}</span>
            <span dir="rtl">المغرب {shortHour(SUNSET)}</span>
            <span dir="rtl">{shortHour(HOUR_MAX)}</span>
          </div>
        </div>
      )}
      {time !== 'day' && (
        <div className="pointer-events-auto absolute top-[8.6rem] left-2 rounded-lg bg-white/95 p-1.5 text-xs shadow sm:top-16">
          <div className="mb-1 px-1 text-sand-700">جودة الإنارة</div>
          <Segmented size="sm" value={quality} onChange={setQuality} options={[{ value: 'low', label: 'منخفضة' }, { value: 'medium', label: 'متوسطة' }, { value: 'high', label: 'عالية' }]} />
        </div>
      )}
      {walking && (
        <>
          <div className="pointer-events-auto absolute bottom-4 right-1/2 flex translate-x-1/2 flex-col items-center gap-2">
            <button id="walk-start" type="button" className="hidden rounded-full bg-dune px-4 py-2 text-sm text-sand-50 shadow-lg sm:block">
              انقر هنا للتحكم بالماوس • W A S D للمشي • Shift للجري • Esc للخروج
            </button>
            <div className="flex gap-2">
              <button type="button" className="rounded-full bg-white/95 p-3 shadow" {...hold('turn', 1)} aria-label="استدارة يسار"><RotateCcw size={20} /></button>
              <button type="button" className="rounded-full bg-white/95 p-3 shadow" {...hold('f', 1)} aria-label="للأمام"><ArrowUp size={20} /></button>
              <button type="button" className="rounded-full bg-white/95 p-3 shadow" {...hold('f', -1)} aria-label="للخلف"><ArrowDown size={20} /></button>
              <button type="button" className="rounded-full bg-white/95 p-3 shadow" {...hold('turn', -1)} aria-label="استدارة يمين"><RotateCw size={20} /></button>
              <button type="button" className="rounded-full bg-red-700 p-3 text-white shadow" onClick={() => setCamera('oblique')} aria-label="إنهاء التجول"><X size={20} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
