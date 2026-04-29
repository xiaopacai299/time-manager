import { getRendererWebUtils } from './electronWebUtilsRenderer.js'

/**
 * 从拖放的 dataTransfer 解析本地路径。
 * 优先级：1) 渲染进程 `electron/renderer` 的 webUtils.getPathForFile（与 File 同上下文，Electron 推荐）
 * 2) File.path（旧版/部分环境仍有）3) preload resolveDropPaths（仅 uri-list 等，勿再传 File 指望 getPathForFile）
 *
 * @param {DataTransfer | null | undefined} dt
 * @param {(files: FileList | File[] | null | undefined, uriListText: string) => string[]} resolveDropPaths
 * @returns {Promise<string[]>}
 */
export async function dropPathsFromDataTransfer(dt, resolveDropPaths) {
  const files = dt?.files
  const uriList = typeof dt?.getData === 'function' ? dt.getData('text/uri-list') : ''

  const viaWebUtils = await pathsViaElectronRendererWebUtils(files)
  if (viaWebUtils.length) return viaWebUtils

  const fromPathProp = pathsFromFilePathProperty(files)
  if (fromPathProp.length) return fromPathProp

  const fromBridge = resolveDropPaths?.([], uriList) || []
  return fromBridge
}

/** @param {FileList | File[] | null | undefined} files */
async function pathsViaElectronRendererWebUtils(files) {
  const out = []
  if (!files?.length) return out
  const webUtils = await getRendererWebUtils()
  if (!webUtils?.getPathForFile) return out
  const n = files.length
  for (let i = 0; i < n; i += 1) {
    const f = files.item ? files.item(i) : files[i]
    if (!f) continue
    try {
      const p = webUtils.getPathForFile(f)
      if (typeof p === 'string' && p.trim()) out.push(p.trim())
    } catch {
      /* ignore */
    }
  }
  return [...new Set(out)]
}

/** @param {FileList | File[] | null | undefined} files */
function pathsFromFilePathProperty(files) {
  const out = []
  if (!files?.length) return out
  const n = files.length
  for (let i = 0; i < n; i += 1) {
    const f = files.item ? files.item(i) : files[i]
    if (!f) continue
    try {
      const p = typeof f.path === 'string' ? f.path.trim() : ''
      if (p) out.push(p)
    } catch {
      /* ignore */
    }
  }
  return [...new Set(out)]
}
