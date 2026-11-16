import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { existsSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// A extensão tem arquivos estáticos (manifest, content/background, fontes,
// ícones) que não podem ser apagados. Removemos só os bundles antigos.
function cleanOldBundles() {
  return {
    name: 'clean-old-bundles',
    buildStart() {
      const dir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'extension', 'assets')
      if (!existsSync(dir)) return
      for (const file of readdirSync(dir)) {
        if (file.endsWith('.js') || file.endsWith('.css')) {
          unlinkSync(join(dir, file))
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cleanOldBundles()],
  base: './',
  build: {
    outDir: '../extension',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        sidepanel: 'sidepanel.html',
        studio: 'studio.html',
      },
    },
  },
})
