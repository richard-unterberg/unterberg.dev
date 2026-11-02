import marmo from '@marmo/astro/integration'
import tailwindcss from '@tailwindcss/vite'
import { astroBeastiesOutput } from '@unterberg/vite-beasties-output/astro'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://unterberg.dev/',
  trailingSlash: 'always',
  integrations: [
    marmo(),
    astroBeastiesOutput({
      outputDirectory: 'dist',
      include: ['dist/**/*.html'],
      beastiesOptions: {
        // Astro references these from separate inline styles; keep them available during head swaps.
        keyframes: 'all',
        preload: 'media',
        allowRules: [
          /data-theme=.*dark/,
          /^:root:has\(input\.theme-controller/,
          /^:where\(:root\)$/,
          // Match base and variant-prefixed Tailwind sizing utilities, e.g.
          // `.h-*`, `.min-h-*`, `.sm\:w-*`, and `.lg\:min-h-*`.
          /(?:^\.|\\:)(?:h|min-h|max-h|w|min-w|max-w|basis)-/,
          /(?:^\.|\\:)prose-container/,
        ],
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
