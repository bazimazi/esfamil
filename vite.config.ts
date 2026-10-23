import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'اسم فامیل — یک حرف، هزار خاطره',
        short_name: 'اسم فامیل',
        description: 'بازی خاطره‌انگیز ایرانی، روی گوشی و کامپیوتر',
        lang: 'fa',
        dir: 'rtl',
        theme_color: '#253e8f',
        background_color: '#f6f1e5',
        display: 'standalone',
        start_url: '/',
        orientation: 'any',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/socket\.io/, /^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/api': 'http://localhost:3001',
    },
  },
});
