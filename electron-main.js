import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, globalShortcut, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import fs from 'fs';
import { TimeMonitorService } from './main/time-monitor-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { uIOhook } = require('uiohook-napi');
let mainWindow;
let tray;
let dragTimer = null;
let followTimer = null;
let followBurstUntilTs = 0;
let globalMouseHookReady = false;
const dragState = {
  active: false,
  offsetX: 0,
  offsetY: 0,
  started: false,
};
const PET_WINDOW_WIDTH = 260;
const PET_WINDOW_HEIGHT = 280;
const PET_COMPACT_WIDTH = 190;
const PET_COMPACT_HEIGHT = 210;
const monitor = new TimeMonitorService({ sampleIntervalMs: 1000, breakThresholdSeconds: 600 });
const petState = {
  clickThrough: false,
  showStatsPanel: true,
  windowBounds: null,
  tempInteractive: false,
  compactMode: false,
  followMouse: false,
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
      petState.compactMode = Boolean(parsed.compactMode);
      petState.followMouse = Boolean(parsed.followMouse);
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
    width: bounds.width || (petState.compactMode ? PET_COMPACT_WIDTH : PET_WINDOW_WIDTH),
    height: bounds.height || (petState.compactMode ? PET_COMPACT_HEIGHT : PET_WINDOW_HEIGHT),
    x: bounds.x,
    y: bounds.y,
    minWidth: PET_COMPACT_WIDTH,
    minHeight: PET_COMPACT_HEIGHT,
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
      zoomFactor: 1.0,
    },
  });
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  applyMouseMode();

  mainWindow.webContents.setZoomFactor(1);
  mainWindow.webContents.setZoomLevel(0);
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (
      input.control &&
      (input.key === '+' || input.key === '-' || input.key === '=' || input.key === '0')
    ) {
      _event.preventDefault();
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(1);
    mainWindow.webContents.setZoomLevel(0);
  });

  mainWindow.loadURL('http://localhost:4567');

  mainWindow.on('resize', () => {
    if (mainWindow.isDestroyed()) return;
    const [tw, th] = getTargetSize();
    const [w, h] = mainWindow.getSize();
    if (w !== tw || h !== th) {
      mainWindow.setSize(tw, th);
    }
    mainWindow.webContents.setZoomFactor(1);
    mainWindow.webContents.setZoomLevel(0);
  });

  mainWindow.on('moved', () => {
    if (mainWindow.isDestroyed()) return;
    petState.windowBounds = mainWindow.getBounds();
    persistPetState();
    mainWindow.webContents.setZoomFactor(1);
    mainWindow.webContents.setZoomLevel(0);
  });

  mainWindow.on('close', () => {
    petState.windowBounds = mainWindow.getBounds();
    persistPetState();
  });
}

function getTargetSize() {
  return petState.compactMode
    ? [PET_COMPACT_WIDTH, PET_COMPACT_HEIGHT]
    : [PET_WINDOW_WIDTH, PET_WINDOW_HEIGHT];
}

function applyWindowMode() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [targetWidth, targetHeight] = getTargetSize();
  try {
    mainWindow.setSize(targetWidth, targetHeight, true);
  } catch (error) {
    console.error('[apply-window-mode-error]', error);
  }
}

function applyMouseMode() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const shouldIgnoreMouse = petState.clickThrough && !petState.tempInteractive;
  mainWindow.setIgnoreMouseEvents(shouldIgnoreMouse, { forward: true });
}

function stopFollowMouse() {
  if (followTimer) {
    clearInterval(followTimer);
    followTimer = null;
  }
  followBurstUntilTs = 0;
}

function startFollowMouse() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  stopFollowMouse();
  const speedFactor = 0.2;
  const maxStep = 22;
  followTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !petState.followMouse) return;
    if (Date.now() > followBurstUntilTs) return;
    if (dragState.active) return;
    const cursor = screen.getCursorScreenPoint();
    const [tw, th] = getTargetSize();
    const bounds = mainWindow.getBounds();
    const centerX = bounds.x + Math.round(bounds.width / 2);
    const centerY = bounds.y + Math.round(bounds.height / 2);
    const dx = cursor.x - centerX;
    const dy = cursor.y - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) return;
    const stepX = Math.max(-maxStep, Math.min(maxStep, dx * speedFactor));
    const stepY = Math.max(-maxStep, Math.min(maxStep, dy * speedFactor));
    mainWindow.setBounds({
      x: Math.round(bounds.x + stepX),
      y: Math.round(bounds.y + stepY),
      width: tw,
      height: th,
    });
  }, 16);
}

function triggerFollowBurst(durationMs = 1500) {
  if (!petState.followMouse) return false;
  followBurstUntilTs = Date.now() + Math.max(200, Number(durationMs) || 1500);
  if (!followTimer) startFollowMouse();
  return true;
}

function setupGlobalMouseHook() {
  if (globalMouseHookReady) return;
  try {
    uIOhook.on('mousedown', (event) => {
      // uiohook-napi: left button is 1
      if (event?.button !== 1) return;
      triggerFollowBurst(1500);
    });
    uIOhook.start();
    globalMouseHookReady = true;
  } catch (error) {
    console.error('[global-mouse-hook-error]', error);
  }
}

function teardownGlobalMouseHook() {
  if (!globalMouseHookReady) return;
  try {
    uIOhook.removeAllListeners('mousedown');
    uIOhook.stop();
  } catch (error) {
    console.error('[global-mouse-hook-stop-error]', error);
  } finally {
    globalMouseHookReady = false;
  }
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
        toggleClickThrough();
      },
    },
    {
      label: petState.compactMode ? '切换为展开模式' : '切换为紧凑模式',
      click: () => {
        toggleCompactMode();
      },
    },
    {
      label: petState.followMouse ? '关闭追鼠标模式' : '开启追鼠标模式',
      click: () => {
        toggleFollowMouse();
      },
    },
    {
      label: '动作测试',
      submenu: [
        { label: '待机 idle', click: () => emitPetAction('idle') },
        { label: '点头 nod', click: () => emitPetAction('nod') },
        { label: '困倦 sleep', click: () => emitPetAction('sleep') },
        { label: '庆祝 celebrate', click: () => emitPetAction('celebrate') },
        { label: '提醒 warn', click: () => emitPetAction('warn') },
      ],
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
    const traySvgPath = path.join(__dirname, 'assets', 'tray-icon.svg');
    const traySvgRaw = fs.readFileSync(traySvgPath, 'utf8');
    const trayDataUrl = `data:image/svg+xml;base64,${Buffer.from(traySvgRaw).toString('base64')}`;
    const image = nativeImage.createFromDataURL(trayDataUrl).resize({ width: 16, height: 16 });
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
      compactMode: petState.compactMode,
      followMouse: petState.followMouse,
    });
  }
  persistPetState();
  if (tray) tray.setContextMenu(buildTrayMenu());
  return petState.clickThrough;
}

function toggleCompactMode() {
  petState.compactMode = !petState.compactMode;
  applyWindowMode();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pet:state-changed', {
      clickThrough: petState.clickThrough,
      showStatsPanel: petState.showStatsPanel,
      compactMode: petState.compactMode,
      followMouse: petState.followMouse,
    });
  }
  persistPetState();
  if (tray) tray.setContextMenu(buildTrayMenu());
  return petState.compactMode;
}

function toggleFollowMouse() {
  petState.followMouse = !petState.followMouse;
  if (petState.followMouse) startFollowMouse();
  else stopFollowMouse();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pet:state-changed', {
      clickThrough: petState.clickThrough,
      showStatsPanel: petState.showStatsPanel,
      compactMode: petState.compactMode,
      followMouse: petState.followMouse,
    });
  }
  persistPetState();
  if (tray) tray.setContextMenu(buildTrayMenu());
  return petState.followMouse;
}

process.on('uncaughtException', (error) => {
  console.error('[main-uncaughtException]', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main-unhandledRejection]', reason);
});

function emitPetAction(action) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('pet:action', { action: String(action || '') });
}

function setupIpc() {
  ipcMain.handle('time-stats:get-snapshot', () => monitor.getSnapshot());
  ipcMain.handle('pet:get-state', () => ({
    clickThrough: petState.clickThrough,
    showStatsPanel: petState.showStatsPanel,
    compactMode: petState.compactMode,
    followMouse: petState.followMouse,
  }));
  ipcMain.handle('pet:toggle-click-through', () => {
    return toggleClickThrough();
  });
  ipcMain.handle('pet:toggle-stats-panel', () => {
    petState.showStatsPanel = !petState.showStatsPanel;
    persistPetState();
    return petState.showStatsPanel;
  });
  ipcMain.handle('pet:toggle-compact-mode', () => {
    return toggleCompactMode();
  });
  ipcMain.handle('pet:toggle-follow-mouse', () => {
    return toggleFollowMouse();
  });
  ipcMain.handle('pet:open-context-menu', (_event, payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const menu = Menu.buildFromTemplate([
      {
        label: petState.compactMode ? '切换为展开模式' : '切换为紧凑模式',
        click: () => toggleCompactMode(),
      },
      {
        label: petState.clickThrough ? '关闭鼠标穿透' : '开启鼠标穿透',
        click: () => toggleClickThrough(),
      },
      {
        label: petState.showStatsPanel ? '隐藏统计面板' : '显示统计面板',
        click: () => {
          petState.showStatsPanel = !petState.showStatsPanel;
          persistPetState();
          mainWindow.webContents.send('pet:state-changed', {
            clickThrough: petState.clickThrough,
            showStatsPanel: petState.showStatsPanel,
            compactMode: petState.compactMode,
            followMouse: petState.followMouse,
          });
        },
      },
      {
        label: petState.followMouse ? '关闭追鼠标模式' : '开启追鼠标模式',
        click: () => toggleFollowMouse(),
      },
      {
        label: '动作测试',
        submenu: [
          { label: '待机 idle', click: () => emitPetAction('idle') },
          { label: '点头 nod', click: () => emitPetAction('nod') },
          { label: '困倦 sleep', click: () => emitPetAction('sleep') },
          { label: '庆祝 celebrate', click: () => emitPetAction('celebrate') },
          { label: '提醒 warn', click: () => emitPetAction('warn') },
        ],
      },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]);
    menu.popup({
      window: mainWindow,
      x: Number(payload?.x) || undefined,
      y: Number(payload?.y) || undefined,
    });
  });
  ipcMain.on('pet:set-temp-interactive', (_event, active) => {
    petState.tempInteractive = Boolean(active);
    applyMouseMode();
  });
  ipcMain.on('pet:start-drag', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (dragTimer) { clearInterval(dragTimer); dragTimer = null; }

    const startCursor = screen.getCursorScreenPoint();
    const winBounds = mainWindow.getBounds();
    dragState.active = true;
    dragState.offsetX = startCursor.x - winBounds.x;
    dragState.offsetY = startCursor.y - winBounds.y;
    dragState.started = false;

    const [tw, th] = getTargetSize();
    dragTimer = setInterval(() => {
      if (!dragState.active || !mainWindow || mainWindow.isDestroyed()) return;
      const cursor = screen.getCursorScreenPoint();
      if (!dragState.started) {
        const dx = Math.abs(cursor.x - startCursor.x);
        const dy = Math.abs(cursor.y - startCursor.y);
        if (dx < 3 && dy < 3) return;
        dragState.started = true;
      }
      mainWindow.setBounds({
        x: Math.round(cursor.x - dragState.offsetX),
        y: Math.round(cursor.y - dragState.offsetY),
        width: tw,
        height: th,
      });
    }, 16);
  });
  ipcMain.on('pet:end-drag', () => {
    dragState.active = false;
    if (dragTimer) {
      clearInterval(dragTimer);
      dragTimer = null;
    }
  });
  ipcMain.on('pet:drag-by', (_event, delta) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const bounds = mainWindow.getBounds();
    const [tw, th] = getTargetSize();
    mainWindow.setBounds({
      x: bounds.x + Number(delta?.dx || 0),
      y: bounds.y + Number(delta?.dy || 0),
      width: tw,
      height: th,
    });
  });
}

app.whenReady().then(() => {
  loadPetState();
  // Keep startup behavior predictable: always start with click-through disabled.
  petState.clickThrough = false;
  petState.tempInteractive = false;
  setupIpc();
  createMainWindow();
  applyWindowMode();
  createTray();
  setupGlobalMouseHook();
  if (petState.followMouse) startFollowMouse();
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
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
  stopFollowMouse();
  teardownGlobalMouseHook();
  globalShortcut.unregisterAll();
  persistPetState();
  monitor.stop();
});