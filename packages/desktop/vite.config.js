import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Vite 会给 script/link 加 crossorigin，在 Electron file:// 下易导致模块/CSS 按 CORS 失败、进程秒退。 */
function stripCrossoriginForElectron() {
  return {
    name: 'strip-crossorigin-electron',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(/\s+crossorigin(?:="[^"]*"|='[^']*'|)?/gi, '')
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), stripCrossoriginForElectron()],
  // 与 Electron file:// 加载 dist/index.html 一致，避免打包后资源指向盘符根路径
  base: './',
  // 渲染进程内 `import('electron/renderer')` 由 Electron 运行时解析，勿打进浏览器包
  optimizeDeps: {
    exclude: ['electron', 'electron/renderer'],
  },
  build: {
    rollupOptions: {
      external: (id) => id === 'electron' || id.startsWith('electron/'),
    },
  },
})
