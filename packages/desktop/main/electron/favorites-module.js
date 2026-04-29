export function createFavoritesModule({
  petState,
  persistPetState,
  app,
  BrowserWindow,
  shell,
  nativeImage,
  path,
  fs,
  createHash,
  iconPath,
  __dirname,
  loadPetRenderer,
}) {
  let favoritesWindow = null;

  function sanitizeFavoriteItem(item) {
    const fullPath = String(item?.path || '').trim();
    if (!fullPath) return null;
    const name = String(item?.name || path.basename(fullPath) || fullPath).trim();
    const launchPath = String(item?.launchPath || '').trim();
    const iconHint = String(item?.iconHint || '').trim();
    const iconDataUrl = String(item?.iconDataUrl || '').trim();
    return { path: fullPath, name, launchPath, iconHint, iconDataUrl };
  }

  function getFavoritesList() {
    return (petState.favorites || [])
      .map((item) => sanitizeFavoriteItem(item))
      .filter(Boolean);
  }

  function broadcastFavoritesUpdate() {
    if (!favoritesWindow || favoritesWindow.isDestroyed()) return;
    favoritesWindow.webContents.send('favorites:updated', getFavoritesList());
  }

  function isWindowsAppShortcut(filePath) {
    const p = String(filePath || '').trim();
    if (!p || path.extname(p).toLowerCase() !== '.lnk') return false;
    if (process.platform !== 'win32') return true;
    try {
      const info = shell.readShortcutLink(p);
      const target = String(info?.target || '').trim();
      return target.toLowerCase().endsWith('.exe');
    } catch {
      return false;
    }
  }

  function addFavoritesByPaths(paths = []) {
    const exists = new Set(getFavoritesList().map((item) => item.path.toLowerCase()));
    const merged = [...getFavoritesList()];
    const rejected = [];
    let added = 0;
    for (const rawPath of paths) {
      const p = String(rawPath || '').trim();
      if (!p) continue;
      if (!isWindowsAppShortcut(p)) {
        rejected.push(p);
        continue;
      }
      const key = p.toLowerCase();
      if (exists.has(key)) continue;
      let launchPath = p;
      let iconHint = '';
      if (process.platform === 'win32' && path.extname(p).toLowerCase() === '.lnk') {
        try {
          const info = shell.readShortcutLink(p);
          if (info?.target) launchPath = String(info.target || '').trim() || launchPath;
          if (info?.icon) iconHint = String(info.icon || '').trim();
        } catch {
          // keep fallback defaults
        }
      }
      merged.push({
        path: p,
        name: path.basename(p) || p,
        launchPath,
        iconHint,
        iconDataUrl: '',
      });
      exists.add(key);
      added += 1;
    }
    petState.favorites = merged;
    persistPetState();
    broadcastFavoritesUpdate();
    return { list: getFavoritesList(), rejected, added };
  }

  function getDesktopShortcutCheck(filePath) {
    const p = String(filePath || '').trim();
    const desktop = app.getPath('desktop');
    const publicDesktop = path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop');
    const desktopRoots = [desktop, publicDesktop];
    const ext = path.extname(p).toLowerCase();
    const matchRoot = p
      ? desktopRoots.find((root) => {
          const rel = path.relative(root, p);
          return Boolean(rel && !rel.startsWith('..') && !path.isAbsolute(rel));
        })
      : '';
    const rel = p && matchRoot ? path.relative(matchRoot, p) : '';
    const inDesktop = Boolean(matchRoot);
    const isLnk = ext === '.lnk';
    const exists = p ? fs.existsSync(p) : false;
    return { p, desktop, publicDesktop, matchRoot, ext, rel, inDesktop, isLnk, exists };
  }

  async function removeShortcutWithFallback(fullPath) {
    try {
      fs.unlinkSync(fullPath);
      return { ok: true, method: 'unlink' };
    } catch (error) {
      const code = String(error?.code || '');
      if (code !== 'EPERM' && code !== 'EACCES') {
        return { ok: false, method: 'unlink', error };
      }
    }

    try {
      await shell.trashItem(fullPath);
      if (!fs.existsSync(fullPath)) {
        return { ok: true, method: 'trashItem' };
      }
      return {
        ok: false,
        method: 'trashItem',
        error: new Error(`trashItem completed but file still exists: ${fullPath}`),
      };
    } catch (error) {
      return { ok: false, method: 'trashItem', error };
    }
  }

  async function addFavoritesAndOptionallyMoveShortcuts(paths = [], moveDesktopShortcuts = false) {
    const result = addFavoritesByPaths(paths);
    if (!moveDesktopShortcuts) return result;
    console.log('[favorites-remove-shortcut-start]', { total: paths.length });
    for (const p of paths) {
      const fullPath = String(p || '').trim();
      const check = getDesktopShortcutCheck(fullPath);
      if (!check.p) {
        console.log('[favorites-remove-shortcut-skip-empty]');
        continue;
      }
      if (!check.isLnk) {
        console.log('[favorites-remove-shortcut-skip]', {
          path: check.p,
          reason: 'not-lnk',
          ext: check.ext,
        });
        continue;
      }
      if (!check.inDesktop) {
        console.log('[favorites-remove-shortcut-skip]', {
          path: check.p,
          reason: 'not-under-desktop',
          desktop: check.desktop,
          publicDesktop: check.publicDesktop,
          relative: check.rel,
        });
        continue;
      }
      if (!check.exists) {
        console.log('[favorites-remove-shortcut-skip]', {
          path: check.p,
          reason: 'not-exists',
        });
        continue;
      }
      const removeResult = await removeShortcutWithFallback(fullPath);
      if (removeResult.ok) {
        console.log('[favorites-remove-shortcut-ok]', { path: fullPath, method: removeResult.method });
      } else {
        const error = removeResult.error;
        console.error('[favorites-remove-shortcut-error]', {
          path: fullPath,
          method: removeResult.method,
          name: error?.name,
          message: error?.message,
          code: error?.code,
          hint: '若为 Public Desktop，可能需要以管理员权限启动应用',
        });
      }
    }
    return result;
  }

  function removeFavoriteByPath(targetPath) {
    const normalized = String(targetPath || '').trim().toLowerCase();
    if (!normalized) return getFavoritesList();
    petState.favorites = getFavoritesList().filter((item) => item.path.toLowerCase() !== normalized);
    persistPetState();
    broadcastFavoritesUpdate();
    return getFavoritesList();
  }

  function cacheFavoriteIconData(pathKey, dataUrl) {
    const target = String(pathKey || '').trim().toLowerCase();
    const icon = String(dataUrl || '').trim();
    if (!target || !icon) return;
    const updated = getFavoritesList().map((entry) => {
      if (entry.path.toLowerCase() !== target) return entry;
      return { ...entry, iconDataUrl: icon };
    });
    petState.favorites = updated;
    persistPetState();
  }

  function toSafeFileName(text) {
    return (
      String(text || 'favorite')
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 48) || 'favorite'
    );
  }

  function getFavoriteDragShortcutPath(item) {
    const cacheDir = path.join(app.getPath('userData'), 'favorites-drag-cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const hash = createHash('sha1').update(String(item.path || '')).digest('hex').slice(0, 10);
    const baseName = `${toSafeFileName(item.name)}_${hash}.lnk`;
    return path.join(cacheDir, baseName);
  }

  function ensureFavoriteDragFile(item) {
    const originalPath = String(item?.path || '').trim();
    if (originalPath && originalPath.toLowerCase().endsWith('.lnk') && fs.existsSync(originalPath)) {
      return originalPath;
    }
    if (process.platform !== 'win32') {
      const launchPath = String(item?.launchPath || '').trim();
      return launchPath && fs.existsSync(launchPath) ? launchPath : '';
    }
    const launchPath = String(item?.launchPath || '').trim();
    if (!launchPath || !fs.existsSync(launchPath)) return '';
    const dragLnkPath = getFavoriteDragShortcutPath(item);
    const iconHint = String(item?.iconHint || '').trim();
    const iconPath = iconHint.includes(',') ? iconHint.split(',')[0].trim() : iconHint;
    const options = {
      target: launchPath,
      cwd: path.dirname(launchPath),
      description: String(item?.name || ''),
    };
    if (iconPath && fs.existsSync(iconPath)) {
      options.icon = iconPath;
    }
    try {
      shell.writeShortcutLink(dragLnkPath, 'create', options);
      if (fs.existsSync(dragLnkPath)) return dragLnkPath;
    } catch (error) {
      console.error('[favorites-create-drag-shortcut-error]', error);
    }
    return '';
  }

  function openFavoritePath(targetPath) {
    const p = String(targetPath || '').trim();
    if (!p) return false;
    const item = getFavoritesList().find((entry) => entry.path.toLowerCase() === p.toLowerCase());
    const launchPath = String(item?.launchPath || p).trim();
    shell.openPath(launchPath);
    return true;
  }

  async function getFavoriteIconDataUrl(targetPath) {
    const p = String(targetPath || '').trim();
    if (!p) return '';
    try {
      const item = getFavoritesList().find((entry) => entry.path.toLowerCase() === p.toLowerCase());
      if (item?.iconDataUrl) return item.iconDataUrl;

      const candidates = [];
      const pushCandidate = (candidate) => {
        const c = String(candidate || '').trim();
        if (!c) return;
        if (!candidates.some((v) => v.toLowerCase() === c.toLowerCase())) {
          candidates.push(c);
        }
      };
      const normalizeIconLocation = (iconLocation) => {
        const raw = String(iconLocation || '').trim();
        if (!raw) return '';
        const idx = raw.lastIndexOf(',');
        if (idx > 1) return raw.slice(0, idx).trim();
        return raw;
      };

      pushCandidate(item?.launchPath);
      pushCandidate(normalizeIconLocation(item?.iconHint));
      pushCandidate(p);

      if (process.platform === 'win32' && path.extname(p).toLowerCase() === '.lnk') {
        try {
          const info = shell.readShortcutLink(p);
          pushCandidate(info?.target);
          pushCandidate(normalizeIconLocation(info?.icon));
        } catch {
          // keep existing candidates
        }
      }

      for (const candidate of candidates) {
        try {
          const normal = await app.getFileIcon(candidate, { size: 'normal' });
          if (normal && !normal.isEmpty()) {
            const dataUrl = normal.toDataURL();
            if (item) cacheFavoriteIconData(item.path, dataUrl);
            return dataUrl;
          }
        } catch {
          // try next candidate
        }
      }
      for (const candidate of candidates) {
        try {
          const large = await app.getFileIcon(candidate, { size: 'large' });
          if (large && !large.isEmpty()) {
            const dataUrl = large.toDataURL();
            if (item) cacheFavoriteIconData(item.path, dataUrl);
            return dataUrl;
          }
        } catch {
          // try next candidate
        }
      }
      return '';
    } catch (error) {
      console.error('[favorites-get-icon-error]', p, error);
      return '';
    }
  }

  function openWindow() {
    if (favoritesWindow && !favoritesWindow.isDestroyed()) {
      favoritesWindow.show();
      favoritesWindow.focus();
      return;
    }

    favoritesWindow = new BrowserWindow({
      width: 1100,
      height: 750,
      show: false,
      title: '收藏夹',
      icon: iconPath,
      autoHideMenuBar: true,
      resizable: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        webSecurity: false,
      },
    });

    favoritesWindow.once('ready-to-show', () => {
      if (!favoritesWindow || favoritesWindow.isDestroyed()) return;
      favoritesWindow.setMenuBarVisibility(false);
      favoritesWindow.show();
      broadcastFavoritesUpdate();
    });

    favoritesWindow.on('closed', () => {
      favoritesWindow = null;
    });

    loadPetRenderer(favoritesWindow, 'favorites');
  }

  function registerIpc(ipcMain) {
    ipcMain.handle('favorites:get-list', () => getFavoritesList());
    ipcMain.handle('favorites:add-paths', (_event, payload) => {
      const paths = Array.isArray(payload?.paths) ? payload.paths : [];
      const moveDesktopShortcuts = Boolean(payload?.moveDesktopShortcuts);
      return addFavoritesAndOptionallyMoveShortcuts(paths, moveDesktopShortcuts);
    });
    ipcMain.handle('favorites:remove', (_event, payload) => {
      return removeFavoriteByPath(payload?.path);
    });
    ipcMain.handle('favorites:open', (_event, payload) => {
      return openFavoritePath(payload?.path);
    });
    ipcMain.handle('favorites:get-icon', async (_event, payload) => {
      return getFavoriteIconDataUrl(payload?.path);
    });
    ipcMain.on('favorites:start-drag', (event, payload) => {
      try {
        const itemPath = String(payload?.path || '').trim().toLowerCase();
        if (!itemPath) return;
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow || senderWindow.isDestroyed()) return;
        const item = getFavoritesList().find((entry) => entry.path.toLowerCase() === itemPath);
        if (!item) return;
        const dragFile = ensureFavoriteDragFile(item);
        if (!dragFile) {
          console.warn('[favorites-start-drag-skip]', { reason: 'drag-file-missing', itemPath });
          return;
        }
        let icon = null;
        const iconDataUrl = String(payload?.iconDataUrl || '').trim();
        if (iconDataUrl.startsWith('data:image/')) {
          icon = nativeImage.createFromDataURL(iconDataUrl);
        }
        if (!icon || icon.isEmpty()) {
          icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon.png'));
        }
        senderWindow.webContents.startDrag({
          file: dragFile,
          icon: icon && !icon.isEmpty() ? icon : nativeImage.createEmpty(),
        });
      } catch (error) {
        console.error('[favorites-start-drag-error]', error);
      }
    });
  }

  function teardown() {
    if (!favoritesWindow || favoritesWindow.isDestroyed()) return;
    favoritesWindow.close();
    favoritesWindow = null;
  }

  return {
    openWindow,
    registerIpc,
    teardown,
  };
}
