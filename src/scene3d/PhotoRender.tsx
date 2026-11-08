// «رندر واقعي»: محاكاة حقيقية لمسار الضوء (Path Tracing) تطلع صورة كأنها مصوّرة
// يشتغل على نفس المشهد والكاميرا الحالية، ويجمع العينات لين توصل للهدف ثم يعرض الصورة.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePhoto } from './photoStore';
import { GradientEquirectTexture, WebGLPathTracer } from 'three-gpu-pathtracer';
import type { TimeOfDay } from '../types/plan';
import { Sparkles, Download, X } from 'lucide-react';
import { isDemo } from '../lib/demo';
import { trackExportBlocked } from '../lib/pixel';
import { useEditor, activeDesign } from '../store/editorStore';
import { canvasToBlob } from '../render2d/exportImage';
import { withWatermark } from '../render2d/watermark';
import { safeFileName, shareOrDownload, stamp } from '../lib/files';

export { usePhoto };


/** ألوان السماء حسب الوقت (الضوء المحيط في المحاكاة) */
function skyFor(time: TimeOfDay): { top: string; bottom: string; exp: number; strength: number } {
  // السماء ضوء محيط خفيف — الشمس هي اللي تعطي الظلال الواضحة (لو السماء قوية تصير «غايمة»)
  if (time === 'night') return { top: '#0b1428', bottom: '#120e0a', exp: 1.5, strength: 0.12 };
  if (time === 'sunset') return { top: '#e9a978', bottom: '#d8b48a', exp: 1.2, strength: 0.3 };
  return { top: '#8db8ea', bottom: '#eadbb8', exp: 1.4, strength: 0.35 };
}

/** داخل الـ Canvas: يشغّل المحاكاة لما الحالة «preparing/rendering» */
export function PhotoTracer({ time }: { time: TimeOfDay }) {
  const { gl, scene, camera, invalidate } = useThree();
  const status = usePhoto((s) => s.status);
  const active = status === 'preparing' || status === 'rendering';
  const pt = useRef<WebGLPathTracer | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!active) return;
    done.current = false;
    // نخفي اللي المحاكاة ما تفهمه: قبة السماء (شيدر)، النجوم، الخطوط
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      const odd = (m && (m as THREE.ShaderMaterial).isShaderMaterial) || (o as THREE.Points).isPoints || (o as THREE.Line).isLine;
      if (odd && o.visible) {
        o.visible = false;
        hidden.push(o);
      }
    });
    const prev = { env: scene.environment, bg: scene.background, fog: scene.fog, envI: scene.environmentIntensity };
    const sky = skyFor(time);
    const env = new GradientEquirectTexture(256);
    env.topColor.set(sky.top);
    env.bottomColor.set(sky.bottom);
    env.exponent = sky.exp;
    env.update();
    scene.environment = env;
    scene.background = env;
    scene.environmentIntensity = sky.strength;
    scene.fog = null;

    let tracer: WebGLPathTracer | null = null;
    try {
      tracer = new WebGLPathTracer(gl);
      tracer.bounces = 5;
      tracer.filterGlossyFactor = 0.5;
      tracer.tiles.set(2, 2);
      tracer.renderDelay = 0;
      tracer.minSamples = 1;
      tracer.fadeDuration = 0;
      tracer.dynamicLowRes = false;
      tracer.setScene(scene, camera);
      pt.current = tracer;
      usePhoto.getState().progress(0);
      invalidate();
    } catch (e) {
      console.error(e);
      usePhoto.getState().fail();
    }
    return () => {
      tracer?.dispose();
      pt.current = null;
      for (const o of hidden) o.visible = true;
      scene.environment = prev.env;
      scene.background = prev.bg;
      scene.fog = prev.fog;
      scene.environmentIntensity = prev.envI;
      env.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // أولوية 1 = نحن اللي نرسم بدل الرسم العادي طول ما الرندر شغال
  useFrame(() => {
    const t = pt.current;
    if (!t || done.current) return;
    t.renderSample();
    // نطلب الإطار الجاي حتى لو المشهد على «الرسم عند الطلب»
    invalidate();
    const st = usePhoto.getState();
    const n = Math.floor(t.samples);
    if (n !== st.samples) st.progress(n);
    if (n >= st.target) {
      done.current = true;
      try {
        st.finish(gl.domElement.toDataURL('image/png'));
      } catch {
        st.fail();
      }
    }
  }, active ? 1 : 0);
  return null;
}

// ——— الواجهة (برا الـ Canvas) ———

const MOBILE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
export const PHOTO_SAMPLES = MOBILE ? 90 : 220;

export function startPhoto() {
  usePhoto.getState().start(PHOTO_SAMPLES);
}

async function savePhoto(url: string) {
  const st = useEditor.getState();
  if (isDemo()) {
    trackExportBlocked('photo-render');
    st.toast('حفظ الرندر متاح بعد الشراء — تصميمك ينحفظ لك 👍', 'warning');
    return;
  }
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d')?.drawImage(img, 0, 0);
  const design = activeDesign(st.project);
  const blob = await canvasToBlob(withWatermark(c));
  const r = await shareOrDownload(blob, `al-enna-render-${safeFileName(design.name)}-${stamp()}.png`, design.name);
  if (r !== 'cancelled') st.toast('تم حفظ الرندر الواقعي', 'success');
}

export function PhotoOverlay() {
  const { status, samples, target, url, close } = usePhoto();
  if (status === 'idle') return null;
  if (status === 'done' || status === 'error')
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-3" dir="rtl" data-testid="photo-result">
        <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-sand-200 px-4 py-2.5">
            <b className="flex items-center gap-2 text-dune"><Sparkles size={17} className="text-gold-600" /> الرندر الواقعي</b>
            <button type="button" onClick={close} className="rounded-lg p-1.5 text-sand-700 hover:bg-sand-100" aria-label="إغلاق"><X size={18} /></button>
          </div>
          {status === 'done' ? (
            <img src={url} alt="رندر واقعي" className="min-h-0 w-full flex-1 bg-sand-100 object-contain" />
          ) : (
            <p className="p-6 text-center text-sm text-sand-800">جهازك ما يدعم الرندر الواقعي 😕 — جرّبه من لابتوب أو جوال أحدث.</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sand-200 px-4 py-2.5">
            <span className="text-[12px] text-sand-600">محاكاة حقيقية للضوء والظلال — غيّر زاوية الكاميرا أو الساعة وسوّ رندر ثاني</span>
            <div className="flex gap-2">
              <button type="button" onClick={close} className="h-9 rounded-lg border border-sand-300 px-3 text-sm font-semibold text-dune">رجوع</button>
              {status === 'done' && (
                <button type="button" onClick={() => void savePhoto(url)} className="flex h-9 items-center gap-1.5 rounded-lg bg-gold-500 px-3 text-sm font-bold text-white" data-testid="photo-save">
                  <Download size={15} /> حفظ الصورة
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  const pct = Math.min(100, Math.round((samples / target) * 100));
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-3 z-30 flex justify-center px-3" dir="rtl" data-testid="photo-progress">
      <div className="w-full max-w-md rounded-xl bg-white/95 px-4 py-3 shadow-lg">
        <div className="mb-1.5 flex items-center justify-between text-[13px]">
          <b className="flex items-center gap-1.5 text-dune"><Sparkles size={15} className="text-gold-600" /> {status === 'preparing' ? 'نجهّز المشهد…' : 'جاري الرندر الواقعي…'}</b>
          <span className="tabular-nums text-sand-700">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-sand-200"><div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${pct}%` }} /></div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-sand-600">
          <span>الصورة تصفى وتوضح مع الوقت — لا تحرك الكاميرا</span>
          <button type="button" onClick={close} className="font-semibold text-sand-800 underline">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
