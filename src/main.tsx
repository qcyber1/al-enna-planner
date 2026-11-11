import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import './index.css';
import App from './App';
import { ErrorBoundary, isChunkError, reloadOnce } from './components/ErrorBoundary';
import { LicenseGate } from './components/LicenseGate';
import { useEditor } from './store/editorStore';
import { useViewport } from './editor2d/viewport';
import { usePhoto } from './scene3d/photoStore';
import { getLang, initI18n } from './lib/i18n';
import { saveSnapClick } from './lib/snap';

// إعلانات سناب: نحفظ رقم الضغطة على الإعلان (ScCid) للشراء
saveSnapClick();

// وضع تصوير الفيديو التسويقي (?promo)
if (new URLSearchParams(window.location.search).has('promo')) {
  (window as unknown as Record<string, unknown>).__enna = { useEditor, useViewport, usePhoto };
}

// العمل بدون إنترنت + «أضف للشاشة الرئيسية» (في النسخة المنشورة فقط)
if ('serviceWorker' in navigator && import.meta.env.PROD && !new URLSearchParams(window.location.search).has('promo')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// الإنجليزي: نجهّز القاموس قبل أول رسم عشان ما يطلع عربي لحظة
const ready = getLang() === 'en' ? initI18n().catch(() => {}) : Promise.resolve();
void ready.then(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      onError={(e) => {
        if (isChunkError(e)) reloadOnce();
      }}
      fallback={() => (
        <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#3b2a1e', padding: 24, fontFamily: 'IBM Plex Sans Arabic, system-ui, sans-serif' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 32 }}>⛺</div>
            <p style={{ fontWeight: 700, color: '#2b1d12' }}>صار خطأ بسيط في الصفحة</p>
            <p style={{ color: '#7a5c3e', fontSize: 14 }}>تصميمك محفوظ وما تأثر — حدّث الصفحة وتكمل.</p>
            <button type="button" onClick={() => window.location.reload()} style={{ background: '#d4a24c', border: 0, borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>
              حدّث الصفحة
            </button>
          </div>
        </div>
      )}
    >
      <LicenseGate>
        <App />
      </LicenseGate>
    </ErrorBoundary>
  </StrictMode>,
));
