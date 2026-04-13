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

contextBridge.exposeInMainWorld('favoritesAPI', {
  getList: () => ipcRenderer.invoke('favorites:get-list'),
  addPaths: (paths, moveDesktopShortcuts) => ipcRenderer.invoke('favorites:add-paths', { paths, moveDesktopShortcuts }),
  remove: (path) => ipcRenderer.invoke('favorites:remove', { path }),
  open: (path) => ipcRenderer.invoke('favorites:open', { path }),
  getIcon: (path) => ipcRenderer.invoke('favorites:get-icon', { path }),
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
      const uriItems = uriListText
        .split(/\r?\n/)
        .map((line) => normalizeDropPath(line))
        .filter(Boolean);
      return uriItems;
    }
    return list;
  },
  onUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('favorites:updated', handler);
    return () => ipcRenderer.removeListener('favorites:updated', handler);
  },
});
