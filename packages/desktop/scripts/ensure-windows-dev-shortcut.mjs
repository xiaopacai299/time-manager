/**
 * Windows 开发态：在开始菜单创建快捷方式，指向品牌化后的 .dev-electron/electron.exe
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { prepareDevElectron } from './prepare-dev-electron.mjs';

if (process.platform !== 'win32') {
  process.exit(0);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronExe = await prepareDevElectron();

const ico = path.join(root, 'build', 'icon.ico');
const iconLocation = fs.existsSync(ico)
  ? `${ico},0`
  : fs.existsSync(path.join(root, 'build', 'icon.png'))
    ? `${path.join(root, 'build', 'icon.png')},0`
    : '';

const shortcutPath = path.join(
  process.env.APPDATA || '',
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  '橘子ING (开发).lnk',
);

const APP_DISPLAY_NAME = '橘子ING';

const ps = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$Shortcut.TargetPath = '${String(electronExe).replace(/'/g, "''")}'
$Shortcut.Arguments = '.'
$Shortcut.WorkingDirectory = '${root.replace(/'/g, "''")}'
$Shortcut.Description = '${APP_DISPLAY_NAME}'
${iconLocation ? `$Shortcut.IconLocation = '${iconLocation.replace(/'/g, "''")}'` : ''}
$Shortcut.Save()
`;

const run = spawnSync(
  'powershell',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
  { stdio: 'pipe', encoding: 'utf8' },
);

if (run.status !== 0) {
  console.warn('[win-shortcut] 创建快捷方式失败:', run.stderr || run.stdout);
  process.exit(0);
}

console.log(`[win-shortcut] 已更新: ${shortcutPath}`);
console.log('[win-shortcut] 目标:', electronExe);
console.log('[win-shortcut] 若任务栏仍显示旧图标：取消固定后重新固定，或重启资源管理器。');
