import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /<repo>/; the deploy workflow sets BASE_PATH.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Vento',
        short_name: 'Vento',
        description: 'Il vento dove sei: che vento è, quanto soffia, da dove arriva e le previsioni per i prossimi giorni.',
        lang: 'it',
        theme_color: '#0f3440',
        background_color: '#08202a',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['weather', 'travel'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          // Forecasts are not cached here on purpose: the app keeps its own copy with the real
          // download time, so an old response is never shown as "aggiornato adesso".
          {
            urlPattern: ({ url }) => url.hostname === 'geocoding-api.open-meteo.com' || url.hostname === 'api.bigdatacloud.net',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'places',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 86_400 },
            },
          },
        ],
      },
    }),
  ],
});
