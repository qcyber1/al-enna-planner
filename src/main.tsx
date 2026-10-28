import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import './index.css';
import App from './App';
import { LicenseGate } from './components/LicenseGate';
import { useEditor } from './store/editorStore';
import { useViewport } from './editor2d/viewport';

// وضع تصوير الفيديو التسويقي (?promo)
if (new URLSearchParams(window.location.search).has('promo')) {
  (window as unknown as Record<string, unknown>).__enna = { useEditor, useViewport };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LicenseGate>
      <App />
    </LicenseGate>
  </StrictMode>,
);
