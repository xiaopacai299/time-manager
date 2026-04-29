/**
 * 仅在 Electron 渲染进程内可用；与 drop 得到的 File 同一会话，避免经 preload 传 File 被克隆。
 * Vite 对 `import('electron/renderer')` 会注入 __vitePreload，在 Electron 下 bare specifier 常解析失败；
 * 用动态 specifier + Function，避免被打包器改写为对 dev server 的请求。
 */
let cached = null

const ELECTRON_RENDERER_SPEC = 'electron/' + 'renderer'

/** @returns {Promise<import('electron').WebUtils | null>} */
export async function getRendererWebUtils() {
  if (cached !== null) return cached
  try {
    // 避免 Vite 把 import() 改成对 dev server 的预加载请求；勿改为字面量 import('electron/renderer')
    // eslint-disable-next-line no-new-func -- 仅用于运行时解析 Electron bare specifier
    const dynamicImport = new Function('spec', 'return import(spec)')
    const m = await dynamicImport(ELECTRON_RENDERER_SPEC)
    cached = m.webUtils ?? null
  } catch {
    cached = null
  }
  return cached
}
