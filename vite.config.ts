import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const apiTarget = process.env.VITE_DEV_API_TARGET || 'http://localhost:8787';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      // Bump the warn threshold — we still want a heads up if a chunk
      // grows unexpectedly past this size, but the default 500kB is
      // tight once a single vendor lands inside.
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            // Firebase SDK — only the /app side pulls this in.
            if (id.includes('/firebase/') || id.includes('@firebase/')) {
              return 'vendor-firebase';
            }
            // GSAP + ScrollTrigger — landing only.
            if (id.includes('/gsap/') || id.includes('node_modules/gsap')) {
              return 'vendor-gsap';
            }
            // PDF generation — only loaded on demand from reports.ts,
            // but if anything pulls it eagerly it will land here.
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'vendor-pdf';
            }
            // Charts (HealthIndicator).
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            // Animation runtime.
            if (id.includes('node_modules/motion')) {
              return 'vendor-motion';
            }
            // Date formatting/locales.
            if (id.includes('date-fns')) {
              return 'vendor-date-fns';
            }
            // Icons.
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }

            return undefined; // leave the rest alone
          },
        },
      },
    },
  };
});
