import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  Notification,
  shell,
  Tray,
  nativeImage,
  globalShortcut,
  screen,
} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import { TimeMonitorService } from './main/time-monitor-service.js';
import { createWorklistModule } from './main/electron/worklist-module.js';
import { createFavoritesModule } from './main/electron/favorites-module.js';
import { createMenuModule } from './main/electron/menu-module.js';
import { createPetMotionModule } from './main/electron/pet-motion-module.js';

// 主进程默认阈值（毫秒）。不要依赖 src 目录，避免打包后模块缺失。
const REMIND_CONTINUOUS_MS = 25 * 60 * 1000;
const LONG_WORK_CONTINUOUS_MS = 50 * 60 * 1000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/**
 * Main 进程入口文件（编排层）：
 * - 负责应用生命周期、窗口创建、IPC 入口与模块装配
 * - 业务细节尽量下沉到 main/electron/* 模块
 */

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
let settingsWindow = null;
let worklistReminderTimer = null;
const PET_WINDOW_WIDTH = 260;
const PET_WINDOW_HEIGHT = 280;
const PET_COMPACT_WIDTH = 190;
const PET_COMPACT_HEIGHT = 210;
const PET_RENDERER_ORIGIN = 'http://localhost:4567';
const STATS_DETAIL_WINDOW_WIDTH = 650;
const STATS_DETAIL_WINDOW_HEIGHT = 800;
const APP_ICON_CANDIDATES = [
  path.join(__dirname, 'build', 'icon.ico'),
  path.join(__dirname, 'build', 'icon.png'),
  path.join(__dirname, 'assets', 'tray-icon.png'),
];
const APP_ICON_PATH = APP_ICON_CANDIDATES.find((p) => fs.existsSync(p)) || APP_ICON_CANDIDATES[2];

const petIndexHtmlPath = path.join(__dirname, 'dist', 'index.html');

/** 启动诊断日志：用于排查打包后白屏/加载失败等问题。 */
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
  // 第二实例只负责激活已有窗口，避免重复启动主流程。
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
  menuModule.refreshTrayMenu();
}

/** 统计详情窗口：打开时隐藏宠物窗口，关闭后恢复显示。 */
function openStatsDetailWindow() {
  if (statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.show();
    statsWindow.focus();
    return;
  }

  petMotionModule.resetDragState();
  // 当创建了这个时，会启动预加载脚本（比普通js权限高，能使用electronAPI）
  // 作为页面和系统的桥接层
  statsWindow = new BrowserWindow({
    width: STATS_DETAIL_WINDOW_WIDTH,
    height: STATS_DETAIL_WINDOW_HEIGHT,
    show: false,
    title: '使用统计',
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    // window.timeManager挂载，在页面中被消费
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      // 与开发态一致；file:// + 透明窗下 webSecurity:true 易导致 Lottie/画布不绘制
      webSecurity: false,
    },
  });

  statsWindow.once('ready-to-show', () => {
    if (!statsWindow || statsWindow.isDestroyed()) return;
    statsWindow.setMenuBarVisibility(false);
    statsWindow.show();
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
// 监控前台
const monitor = new TimeMonitorService({ sampleIntervalMs: 1000, breakThresholdSeconds: 600 });
/** 主状态对象：持久化与跨模块共享的单一事实来源。 */
const petState = {
  clickThrough: false,
  showStatsPanel: true,
  windowBounds: null,
  tempInteractive: false,
  compactMode: false,
  followMouse: false,
  /** 桌面随机乱跑；不写入状态文件 */
  chaosCat: false,
  favorites: [],
  /** @type {Array<Record<string, unknown>>} */
  worklist: [],
  /** 工作清单窗口「备忘录」多条记录（提醒时间 + 正文） */
  memoList: [],
  petSettings: {
    selectedPet: 'black-coal',
    bubbleTexts: {
      work: '',
      rest: '',
      remind: '',
      'long-work': '',
    },
    // 宠物形态切换阈值（毫秒）
    remindContinuousMs: REMIND_CONTINUOUS_MS,
    longWorkContinuousMs: LONG_WORK_CONTINUOUS_MS,
  },
};

function getStateFilePath() {
  return path.join(app.getPath('userData'), 'pet-window-state.json');
}

/** 启动时加载持久化状态；失败时回退到默认值。 */
// 从用户目录里读 pet-window-state.json：上次宠物窗口在哪、收藏夹、工作清单等。
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
      petState.favorites = Array.isArray(parsed.favorites) ? parsed.favorites : [];
      petState.worklist = Array.isArray(parsed.worklist) ? parsed.worklist : [];
      if (Array.isArray(parsed.memoList)) {
        petState.memoList = parsed.memoList;
      } else if (typeof parsed.worklistMemo === 'string' && parsed.worklistMemo.trim()) {
        petState.memoList = [
          {
            id: `memo-migrated-${Date.now()}`,
            name: '备忘录（迁移）',
            icon: '📝',
            content: parsed.worklistMemo.slice(0, 50000),
            reminderAt: '',
            reminderNotified: true,
            createdAt: new Date().toISOString(),
          },
        ];
      } else {
        petState.memoList = [];
      }
      if (parsed.petSettings && typeof parsed.petSettings === 'object') {
        const bubbleTextsRaw = parsed.petSettings.bubbleTexts || {};
        const remindContinuousMs = Number.isFinite(Number(parsed.petSettings.remindContinuousMs))
          ? Number(parsed.petSettings.remindContinuousMs)
          : REMIND_CONTINUOUS_MS;
        const longWorkContinuousMs = Number.isFinite(Number(parsed.petSettings.longWorkContinuousMs))
          ? Number(parsed.petSettings.longWorkContinuousMs)
          : LONG_WORK_CONTINUOUS_MS;
        petState.petSettings = {
          selectedPet: String(parsed.petSettings.selectedPet || 'black-coal'),
          bubbleTexts: {
            work: String(bubbleTextsRaw.work || ''),
            rest: String(bubbleTextsRaw.rest || ''),
            remind: String(bubbleTextsRaw.remind || ''),
            'long-work': String(bubbleTextsRaw['long-work'] || ''),
          },
          remindContinuousMs,
          longWorkContinuousMs,
        };
      }
    }
  } catch {
    // Use defaults when state file does not exist.
  }
}

function buildPetStatePayload() {
  return {
    clickThrough: petState.clickThrough,
    showStatsPanel: petState.showStatsPanel,
    compactMode: petState.compactMode,
    followMouse: petState.followMouse,
    petSettings: petState.petSettings,
  };
}

function broadcastPetStateChanged() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('pet:state-changed', buildPetStatePayload());
}

function persistPetState() {
  try {
    const persistable = { ...petState };
    delete persistable.chaosCat;
    fs.writeFileSync(getStateFilePath(), JSON.stringify(persistable, null, 2), 'utf8');
  } catch {
    // Ignore persistence errors to keep app resilient.
  }
}

// 工作清单模块：负责窗口、数据校验、提醒通知及 IPC。
const worklistModule = createWorklistModule({
  petState,
  persistPetState,
  BrowserWindow,
  Notification,
  iconPath: APP_ICON_PATH,
  path,
  __dirname,
  loadPetRenderer,
});

// 收藏夹模块：负责收藏数据、图标、拖拽与窗口。
const favoritesModule = createFavoritesModule({
  petState,
  persistPetState,
  app,
  BrowserWindow,
  shell,
  nativeImage,
  path,
  fs,
  createHash,
  iconPath: APP_ICON_PATH,
  __dirname,
  loadPetRenderer,
});

// 菜单模块：托盘菜单与宠物右键菜单统一从这里创建。
const menuModule = createMenuModule({
  Menu,
  Tray,
  nativeImage,
  path,
  fs,
  __dirname,
  app,
  getMainWindow: () => mainWindow,
  getStatsWindow: () => statsWindow,
  getPetState: () => petState,
  onToggleFollowMouse: () => toggleFollowMouse(),
  onToggleChaosCat: () => toggleChaosCat(),
  onOpenFavorites: () => favoritesModule.openWindow(),
  onOpenWorklist: () => worklistModule.openWindow(),
  onOpenSettings: () => openSettingsWindow(),
  onEmitPetAction: (action) => emitPetAction(action),
});

// 宠物运动模块：管理拖拽、追鼠标、捣乱模式、全局鼠标 Hook 及相关 IPC。
const petMotionModule = createPetMotionModule({
  petState,
  screen,
  getUIOhook,
  getMainWindow: () => mainWindow,
  getTargetSize,
});



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

// 创建宠物
function createMainWindow() {
  // 先修复无效坐标（如外接屏拔掉），再创建透明宠物窗口。
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
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
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
    mainWindow.setMenuBarVisibility(false);
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
  // clickThrough=true 且不是临时交互态时，让窗口穿透鼠标事件。
  const shouldIgnoreMouse = petState.clickThrough && !petState.tempInteractive;
  mainWindow.setIgnoreMouseEvents(shouldIgnoreMouse, { forward: true });
}

/** 以下四个 toggle 是 UI 动作入口：更新状态 -> 通知渲染层 -> 持久化 -> 刷新菜单 */
function toggleClickThrough() {
  petState.clickThrough = !petState.clickThrough;
  if (mainWindow && !mainWindow.isDestroyed()) {
    applyMouseMode();
    broadcastPetStateChanged();
  }
  persistPetState();
  menuModule.refreshTrayMenu();
  return petState.clickThrough;
}

function toggleFollowMouse() {
  petState.followMouse = !petState.followMouse;
  if (petState.followMouse) {
    petMotionModule.stopChaosCat();
    petMotionModule.startFollowMouse();
  } else {
    petMotionModule.stopFollowMouse();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    broadcastPetStateChanged();
  }
  persistPetState();
  menuModule.refreshTrayMenu();
  return petState.followMouse;
}

function toggleChaosCat() {
  if (petState.chaosCat) {
    petMotionModule.stopChaosCat();
  } else {
    if (petState.followMouse) {
      petState.followMouse = false;
      petMotionModule.stopFollowMouse();
    }
    petMotionModule.startChaosCat();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    broadcastPetStateChanged();
  }
  persistPetState();
  menuModule.refreshTrayMenu();
  return petState.chaosCat;
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

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 760,
    height: 800,
    show: false,
    title: '设置',
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      webSecurity: false,
    },
  });
  settingsWindow.once('ready-to-show', () => {
    if (!settingsWindow || settingsWindow.isDestroyed()) return;
    settingsWindow.setMenuBarVisibility(false);
    settingsWindow.show();
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  loadPetRenderer(settingsWindow, 'settings');
}

function setupIpc() {
  // IPC 注册统一放在这里，按模块分组便于维护与定位。
  // 1) 宠物基础状态与模式切换
  ipcMain.handle('time-stats:get-snapshot', () => monitor.getSnapshot());
  ipcMain.handle('pet:get-state', () => ({
    ...buildPetStatePayload(),
  }));
  ipcMain.handle('pet:toggle-stats-panel', () => {
    petState.showStatsPanel = !petState.showStatsPanel;
    persistPetState();
    return petState.showStatsPanel;
  });
  ipcMain.handle('pet:toggle-follow-mouse', () => {
    return toggleFollowMouse();
  });
  ipcMain.handle('pet:open-stats-window', () => {
    openStatsDetailWindow();
    return true;
  });
  ipcMain.handle('pet-settings:get', () => petState.petSettings);
  ipcMain.handle('pet-settings:update', (_event, payload) => {
    const input = payload && typeof payload === 'object' ? payload : {};
    const bubbleTextsRaw =
      input.bubbleTexts && typeof input.bubbleTexts === 'object' ? input.bubbleTexts : {};
    const remindContinuousMs = Number.isFinite(Number(input.remindContinuousMs))
      ? Math.max(0, Number(input.remindContinuousMs))
      : petState.petSettings.remindContinuousMs ?? REMIND_CONTINUOUS_MS;
    const longWorkContinuousMs = Number.isFinite(Number(input.longWorkContinuousMs))
      ? Math.max(0, Number(input.longWorkContinuousMs))
      : petState.petSettings.longWorkContinuousMs ?? LONG_WORK_CONTINUOUS_MS;
    petState.petSettings = {
      selectedPet: String(input.selectedPet || petState.petSettings.selectedPet || 'black-coal'),
      bubbleTexts: {
        work: String(bubbleTextsRaw.work ?? petState.petSettings?.bubbleTexts?.work ?? '').slice(0, 120),
        rest: String(bubbleTextsRaw.rest ?? petState.petSettings?.bubbleTexts?.rest ?? '').slice(0, 120),
        remind: String(bubbleTextsRaw.remind ?? petState.petSettings?.bubbleTexts?.remind ?? '').slice(0, 120),
        'long-work': String(
          bubbleTextsRaw['long-work'] ?? petState.petSettings?.bubbleTexts?.['long-work'] ?? '',
        ).slice(0, 120),
      },
      remindContinuousMs,
      longWorkContinuousMs,
    };
    persistPetState();
    broadcastPetStateChanged();
    return { ok: true, petSettings: petState.petSettings };
  });

  // 2) 收藏夹模块
  favoritesModule.registerIpc(ipcMain);

  // 3) 工作清单模块（已拆分至独立文件）
  worklistModule.registerIpc(ipcMain);
  // 4) 宠物运动模块（拖拽/跟随/捣乱/Hook）
  petMotionModule.registerIpc(ipcMain);
  // 宠物上的右键菜单
  ipcMain.handle('pet:open-context-menu', (_event, payload) => {
    petMotionModule.setContextMenuActive(true);
    menuModule.openContextMenu(payload, () => {
      petMotionModule.setContextMenuActive(false);
    });
  });
  ipcMain.on('pet:set-temp-interactive', (_event, active) => {
    petState.tempInteractive = Boolean(active);
    applyMouseMode();
  });
}

// 一、程序从这里开始运行
app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;

  try {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.timemanager.pet');
    }
    appendLaunchLog('app ready, starting main flow');
    // 二、从用户目录中读取之前的状态
    loadPetState();
    // Keep startup behavior predictable: always start with click-through disabled.
    petState.clickThrough = false;
    petState.tempInteractive = false;
    // 三、将渲染进程调用的接口注册，
    // 统计快照，宠物状态，收藏夹，拖拽，工作清单
    // 这些接口在 preload.cjs 里挂到 window.timeManagerAPI 上，前端才能用
    setupIpc();
    // 四、创建桌面宠物的透明窗口
    // 加载 Vite 页面（开发态是 localhost:4567，打包后是 dist/index.html）
    createMainWindow();
    applyWindowMode();
    // 五、托盘图标、托盘右键菜单
    menuModule.setup();
    // 六、全局鼠标hook
    // 宠物拖拽相关逻辑
    petMotionModule.setup();
    if (petState.followMouse) petMotionModule.startFollowMouse();
    // 七、启用时间统计
    // 每隔1秒中查看前台应用是什么
    monitor.start();
    // 八、统一由工作清单模块处理提醒检查，主进程仅负责任务调度。
    // 之前是 45 秒轮询一次，会导致提醒最多延后约 45 秒。
    // 调整为 5 秒轮询，减少“到点后几十秒才触发”的体感延迟。
    worklistReminderTimer = setInterval(worklistModule.tick, 5000);
    worklistModule.tick();
    globalShortcut.register('CommandOrControl+Shift+P', () => {
      toggleClickThrough();
    });
    // 监听this.emit('update', this.latestSnapshot);，将payload
    // 推给宠物窗口和统计窗口
    monitor.on('update', (payload) => {
      // 给宠物窗口发IPC事件
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('time-stats:update', payload);
      }
      // 给统计窗口发IPC事件
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
  // 统一释放：定时器、模块资源、快捷键、监控服务。
  if (worklistReminderTimer) {
    clearInterval(worklistReminderTimer);
    worklistReminderTimer = null;
  }
  menuModule.teardown();
  favoritesModule.teardown();
  worklistModule.teardown();
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
    settingsWindow = null;
  }
  petMotionModule.teardown();
  globalShortcut.unregisterAll();
  persistPetState();
  monitor.stop();
});