import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MusicPlayer Pro',
        short_name: 'MusicPlayer',
        description: '离线音乐播放器 - Apple Music 风格',
        lang: 'zh-CN',
        theme_color: '#1C1C1E',
        background_color: '#1C1C1E',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['music', 'entertainment'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          { src: '/screenshot-1.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow' },
          { src: '/screenshot-2.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow' },
        ],
        shortcuts: [
          {
            name: '搜索曲库',
            short_name: '搜索',
            url: '/now-playing',
            icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: '收藏',
            short_name: '收藏',
            url: '/favorites',
            icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
