// «🎬 فيديو درون»: الكاميرا تلف لفة كاملة حول التصميم 12 ثانية ونسجّلها فيديو (MP4 لو المتصفح يدعمه) مع شعار i3enna
// يشتغل بالكامل في الجوال بدون رفع — وبعدها زر «مشاركة» (يحتاج ضغطة جديدة عشان الواتساب يفتح)
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { useFrame, useThree } from '@react-three/fiber';
import { isDemo } from '../lib/demo';
import { trackExportBlocked } from '../lib/pixel';
import { useEditor } from '../store/editorStore';
import { shareOrDownload, stamp } from '../lib/files';

export const VIDEO_SECONDS = 12;
const FPS = 30;

interface VideoState {
  status: 'idle' | 'recording' | 'done';
  progress: number;
  nonce: number;
  blob: Blob | null;
  ext: string;
  start: () => void;
  cancel: () => void;
  finish: (b: Blob | null, ext: string) => void;
  clear: () => void;
}

export const useVideo = create<VideoState>((set, get) => ({
  status: 'idle',
  progress: 0,
  nonce: 0,
  blob: null,
  ext: 'mp4',
  start: () => {
    if (isDemo()) {
      trackExportBlocked('video-3d');
      useEditor.getState().toast('الفيديو متاح بعد الشراء — تصميمك ينحفظ لك 👍', 'warning');
      window.dispatchEvent(new CustomEvent('enna-demo-buy'));
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      useEditor.getState().toast('جهازك ما يدعم تسجيل الفيديو — جرّب من متصفح أحدث (كروم أو سفاري)', 'error');
      return;
    }
    set({ status: 'recording', progress: 0, nonce: get().nonce + 1, blob: null });
  },
  cancel: () => set({ status: 'idle', progress: 0, blob: null }),
  finish: (b, ext) => (b ? set({ status: 'done', blob: b, ext, progress: 1 }) : set({ status: 'idle', progress: 0 })),
  clear: () => set({ status: 'idle', blob: null, progress: 0 }),
}));

/** أفضل صيغة يدعمها المتصفح: MP4 أول (الواتساب والآيفون)، وإلا WebM */
export function pickMime(): { mime: string; ext: string } | null {
  const opts: [string, string][] = [
    ['video/mp4;codecs=avc1', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm;codecs=vp8', 'webm'],
    ['video/webm', 'webm'],
  ];
  for (const [m, e] of opts) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return { mime: m, ext: e };
  return null;
}

/** داخل المشهد: يشتغل بس وقت التسجيل */
export function VideoRecorder() {
  const status = useVideo((s) => s.status);
  const nonce = useVideo((s) => s.nonce);
  return status === 'recording' ? <RecLoop key={nonce} /> : null;
}

function RecLoop() {
  const { gl, scene, camera, controls } = useThree();
  const ctx = useRef<{ cv: HTMLCanvasElement; c2: CanvasRenderingContext2D; rec: MediaRecorder; chunks: Blob[]; t0: number; ext: string; stopped: boolean; az0?: number; pol0?: number } | null>(null);

  useEffect(() => {
    const src = gl.domElement;
    const pick = pickMime();
    if (!pick) {
      useEditor.getState().toast('جهازك ما يدعم تسجيل الفيديو', 'error');
      useVideo.getState().cancel();
      return;
    }
    // نصغّر لـ 960 بكسل بالكثير (حجم مناسب للواتساب)
    const scale = Math.min(1, 960 / Math.max(src.width, src.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round((src.width * scale) / 2) * 2;
    cv.height = Math.round((src.height * scale) / 2) * 2;
    const c2 = cv.getContext('2d')!;
    const stream = cv.captureStream(FPS);
    const rec = new MediaRecorder(stream, { mimeType: pick.mime, videoBitsPerSecond: 4_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const st = useVideo.getState();
      if (st.status !== 'recording') return; // انلغى
      st.finish(chunks.length ? new Blob(chunks, { type: pick.mime.split(';')[0] }) : null, pick.ext);
    };
    rec.start(500);
    ctx.current = { cv, c2, rec, chunks, t0: performance.now(), ext: pick.ext, stopped: false };
    return () => {
      const c = ctx.current;
      if (c && !c.stopped && c.rec.state !== 'inactive') {
        c.stopped = true;
        c.rec.stop();
      }
    };
  }, [gl]);

  // نتولى الرسم بأنفسنا (أولوية 1): ندوّر الكاميرا، نرسم، وننسخ الإطار مع الشعار
  useFrame((_, dt) => {
    const c = ctx.current;
    const cc = controls as unknown as { azimuthAngle?: number; polarAngle?: number; rotateTo?: (a: number, p: number, t: boolean) => void; update?: (d: number) => void } | null;
    // لفة كاملة حسب الوقت (مب حسب سرعة الجهاز) — حتى الجوال البطيء يكمل اللفة
    if (c && !c.stopped && cc?.rotateTo) {
      if (c.az0 === undefined) {
        c.az0 = cc.azimuthAngle ?? 0;
        c.pol0 = cc.polarAngle ?? Math.PI / 3;
      }
      const el0 = Math.min(1, (performance.now() - c.t0) / 1000 / VIDEO_SECONDS);
      cc.rotateTo(c.az0 + Math.PI * 2 * el0, c.pol0 ?? Math.PI / 3, false);
    }
    cc?.update?.(dt);
    gl.render(scene, camera);
    if (!c || c.stopped) return;
    const { cv, c2 } = c;
    c2.drawImage(gl.domElement, 0, 0, cv.width, cv.height);
    // الشعار تحت
    const h = Math.max(26, Math.round(cv.height * 0.06));
    c2.fillStyle = 'rgba(46,31,21,0.78)';
    c2.fillRect(0, cv.height - h, cv.width, h);
    c2.fillStyle = '#e0b660';
    c2.font = `700 ${Math.round(h * 0.46)}px "IBM Plex Sans Arabic", sans-serif`;
    c2.textAlign = 'center';
    c2.textBaseline = 'middle';
    const izba = window.location.pathname.includes('izba') || useEditor.getState().project.designs.some((d) => d.plan.land.site === 'izba');
    c2.fillText(izba ? '🏡 i3enna للعزب — i3enna.qa/izba' : '⛺ i3enna — i3enna.qa', cv.width / 2, cv.height - h / 2);
    const el = (performance.now() - c.t0) / 1000;
    useVideo.setState({ progress: Math.min(1, el / VIDEO_SECONDS) });
    if (el >= VIDEO_SECONDS) {
      c.stopped = true;
      c.rec.stop();
    }
  }, 1);
  return null;
}

/** فوق المشهد: التقدم أثناء التسجيل، وبعده «مشاركة / حفظ» */
export function VideoOverlay() {
  const status = useVideo((s) => s.status);
  const progress = useVideo((s) => s.progress);
  if (status === 'idle') return null;
  const share = async () => {
    const { blob, ext } = useVideo.getState();
    if (!blob) return;
    const st = useEditor.getState();
    const name = st.project.designs.find((d) => d.id === st.project.activeDesignId)?.name ?? 'i3enna';
    const r = await shareOrDownload(blob, `i3enna-video-${stamp()}.${ext}`, name, 'صمّمتها في i3enna 👇 i3enna.qa');
    if (r !== 'cancelled') {
      st.toast(r === 'shared' ? 'تمت المشاركة ✓' : 'نزل الفيديو ✓', 'success');
      useVideo.getState().clear();
    }
  };
  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-20 mx-auto max-w-sm rounded-2xl bg-dune/95 p-3 text-sand-50 shadow-xl lg:bottom-4" data-testid="video-overlay">
      {status === 'recording' ? (
        <>
          <div className="flex items-center justify-between text-sm font-bold">
            <span>🎬 جاري التصوير… لا تلمس الشاشة</span>
            <button type="button" onClick={() => useVideo.getState().cancel()} className="rounded-lg bg-white/15 px-2 py-1 text-[12px]">
              إلغاء
            </button>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-gold-400 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold">✅ الفيديو جاهز ({VIDEO_SECONDS} ثانية)</span>
          <span className="flex gap-1.5">
            <button type="button" onClick={() => void share()} className="rounded-lg bg-gold-500 px-3 py-1.5 text-sm font-bold text-dune" data-testid="video-share">
              📤 مشاركة / حفظ
            </button>
            <button type="button" onClick={() => useVideo.getState().clear()} className="rounded-lg bg-white/15 px-2 py-1.5 text-sm">
              ✕
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
