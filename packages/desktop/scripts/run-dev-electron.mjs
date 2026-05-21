/**
 * Windows 开发启动：使用 rcedit 品牌化后的 .dev-electron/electron.exe
 */
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { prepareDevElectron } from './prepare-dev-electron.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

let exe;
try {
  exe =
    process.platform === 'win32'
      ? await prepareDevElectron()
      : require('electron');
} catch (err) {
  console.error('[dev-electron]', err?.message || err);
  console.error('[dev-electron] 回退到官方 electron.exe（任务栏可能仍显示 Electron）');
  exe = require('electron');
}

const child = spawn(exe, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  windowsHide: false,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('[dev-electron] 启动失败:', err);
  process.exit(1);
});
