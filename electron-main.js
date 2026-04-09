import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, globalShortcut } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { TimeMonitorService } from './main/time-monitor-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow;
let tray;
const PET_WINDOW_WIDTH = 260;
const PET_WINDOW_HEIGHT = 280;
const monitor = new TimeMonitorService({ sampleIntervalMs: 1000, breakThresholdSeconds: 600 });
const petState = {
  clickThrough: false,
  showStatsPanel: true,
  windowBounds: null,
  tempInteractive: false,
};

function getStateFilePath() {
  return path.join(app.getPath('userData'), 'pet-window-state.json');
}

function loadPetState() {
  try {
    const raw = fs.readFileSync(getStateFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      petState.clickThrough = Boolean(parsed.clickThrough);
      petState.showStatsPanel = parsed.showStatsPanel !== false;
      petState.windowBounds = parsed.windowBounds || null;
    }
  } catch {
    // Use defaults when state file does not exist.
  }
}

function persistPetState() {
  try {
    fs.writeFileSync(getStateFilePath(), JSON.stringify(petState, null, 2), 'utf8');
  } catch {
    // Ignore persistence errors to keep app resilient.
  }
}

function createMainWindow() {
  const bounds = petState.windowBounds || {};
  mainWindow = new BrowserWindow({
    width: bounds.width || PET_WINDOW_WIDTH,
    height: bounds.height || PET_WINDOW_HEIGHT,
    x: bounds.x,
    y: bounds.y,
    minWidth: PET_WINDOW_WIDTH,
    minHeight: PET_WINDOW_HEIGHT,
    maxWidth: 420,
    maxHeight: 540,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
    },
  });
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  applyMouseMode();
  mainWindow.loadURL('http://localhost:4567');

  mainWindow.on('moved', () => {
    petState.windowBounds = mainWindow.getBounds();
    persistPetState();
  });

  mainWindow.on('close', () => {
    petState.windowBounds = mainWindow.getBounds();
    persistPetState();
  });
}

function applyMouseMode() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const shouldIgnoreMouse = petState.clickThrough && !petState.tempInteractive;
  mainWindow.setIgnoreMouseEvents(shouldIgnoreMouse, { forward: true });
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: mainWindow?.isVisible() ? '隐藏宠物' : '显示宠物',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) mainWindow.hide();
        else mainWindow.show();
      },
    },
    {
      label: petState.clickThrough ? '关闭鼠标穿透' : '开启鼠标穿透',
      click: () => {
        if (!mainWindow) return;
        petState.clickThrough = !petState.clickThrough;
        mainWindow.setIgnoreMouseEvents(petState.clickThrough, { forward: true });
        persistPetState();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit(),
    },
  ]);
}

function createTray() {
  try {
    const image = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAIklEQVR4AWP4z8Dwn4GJgYGB4T8DA8N/BiYGBgYGABMMAz0kR6Q6AAAAAElFTkSuQmCC',
    );
    tray = new Tray(image);
    tray.setToolTip('Time Manager Pet');
    tray.setContextMenu(buildTrayMenu());
    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) mainWindow.focus();
      else mainWindow.show();
    });
  } catch (error) {
    // Avoid hard crash in main process if tray is unavailable.
    console.error('[tray-init-error]', error);
  }
}

function toggleClickThrough() {
  petState.clickThrough = !petState.clickThrough;
  if (mainWindow && !mainWindow.isDestroyed()) {
    applyMouseMode();
    mainWindow.webContents.send('pet:state-changed', {
      clickThrough: petState.clickThrough,
      showStatsPanel: petState.showStatsPanel,
    });
  }
  persistPetState();
  if (tray) tray.setContextMenu(buildTrayMenu());
  return petState.clickThrough;
}

function setupIpc() {
  ipcMain.handle('time-stats:get-snapshot', () => monitor.getSnapshot());
  ipcMain.handle('pet:get-state', () => ({
    clickThrough: petState.clickThrough,
    showStatsPanel: petState.showStatsPanel,
  }));
  ipcMain.handle('pet:toggle-click-through', () => {
    return toggleClickThrough();
  });
  ipcMain.handle('pet:toggle-stats-panel', () => {
    petState.showStatsPanel = !petState.showStatsPanel;
    persistPetState();
    return petState.showStatsPanel;
  });
  ipcMain.on('pet:set-temp-interactive', (_event, active) => {
    petState.tempInteractive = Boolean(active);
    applyMouseMode();
  });
  ipcMain.on('pet:drag-by', (_event, delta) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const { x, y } = mainWindow.getBounds();
    const nextX = x + Number(delta?.dx || 0);
    const nextY = y + Number(delta?.dy || 0);
    mainWindow.setPosition(nextX, nextY);
  });
}

app.whenReady().then(() => {
  loadPetState();
  setupIpc();
  createMainWindow();
  createTray();
  monitor.start();
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    toggleClickThrough();
  });

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
  globalShortcut.unregisterAll();
  persistPetState();
  monitor.stop();
});