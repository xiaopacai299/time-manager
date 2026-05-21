import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { app } from 'electron';
import { APP_DISPLAY_NAME, APP_USER_MODEL_ID } from '@time-manger/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..');

function resolveTaskbarIconPath() {
  const candidates = [
    path.join(desktopRoot, 'build', 'icon.ico'),
    path.join(desktopRoot, 'build', 'icon.png'),
    path.join(desktopRoot, 'assets', 'tray-icon.png'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  return found ? path.resolve(found) : path.resolve(candidates[1]);
}

/**
 * 开发态下让任务栏跳转列表显示「橘子ING」而非 Electron（需配合固定 AppUserModelID）。
 */
export function registerWindowsTaskbarIdentity() {
  if (process.platform !== 'win32') return;

  const iconPath = resolveTaskbarIconPath();
  const key = `HKCU\\Software\\Classes\\AppUserModelId\\${APP_USER_MODEL_ID}`;

  try {
    execFileSync(
      'reg',
      ['add', key, '/v', 'FriendlyAppName', '/t', 'REG_SZ', '/d', APP_DISPLAY_NAME, '/f'],
      { windowsHide: true },
    );
    if (fs.existsSync(iconPath)) {
      const defaultIcon = iconPath.toLowerCase().endsWith('.ico')
        ? `${iconPath},0`
        : iconPath;
      execFileSync(
        'reg',
        ['add', key, '/v', 'DefaultIcon', '/t', 'REG_EXPAND_SZ', '/d', defaultIcon, '/f'],
        { windowsHide: true },
      );
    }
  } catch (err) {
    console.warn('[windows-taskbar] 注册 AppUserModelId 显示名失败:', err?.message || err);
  }
}

function quoteWin(arg) {
  const s = String(arg ?? '');
  if (!/\s|"/.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}

/**
 * @param {import('electron').BrowserWindow} win
 * @param {string} iconFilePath
 */
export function applyWindowsAppDetails(win, iconFilePath) {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return;
  if (typeof win.setAppDetails !== 'function') return;

  const ico =
    iconFilePath && fs.existsSync(iconFilePath)
      ? path.resolve(iconFilePath)
      : resolveTaskbarIconPath();
  const appIconPath = ico.toLowerCase().endsWith('.ico')
    ? ico
    : resolveTaskbarIconPath();

  if (!appIconPath || !fs.existsSync(appIconPath)) return;

  const exe = app.isPackaged ? app.getPath('exe') : process.execPath;
  const workDir = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();

  try {
    win.setAppDetails({
      appId: APP_USER_MODEL_ID,
      appIconPath,
      appIconIndex: 0,
      relaunchDisplayName: APP_DISPLAY_NAME,
      relaunchCommand: `${quoteWin(exe)} ${quoteWin(workDir)}`,
    });
  } catch (err) {
    console.warn('[windows-taskbar] setAppDetails 失败:', err?.message || err);
  }
}
