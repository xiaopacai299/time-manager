/**
 * 在未设置 ELECTRON_BUILDER_BINARIES_MIRROR 时默认走 npmmirror，
 * 避免 electron-builder 从 GitHub 拉 nsis / winCodeSign 等二进制失败。
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (!process.env.ELECTRON_BUILDER_BINARIES_MIRROR) {
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
    'https://npmmirror.com/mirrors/electron-builder-binaries/'
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ebCmd =
  process.platform === 'win32'
    ? path.join(root, 'node_modules', '.bin', 'electron-builder.cmd')
    : path.join(root, 'node_modules', '.bin', 'electron-builder')

const result = spawnSync(ebCmd, process.argv.slice(2), {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
})

process.exit(result.status ?? 1)
