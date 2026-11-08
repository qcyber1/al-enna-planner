// تحسين الرندر: ظلال الزوايا (AO)، توهج الأنوار بالليل، حواف ناعمة، وانعكاسات السماء
// الجودة تتبع إعداد «جودة الإنارة»: منخفضة = بدون مؤثرات (للأجهزة الضعيفة)
import { useEffect, useRef } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, type EffectComposer as Composer } from 'postprocessing';
import type { LightQuality } from '../store/editorStore';

/** دالة رسم المشهد مع المؤثرات (للتصدير) — تنضبط لما المؤثرات شغالة */
let renderWithFx: (() => boolean) | null = null;
export function renderScene(fallback: () => void) {
  if (!renderWithFx?.()) fallback();
}

export function SceneEffects({ quality, night, mobile }: { quality: LightQuality; night: boolean; mobile: boolean }) {
  const composer = useRef<Composer>(null);
  useEffect(() => {
    renderWithFx = () => {
      if (!composer.current) return false;
      composer.current.render();
      return true;
    };
    return () => {
      renderWithFx = null;
    };
  }, []);
  if (quality === 'low') return null;
  const high = quality === 'high' && !mobile;
  return (
    <EffectComposer ref={composer} multisampling={0} enableNormalPass={false}>
      <N8AO
        halfRes={!high}
        aoRadius={night ? 1.2 : 2.2}
        distanceFalloff={1}
        intensity={night ? 1.4 : 2.4}
        color="#2b1d12"
        quality={high ? 'high' : 'performance'}
      />
      {/* التوهج بالليل بس: بالنهار يغبّش الرمل */}
      <Bloom mipmapBlur intensity={night ? 1.1 : 0} luminanceThreshold={0.55} luminanceSmoothing={0.2} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {/* تدريج ألوان خفيف مثل برامج الرندر المعماري: تباين وتشبع أعلى شوي */}
      <BrightnessContrast brightness={night ? 0 : -0.05} contrast={night ? 0.05 : 0.14} />
      <HueSaturation saturation={night ? 0.05 : 0.14} />
      <Vignette eskil={false} offset={0.25} darkness={night ? 0.55 : 0.32} />
      <SMAA />
    </EffectComposer>
  );
}

/** انعكاسات خفيفة من السماء على المعدن والماي والزجاج (بدون تحميل صور من النت) */
export function SkyReflections({ night }: { night: boolean }) {
  return (
    <Environment resolution={64} frames={1} environmentIntensity={night ? 0.05 : 0.06}>
      <Lightformer form="rect" intensity={night ? 0.3 : 2.2} color={night ? '#1d2a4a' : '#cfe4ff'} scale={[40, 40, 1]} position={[0, 20, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <Lightformer form="rect" intensity={night ? 0.1 : 1.2} color={night ? '#0a0f1c' : '#f3dcb0'} scale={[40, 6, 1]} position={[0, 2, -20]} />
      <Lightformer form="rect" intensity={night ? 0.1 : 0.8} color={night ? '#0a0f1c' : '#e8d2a8'} scale={[40, 6, 1]} position={[0, 2, 20]} rotation={[0, Math.PI, 0]} />
    </Environment>
  );
}
