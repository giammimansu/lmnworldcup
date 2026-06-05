import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-mark.svg', 'logo-full.svg'],
      manifest: {
        name: 'LMN World Cup',
        short_name: 'LMN WC',
        description: 'Indovina. Scala. Domina.',
        lang: 'it',
        theme_color: '#10172A',
        background_color: '#10172A',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/logo-mark.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
