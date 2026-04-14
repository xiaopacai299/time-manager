const { contextBridge, ipcRenderer, webUtils } = require('electron');

function normalizeDropPath(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (text.startsWith('file:///')) {
    try {
      return decodeURIComponent(text.replace('file:///', '')).replace(/\//g, '\\');
    } catch {
      return text.replace('file:///', '').replace(/\//g, '\\');
    }
  }
  return text;
}

contextBridge.exposeInMainWorld('timeManagerAPI', {
  getSnapshot: () => ipcRenderer.invoke('time-stats:get-snapshot'),
  getPetState: () => ipcRenderer.invoke('pet:get-state'),
  toggleClickThrough: () => ipcRenderer.invoke('pet:toggle-click-through'),
  toggleStatsPanel: () => ipcRenderer.invoke('pet:toggle-stats-panel'),
  toggleCompactMode: () => ipcRenderer.invoke('pet:toggle-compact-mode'),
  openStatsWindow: () => ipcRenderer.invoke('pet:open-stats-window'),
  getFavoritesList: () => ipcRenderer.invoke('favorites:get-list'),
  addFavoritesPaths: (paths, moveDesktopShortcuts) =>
    ipcRenderer.invoke('favorites:add-paths', { paths, moveDesktopShortcuts }),
  removeFavorite: (path) => ipcRenderer.invoke('favorites:remove', { path }),
  openFavorite: (path) => ipcRenderer.invoke('favorites:open', { path }),
  getFavoriteIcon: (path) => ipcRenderer.invoke('favorites:get-icon', { path }),
  startFavoriteDrag: (path, iconDataUrl) => ipcRenderer.send('favorites:start-drag', { path, iconDataUrl }),
  resolveDropPaths: (files, uriListText) => {
    const list = [];
    for (const file of Array.from(files || [])) {
      try {
        const p = webUtils.getPathForFile(file);
        if (p) list.push(p);
      } catch {
        // ignore invalid drop item
      }
    }
    if (list.length === 0 && typeof uriListText === 'string' && uriListText.trim()) {
      return uriListText
        .split(/\r?\n/)
        .map((line) => normalizeDropPath(line))
        .filter(Boolean);
    }
    return list;
  },
  openContextMenu: (x, y) => ipcRenderer.invoke('pet:open-context-menu', { x, y }),
  startDrag: (offsetX, offsetY) => ipcRenderer.send('pet:start-drag', { offsetX, offsetY }),
  endDrag: () => ipcRenderer.send('pet:end-drag'),
  dragBy: (dx, dy) => ipcRenderer.send('pet:drag-by', { dx, dy }),
  setTempInteractive: (active) => ipcRenderer.send('pet:set-temp-interactive', Boolean(active)),
  onUpdate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('time-stats:update', handler);
    return () => ipcRenderer.removeListener('time-stats:update', handler);
  },
  onPetStateChanged: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('pet:state-changed', handler);
    return () => ipcRenderer.removeListener('pet:state-changed', handler);
  },
  onPetAction: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('pet:action', handler);
    return () => ipcRenderer.removeListener('pet:action', handler);
  },
  onPetMotion: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('pet:motion', handler);
    return () => ipcRenderer.removeListener('pet:motion', handler);
  },
  onFavoritesUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('favorites:updated', handler);
    return () => ipcRenderer.removeListener('favorites:updated', handler);
  },
});
