import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'

const STRICT_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"

// Le rechargement à chaud injecte un script en ligne et ouvre un websocket :
// la politique n'est assouplie que sur le serveur de développement.
const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:*"

function contentSecurityPolicy(): Plugin {
  let csp = STRICT_CSP
  return {
    name: 'agent-toolbox-csp',
    configResolved(config) {
      csp = config.command === 'serve' ? DEV_CSP : STRICT_CSP
    },
    transformIndexHtml(html) {
      return html.replace('%CSP%', csp)
    }
  }
}

export default defineConfig({
  main: {
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts') } } }
  },
  preload: {
    build: { rollupOptions: { input: { index: resolve('src/preload/index.ts') } } }
  },
  renderer: {
    root: resolve('src/renderer'),
    server: { port: 5506 },
    plugins: [react(), contentSecurityPolicy()],
    build: {
      rollupOptions: {
        input: {
          widget: resolve('src/renderer/widget.html'),
          panel: resolve('src/renderer/panel.html'),
          demo: resolve('src/renderer/demo.html')
        }
      }
    }
  }
})
