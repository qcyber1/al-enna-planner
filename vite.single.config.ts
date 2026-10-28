import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// بناء ملف HTML واحد (للنشر كصفحة مستقلة)
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  base: './',
  build: { outDir: 'dist-single', chunkSizeWarningLimit: 5000 },
});
