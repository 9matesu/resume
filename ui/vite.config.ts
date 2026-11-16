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

// Paginas de extensao nao precisam de crossorigin nos tags gerados. Em
// algumas versoes do Chrome esse atributo faz o modulo ser tratado como
// recurso cross-world e a pagina fica em branco.
function stripCrossorigin() {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html: string) {
      return html.replace(/\s+crossorigin(?:="[^"]*")?/g, '')
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cleanOldBundles(), stripCrossorigin()],
  base: './',
  build: {
    outDir: '../extension',
    emptyOutDir: false,
    // Extensão Chrome: o preload de módulo com crossorigin gera
    // "cross-world extension resource mismatch" no painel. O import
    // dinâmico continua funcionando sem o link de modulepreload.
    modulePreload: false,
    rollupOptions: {
      input: {
        sidepanel: 'sidepanel.html',
        studio: 'studio.html',
      },
    },
  },
})
