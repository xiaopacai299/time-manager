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
  /** 「work master」名字带空格，需要带空格的 IM 参数；同时尝试常见命名兜底。 */
  const candidates = [
    productName && `${productName}.exe`,
    'work master.exe',
    'work-master.exe',
    'time-pet.exe',
  ].filter(Boolean)
  for (const name of candidates) {
    spawnSync('taskkill', ['/F', '/IM', name, '/T'], {
      stdio: 'ignore',
      shell: true,
    })
  }
  const unpacked = path.join(root, 'release', 'win-unpacked')
  if (!fs.existsSync(unpacked)) return
  /** Windows 上句柄释放有延迟，给 ~10s 退避重试，足以覆盖资源管理器/防病毒短暂占用。 */
  const attempts = 20
  for (let i = 0; i < attempts; i += 1) {
    try {
      fs.rmSync(unpacked, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 })
      return
    } catch (err) {
      if (i === attempts - 1) {
        console.error(
          `[electron-build] 无法删除 ${unpacked}：${err?.message || err}\n` +
            '原因通常是上一版「work master.exe」仍在运行，或 release/win-unpacked 目录被资源管理器/杀毒软件占用。\n' +
            '请关闭桌面端（含托盘图标右键退出）与该文件夹后重试。',
        )
        process.exit(1)
      }
      const sleepMs = 500
      const buf = new Int32Array(new SharedArrayBuffer(4))
      Atomics.wait(buf, 0, 0, sleepMs)
    }
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
