import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { TimeMonitorService } from './main/time-monitor-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow;
const monitor = new TimeMonitorService({ sampleIntervalMs: 1000, breakThresholdSeconds: 600 });

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
    },
  });
  mainWindow.loadURL('http://localhost:5173');
}

function setupIpc() {
  ipcMain.handle('time-stats:get-snapshot', () => monitor.getSnapshot());
}

app.whenReady().then(() => {
  setupIpc();
  createMainWindow();
  monitor.start();

  monitor.on('update', (payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('time-stats:update', payload);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  monitor.stop();
});