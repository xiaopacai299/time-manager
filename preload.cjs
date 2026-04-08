const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('timeManagerAPI', {
  getSnapshot: () => ipcRenderer.invoke('time-stats:get-snapshot'),
  onUpdate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('time-stats:update', handler);
    return () => ipcRenderer.removeListener('time-stats:update', handler);
  },
});
