import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  globalShortcut,
  screen,
} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import { TimeMonitorService } from './main/time-monitor-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/** 惰性加载：未安装 Python/VS 构建链或二进制与 Electron 不匹配时仍可启动（仅失去「追鼠标」全局左键触发）。 */
let uIOhookCached;
function getUIOhook() {
  if (uIOhookCached !== undefined) return uIOhookCached;
  try {
    uIOhookCached = require('uiohook-napi').uIOhook;
  } catch (error) {
    console.error('[uiohook-load-error]', error);
    uIOhookCached = null;
  }
  return uIOhookCached;
}

let mainWindow;
let statsWindow = null;
let tray;
let dragTimer = null;
let followTimer = null;
let globalMouseHookReady = false;
const followTarget = {
  active: false,
  x: 0,
  y: 0,
};
/** 宠物右键菜单弹出期间，以及关闭后极短时间内，忽略全局左键触发的追鼠标 */
let petContextMenuOpen = false;
let suppressFollowMouseUntil = 0;
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
const PET_RENDERER_ORIGIN = 'http://localhost:4567';
const STATS_DETAIL_WINDOW_WIDTH = 650;
const STATS_DETAIL_WINDOW_HEIGHT = 800;

const petIndexHtmlPath = path.join(__dirname, 'dist', 'index.html');

function appendLaunchLog(line) {
  try {
    let dir;
    try {
      dir = app.getPath('userData');
    } catch {
      dir = os.tmpdir();
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'launch.log'), `${new Date().toISOString()} ${line}\n`, 'utf8');
  } catch {
    // ignore
  }
}

process.on('uncaughtException', (err) => {
  appendLaunchLog(`uncaughtException: ${err?.stack || err}`);
  try {
    dialog.showErrorBox('Time Pet 异常退出', String(err?.message || err));
  } catch {
    // ignore
  }
});

process.on('unhandledRejection', (reason) => {
  appendLaunchLog(`unhandledRejection: ${reason}`);
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (statsWindow && !statsWindow.isDestroyed()) {
      statsWindow.show();
      statsWindow.focus();
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

/** 开发态走本地 Vite；安装包内从 dist 以 file:// 加载（勿再用 localhost:4567）。 */
function loadPetRenderer(win, hash) {
  if (app.isPackaged) {
    if (!fs.existsSync(petIndexHtmlPath)) {
      const msg = `未找到界面文件：\n${petIndexHtmlPath}\n请确认使用「npm run build」后再打包。`;
      appendLaunchLog(`missing dist: ${petIndexHtmlPath}`);
      dialog.showErrorBox('Time Pet 无法启动', msg);
      return;
    }
    const h = hash ? String(hash).replace(/^#/, '') : '';
    if (h) win.loadFile(petIndexHtmlPath, { hash: h });
    else win.loadFile(petIndexHtmlPath);
    return;
  }
  const url = hash
    ? `${PET_RENDERER_ORIGIN}/#${String(hash).replace(/^#/, '')}`
    : `${PET_RENDERER_ORIGIN}/`;
  win.loadURL(url);
}

function refreshTrayMenu() {
  if (tray) tray.setContextMenu(buildTrayMenu());
}

/** 通知渲染进程：追鼠标时用奔跑 Lottie；mirrorX 表示水平翻转（朝左），不用旋转避免颠倒 */
function sendPetMotion(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const wc = mainWindow.webContents;
  if (!wc || wc.isDestroyed()) return;
  wc.send('pet:motion', payload);
}

function resetPetDragState() {
  dragState.active = false;
  dragState.started = false;
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
  sendPetMotion({ running: false, mirrorX: false });
}

function openStatsDetailWindow() {
  if (statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.show();
    statsWindow.focus();
    return;
  }

  resetPetDragState();

  statsWindow = new BrowserWindow({
    width: STATS_DETAIL_WINDOW_WIDTH,
    height: STATS_DETAIL_WINDOW_HEIGHT,
    show: false,
    title: '使用统计',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      // 与开发态一致；file:// + 透明窗下 webSecurity:true 易导致 Lottie/画布不绘制
      webSecurity: false,
    },
  });

  statsWindow.once('ready-to-show', () => {
    if (statsWindow && !statsWindow.isDestroyed()) statsWindow.show();
  });

  loadPetRenderer(statsWindow, 'stats');

  statsWindow.on('closed', () => {
    statsWindow = null;
    refreshTrayMenu();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
  refreshTrayMenu();
}
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

function defaultPetCornerBounds(width, height) {
  const primary = screen.getPrimaryDisplay();
  const wa = primary.workArea;
  const margin = 16;
  return {
    x: wa.x + wa.width - width - margin,
    y: wa.y + wa.height - height - margin,
    width,
    height,
  };
}

/** 若窗口与任一显示器工作区不相交（例如外接屏拔掉后坐标失效），则摆回主屏右下角。 */
function clampPetBoundsToVisibleDisplay(x, y, width, height) {
  const displays = screen.getAllDisplays();
  const intersects = displays.some((d) => {
    const wa = d.workArea;
    return x + width > wa.x && x < wa.x + wa.width && y + height > wa.y && y < wa.y + wa.height;
  });
  if (intersects) {
    return { x, y, width, height };
  }
  return defaultPetCornerBounds(width, height);
}

/** 解析创建窗口时的位置与尺寸；必要时修正并标记是否写回状态文件。 */
function resolveInitialPetWindowBounds() {
  const [width, height] = getTargetSize();
  const saved = petState.windowBounds;
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) {
    return { ...defaultPetCornerBounds(width, height), didAdjust: true };
  }
  const next = clampPetBoundsToVisibleDisplay(saved.x, saved.y, width, height);
  const didAdjust = next.x !== saved.x || next.y !== saved.y;
  return { ...next, didAdjust };
}

function createMainWindow() {
  const initial = resolveInitialPetWindowBounds();
  if (initial.didAdjust) {
    petState.windowBounds = {
      x: initial.x,
      y: initial.y,
      width: initial.width,
      height: initial.height,
    };
    persistPetState();
  }

  mainWindow = new BrowserWindow({
    width: initial.width,
    height: initial.height,
    x: initial.x,
    y: initial.y,
    minWidth: PET_COMPACT_WIDTH,
    minHeight: PET_COMPACT_HEIGHT,
    maxWidth: 420,
    maxHeight: 540,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      zoomFactor: 1.0,
      // 与开发态一致；file:// + 透明窗下 webSecurity:true 易导致 Lottie/画布不绘制
      webSecurity: false,
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

  if (app.isPackaged) {
    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      const msg = `错误码 ${code}\n${desc}\n${url}`;
      appendLaunchLog(`did-fail-load: ${msg}`);
      dialog.showErrorBox('Time Pet 页面加载失败', msg);
    });
  }

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // show() 在 Windows 上比 showInactive 更可靠，避免窗口在屏外或层级异常时「存在但看不见」
    mainWindow.show();
  });

  loadPetRenderer(mainWindow);

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
  followTarget.active = false;
  sendPetMotion({ running: false, mirrorX: false });
}

function startFollowMouse() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  stopFollowMouse();
  const speedFactor = 0.2;
  const maxStep = 22;
  followTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !petState.followMouse) return;
    if (!followTarget.active) return;
    if (dragState.active) return;
    const [tw, th] = getTargetSize();
    const bounds = mainWindow.getBounds();
    const centerX = bounds.x + Math.round(bounds.width / 2);
    const centerY = bounds.y + Math.round(bounds.height / 2);
    const dx = followTarget.x - centerX;
    const dy = followTarget.y - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      followTarget.active = false;
      sendPetMotion({ running: false, mirrorX: false });
      return;
    }
    // 原画默认朝右：光标在窗口右侧 (dx>0) 时水平翻转。与上一版相反时改回 dx < 0
    const mirrorX = dx > 0;
    sendPetMotion({ running: true, mirrorX });
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

function triggerFollowBurst() {
  if (!petState.followMouse) return false;
  if (petContextMenuOpen) return false;
  if (Date.now() < suppressFollowMouseUntil) return false;
  if (followTarget.active) return false;
  const cursor = screen.getCursorScreenPoint();
  followTarget.x = cursor.x;
  followTarget.y = cursor.y;
  followTarget.active = true;
  if (!followTimer) startFollowMouse();
  return true;
}

function setupGlobalMouseHook() {
  if (globalMouseHookReady) return;
  const hook = getUIOhook();
  if (!hook) return;
  try {
    hook.on('mousedown', (event) => {
      // uiohook-napi: left button is 1
      if (event?.button !== 1) return;
      triggerFollowBurst();
    });
    hook.start();
    globalMouseHookReady = true;
  } catch (error) {
    console.error('[global-mouse-hook-error]', error);
  }
}

function teardownGlobalMouseHook() {
  if (!globalMouseHookReady) return;
  const hook = getUIOhook();
  try {
    if (hook) {
      hook.removeAllListeners('mousedown');
      hook.stop();
    }
  } catch (error) {
    console.error('[global-mouse-hook-stop-error]', error);
  } finally {
    globalMouseHookReady = false;
  }
}

function buildTrayMenu() {
  const statsOpen = Boolean(statsWindow && !statsWindow.isDestroyed());
  return Menu.buildFromTemplate([
    {
      label: statsOpen ? '关闭统计窗口' : mainWindow?.isVisible() ? '隐藏宠物' : '显示宠物',
      click: () => {
        if (statsOpen) {
          statsWindow.close();
          return;
        }
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
    const trayPngPath = path.join(__dirname, 'assets', 'tray-icon.png');
    const traySvgPath = path.join(__dirname, 'assets', 'tray-icon.svg');
    let image = nativeImage.createFromPath(trayPngPath);
    if (image.isEmpty()) {
      const traySvgRaw = fs.readFileSync(traySvgPath, 'utf8');
      const trayDataUrl = `data:image/svg+xml;base64,${Buffer.from(traySvgRaw).toString('base64')}`;
      image = nativeImage.createFromDataURL(trayDataUrl);
    }
    if (image.isEmpty()) {
      throw new Error('Tray icon image is empty for both PNG and SVG');
    }
    image = image.resize({ width: 16, height: 16 });
    tray = new Tray(image);
    // 隐藏栏应用名称
    tray.setToolTip('时间小精灵');
    tray.setContextMenu(buildTrayMenu());
    tray.on('click', () => {
      if (statsWindow && !statsWindow.isDestroyed()) {
        statsWindow.show();
        statsWindow.focus();
        return;
      }
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
  ipcMain.handle('pet:open-stats-window', () => {
    openStatsDetailWindow();
    return true;
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
        label: petState.followMouse ? '关闭猫捉老鼠' : '猫捉老鼠',
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
    petContextMenuOpen = true;
    menu.popup({
      window: mainWindow,
      x: Number(payload?.x) || undefined,
      y: Number(payload?.y) || undefined,
      callback: () => {
        petContextMenuOpen = false;
        suppressFollowMouseUntil = Date.now() + 280;
      },
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
    const chasing = petState.followMouse && followTarget.active;
    if (!chasing) {
      sendPetMotion({ running: false, mirrorX: false });
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
  if (!gotSingleInstanceLock) return;

  try {
    appendLaunchLog('app ready, starting main flow');
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
      if (statsWindow && !statsWindow.isDestroyed()) {
        statsWindow.webContents.send('time-stats:update', payload);
      }
    });
  } catch (err) {
    appendLaunchLog(`whenReady error: ${err?.stack || err}`);
    dialog.showErrorBox('Time Pet 启动失败', String(err?.message || err));
    app.quit();
  }
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