const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('timeManagerAPI', {
  getSnapshot: () => ipcRenderer.invoke('time-stats:get-snapshot'),
  getPetState: () => ipcRenderer.invoke('pet:get-state'),
  toggleClickThrough: () => ipcRenderer.invoke('pet:toggle-click-through'),
  toggleStatsPanel: () => ipcRenderer.invoke('pet:toggle-stats-panel'),
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
});
