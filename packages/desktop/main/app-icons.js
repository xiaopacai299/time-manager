import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { applyWindowsAppDetails } from './windows-taskbar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..');

/**
 * @param {import('electron').NativeImage} nativeImage
 * @returns {{ iconFilePath: string, iconImage: import('electron').NativeImage | undefined }}
 */
export function resolveAppIcons(nativeImage) {
  const candidates = [
    path.join(desktopRoot, 'build', 'icon.ico'),
    path.join(desktopRoot, 'build', 'icon.png'),
    path.join(desktopRoot, 'assets', 'tray-icon.png'),
  ];
  const iconFilePath = path.resolve(
    candidates.find((p) => fs.existsSync(p)) || candidates[1],
  );

  let iconImage = nativeImage.createFromPath(iconFilePath);
  if (iconImage.isEmpty()) {
    const png = path.join(desktopRoot, 'build', 'icon.png');
    if (fs.existsSync(png)) {
      iconImage = nativeImage.createFromPath(png);
    }
  }

  return {
    iconFilePath,
    iconImage: iconImage.isEmpty() ? undefined : iconImage,
  };
}

/**
 * Windows 任务栏：橘子图标 + 跳转列表显示名（非 Electron）。
 * @param {import('electron').BrowserWindow} win
 * @param {import('electron').NativeImage | undefined} iconImage
 * @param {string} [iconFilePath]
 */
export function applyWindowTaskbarIcon(win, iconImage, iconFilePath) {
  if (!win || win.isDestroyed()) return;

  const apply = () => {
    if (win.isDestroyed()) return;
    if (iconImage && !iconImage.isEmpty()) {
      try {
        win.setIcon(iconImage);
      } catch {
        // ignore
      }
    }
    applyWindowsAppDetails(win, iconFilePath);
  };

  apply();
  win.once('ready-to-show', apply);
  win.on('show', apply);
}
