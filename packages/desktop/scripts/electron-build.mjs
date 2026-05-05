/**
 * 在未设置 ELECTRON_BUILDER_BINARIES_MIRROR 时默认走 npmmirror，
 * 避免 electron-builder 从 GitHub 拉 nsis / winCodeSign 等二进制失败。
 */
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

if (!process.env.ELECTRON_BUILDER_BINARIES_MIRROR) {
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
    'https://npmmirror.com/mirrors/electron-builder-binaries/'
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Windows：结束从上次解包目录运行的主进程，并删掉 win-unpacked，避免 app.asar 被占用导致打包失败 */
function prepareWindowsReleaseDir() {
  if (process.platform !== 'win32') return
  let productName
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    productName = pkg.build?.productName || pkg.name
  } catch {
    return
  }
  if (productName) {
    spawnSync('taskkill', ['/F', '/IM', `${productName}.exe`, '/T'], {
      stdio: 'ignore',
      shell: true,
    })
  }
  const unpacked = path.join(root, 'release', 'win-unpacked')
  try {
    fs.rmSync(unpacked, {
      recursive: true,
      force: true,
      maxRetries: 8,
      retryDelay: 200,
    })
  } catch (err) {
    console.error(
      `[electron-build] 无法删除 ${unpacked}：${err?.message || err}\n` +
        '请先退出正在运行的「work master」（或任务管理器结束进程），并关闭资源管理器中打开该文件夹的窗口，然后重试。',
    )
    process.exit(1)
  }
}

prepareWindowsReleaseDir()

// pnpm 常把可执行文件放在仓库根 node_modules/.bin，桌面包下可能没有 .cmd，直接 resolve cli 更稳
const require = createRequire(import.meta.url)
let ebCli
try {
  ebCli = require.resolve('electron-builder/cli.js')
} catch {
  console.error(
    '[electron-build] 找不到 electron-builder。请在仓库根目录执行：pnpm install',
  )
  process.exit(1)
}

const result = spawnSync(process.execPath, [ebCli, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

process.exit(result.status ?? 1)
