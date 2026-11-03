import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  preview: { allowedHosts: true },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // تقسيم دقيق: مكتبات 3D ما تنحمّل إلا لما يفتح المجسم (المكتبات المشتركة مثل zustand تبقى برا)
        manualChunks(id: string) {
          // أدوات Vite الداخلية (preload-helper وغيرها) مع vendor عشان ما تسحب ملفات الـ3D معها
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers') || id.includes('vite/modulepreload-polyfill')) return 'vendor';
          if (!id.includes('node_modules')) return undefined;
          // React والمكتبات المشتركة في ملف مستقل (وإلا Rollup يحطها داخل ملف الـ3D ويصير لازم يتحمّل من البداية)
          if (/node_modules\/(react|react-dom|scheduler|zustand|use-sync-external-store|lucide-react)\//.test(id)) return 'vendor';
          if (/node_modules\/three\//.test(id)) return 'three';
          if (/node_modules\/(@react-three|three-stdlib|camera-controls|troika|maath|meshline|@monogrid|three-mesh-bvh)/.test(id)) return 'r3f';
          if (/node_modules\/(konva|react-konva)\//.test(id)) return 'konva';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
