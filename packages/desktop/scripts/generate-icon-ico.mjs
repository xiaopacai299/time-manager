/**
 * 桌面与移动端图标的「单一源」同步脚本。
 *
 * 唯一源文件：`packages/desktop/build/icon.png`
 * 由此派生：
 *   - `packages/desktop/build/icon.ico`（electron-builder 应用图标 / Electron 窗口图标）
 *   - `packages/desktop/assets/tray-icon.png`（托盘 / 隐藏栏图标，因 assets 会被打包进 asar）
 *   - `packages/mobile/assets/icon.png` / `adaptive-icon.png` / `splash-icon.png`
 *
 * 想换图标只需替换 `build/icon.png` 一个文件，然后跑 `pnpm --filter @time-manger/desktop run icon:ico`，
 * 也会在 `electron-build` 之前被自动调用。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'

const desktopRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.join(desktopRoot, '..', '..')
const sourcePng = path.join(desktopRoot, 'build', 'icon.png')
const targetIco = path.join(desktopRoot, 'build', 'icon.ico')

if (!fs.existsSync(sourcePng)) {
  console.error(`[icon] 源 PNG 不存在：${sourcePng}`)
  process.exit(1)
}

const icoBuffer = await pngToIco(sourcePng)
fs.writeFileSync(targetIco, icoBuffer)
console.log(`[icon] generated: ${targetIco}`)

const copies = [
  path.join(desktopRoot, 'assets', 'tray-icon.png'),
  path.join(repoRoot, 'packages', 'mobile', 'assets', 'icon.png'),
  path.join(repoRoot, 'packages', 'mobile', 'assets', 'adaptive-icon.png'),
  path.join(repoRoot, 'packages', 'mobile', 'assets', 'splash-icon.png'),
]

for (const dest of copies) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(sourcePng, dest)
  console.log(`[icon] synced: ${dest}`)
}
