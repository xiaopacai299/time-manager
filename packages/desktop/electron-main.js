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
  safeStorage,
} from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import { TimeMonitorService } from './main/time-monitor-service.js';
import { createWorklistModule } from './main/electron/worklist-module.js';
import { createFavoritesModule } from './main/electron/favorites-module.js';
import { createMenuModule } from './main/electron/menu-module.js';
import { createPetMotionModule } from './main/electron/pet-motion-module.js';
import { debugLog } from './main/debug-log.js';
import { computeYearWorkHeatmap } from '@time-manger/shared';

// 主进程默认阈值（毫秒）。不要依赖 src 目录，避免打包后模块缺失。
const REMIND_CONTINUOUS_MS = 25 * 60 * 1000;
const LONG_WORK_CONTINUOUS_MS = 50 * 60 * 1000;

// 硬编码的火山引擎 API 配置
const HARDCODED_LLM_CHAT_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const HARDCODED_LLM_MODEL = 'ep-20260418123459-schx9';
const HARDCODED_OPENAI_API_KEY = 'ark-15dc8144-2fd4-487b-a2f1-b5327a9244d4-fbf38';
// 保留旧的默认值作为后备
const DEFAULT_LLM_CHAT_URL = HARDCODED_LLM_CHAT_URL;

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
let loginWindow = null;
let readerWindow = null;
let petAiChatWindow = null;
let diaryWindow = null;
let worklistReminderTimer = null;
/** 展开模式：宠物、气泡与统计区 */
const PET_WINDOW_WIDTH = 620;
const PET_WINDOW_HEIGHT = 640;
/** 展开模式但不含统计面板：只有气泡 + 宠物 */
const PET_NO_STATS_WIDTH = 200;
const PET_NO_STATS_HEIGHT = 220;
const PET_AI_CHAT_MARGIN = 20;
const PET_AI_CHAT_MIN_WIDTH = 360;
const PET_AI_CHAT_MIN_HEIGHT = 280;
/** 打开时的默认宽度上限（宽屏不再拉满整行）；小屏仍保证左右至少各留 `PET_AI_CHAT_MARGIN`。 */
const PET_AI_CHAT_MAX_WIDTH = 800;

/**
 * AI 对话子窗口：宽度不超过 `PET_AI_CHAT_MAX_WIDTH`，在工作区内水平居中；高度随工作区比例变化并垂直居中。
 */
function getPetAiChatWindowBounds() {
  const primary = screen.getPrimaryDisplay();
  const wa = primary.workArea;
  const m = PET_AI_CHAT_MARGIN;
  const maxUsable = Math.max(PET_AI_CHAT_MIN_WIDTH, Math.round(wa.width - 2 * m));
  const width = Math.min(PET_AI_CHAT_MAX_WIDTH, maxUsable);
  const x = Math.round(wa.x + wa.width - width - m); // 右侧对齐
  const height = Math.min(
    720,
    Math.max(PET_AI_CHAT_MIN_HEIGHT, Math.round(wa.height * 0.8)),
  );
  const y = Math.round(wa.y + (wa.height - height) / 2);
  return { x, y, width, height };
}
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

/**
 * 获取宠物窗口的 HTML 文件路径
 * 在 asar 打包环境中，需要特殊处理路径
 */
function getPetIndexHtmlPath() {
  // 尝试多个可能的路径
  const candidates = [
    // 标准路径（开发模式和未打包）
    path.join(__dirname, 'dist', 'index.html'),
    // asar 包内的路径
    path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
    // 另一种可能的 asar 路径
    path.join(process.resourcesPath, 'dist', 'index.html'),
    // 相对于可执行文件的路径
    path.join(path.dirname(process.execPath), 'resources', 'app', 'dist', 'index.html'),
    // 当前工作目录
    path.join(process.cwd(), 'dist', 'index.html'),
  ];
  
  for (const candidate of candidates) {
    try {
      // 使用 Electron 的 API 检查文件是否存在（支持 asar）
      if (require('fs').existsSync(candidate)) {
        console.log('[DEBUG] Found index.html at:', candidate);
        return candidate;
      }
    } catch (e) {
      // 忽略错误，继续尝试下一个
    }
  }
  
  // 默认返回第一个路径（即使不存在，让后续逻辑处理错误）
  return candidates[0];
}

const petIndexHtmlPath = getPetIndexHtmlPath();

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
    if (petAiChatWindow && !petAiChatWindow.isDestroyed()) {
      if (petAiChatWindow.isMinimized()) petAiChatWindow.restore();
      petAiChatWindow.show();
      petAiChatWindow.focus();
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
  // 动态获取路径（支持 asar 环境）
  const htmlPath = getPetIndexHtmlPath();
  const useLocalFile = fs.existsSync(htmlPath);
  
  // 调试日志
  // console.log('[DEBUG] loadPetRenderer:', {
  //   isPackaged: app.isPackaged,
  //   useLocalFile,
  //   htmlPath,
  //   __dirname,
  //   cwd: process.cwd(),
  //   resourcesPath: process.resourcesPath,
  //   execPath: process.execPath,
  // });
  appendLaunchLog(`loadPetRenderer: isPackaged=${app.isPackaged}, useLocalFile=${useLocalFile}, path=${htmlPath}`);

  if (app.isPackaged) {
    // 打包模式：必须使用本地文件
    if (!useLocalFile) {
      const msg = `未找到界面文件：\n${htmlPath}\n请确认使用「npm run build」后再打包。`;
      appendLaunchLog(`missing dist: ${htmlPath}`);
      dialog.showErrorBox('Time Pet 无法启动', msg);
      return;
    }
    const h = hash ? String(hash).replace(/^#/, '') : '';
    if (h) win.loadFile(htmlPath, { hash: h });
    else win.loadFile(htmlPath);
    return;
  }
  
  // 开发模式：优先使用开发服务器（支持热更新）
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

function openDiaryWindow() {
  if (diaryWindow && !diaryWindow.isDestroyed()) {
    diaryWindow.show();
    diaryWindow.focus();
    return;
  }

  petMotionModule.resetDragState();
  diaryWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    title: '写日记',
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      webSecurity: false,
    },
  });

  diaryWindow.once('ready-to-show', () => {
    if (!diaryWindow || diaryWindow.isDestroyed()) return;
    diaryWindow.setMenuBarVisibility(false);
    diaryWindow.show();
  });

  loadPetRenderer(diaryWindow, 'diary');

  diaryWindow.on('closed', () => {
    diaryWindow = null;
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
  showStatsPanel: false,
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
  readerSettings: {
    background: 'paper',
    autoScrollSpeed: 20,
  },
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
    /** OpenAI API 密钥（硬编码为火山引擎密钥） */
    openAiApiKey: HARDCODED_OPENAI_API_KEY,
    /** 兼容 OpenAI Chat Completions 的完整 POST 地址（硬编码为火山引擎地址） */
    llmChatUrl: HARDCODED_LLM_CHAT_URL,
    /** 请求体中的 model 字段（硬编码为火山引擎模型） */
    llmModel: HARDCODED_LLM_MODEL,
    /**
     * 对话技能（类似 Cursor SKILL）：{ id, name, body, enabled }[]
     * 已启用的 body 会拼进系统提示；仅主进程持久化。
     */
    llmSkills: [],
    /** AI 独立对话窗口背景：`default` | `preset` | `image` */
    petAiChatBgKind: 'default',
    /** 预设 id，仅 kind===preset 时生效 */
    petAiChatBgPreset: 'mist_blue',
    /** 仅文件名，位于 userData/pet-ai-chat-bg/ */
    petAiChatBgImageRel: '',
  },
  /** AI 对话历史：最多保留 10 条会话，每会话最多 10 条消息 */
  chatHistories: [],
  /** 日记列表 */
  diaries: [],
  /** 日记密码（哈希值） */
  diaryPasswordHash: null,
  /** 日记密码设置时间 */
  diaryPasswordSetAt: null,
};

const LLM_SKILL_MAX = 8;
const LLM_SKILL_BODY_MAX = 4000;
const LLM_SKILL_APPENDIX_MAX = 6000;

const PET_AI_CHAT_BG_KINDS = new Set(['default', 'preset', 'image', 'image-fill']);
const PET_AI_CHAT_BG_PRESETS = new Set(['mist_blue', 'lavender_mist', 'warm_paper', 'dark_navy', 'mint_soft']);
const PET_AI_CHAT_BG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const PET_AI_CHAT_BG_MAX_BYTES = 12 * 1024 * 1024;

function getPetAiChatBgStoreDir() {
  return path.join(app.getPath('userData'), 'pet-ai-chat-bg');
}

/** @param {string} rel 仅允许单层文件名 */
function safeResolvePetAiChatBgImagePath(rel) {
  const base = path.resolve(getPetAiChatBgStoreDir());
  const name = path.basename(String(rel || '').trim());
  if (!name || name !== String(rel || '').trim().replace(/\\/g, '/')) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/i.test(name)) return null;
  const ext = path.extname(name).toLowerCase();
  if (!PET_AI_CHAT_BG_EXT.has(ext)) return null;
  const full = path.resolve(path.join(base, name));
  const relToStore = path.relative(base, full);
  if (relToStore.startsWith('..') || path.isAbsolute(relToStore)) return null;
  return fs.existsSync(full) ? full : null;
}

function petAiChatBgImageUrlForClient(rel) {
  const abs = safeResolvePetAiChatBgImagePath(rel);
  if (!abs) return '';
  try {
    return pathToFileURL(abs).href;
  } catch {
    return '';
  }
}

function tryUnlinkPetAiChatBgImage(rel) {
  const abs = safeResolvePetAiChatBgImagePath(rel);
  if (!abs) return;
  try {
    fs.unlinkSync(abs);
  } catch {
    // ignore
  }
}

/**
 * @param {object} input
 * @param {object} prev
 * @returns {{ petAiChatBgKind: string, petAiChatBgPreset: string, petAiChatBgImageRel: string }}
 */
function mergePetAiChatBgSettings(input, prev) {
  const prevKind = PET_AI_CHAT_BG_KINDS.has(prev?.petAiChatBgKind) ? prev.petAiChatBgKind : 'default';
  let kind = PET_AI_CHAT_BG_KINDS.has(input?.petAiChatBgKind) ? input.petAiChatBgKind : prevKind;
  let preset =
    typeof input?.petAiChatBgPreset === 'string' && PET_AI_CHAT_BG_PRESETS.has(input.petAiChatBgPreset.trim())
      ? input.petAiChatBgPreset.trim()
      : PET_AI_CHAT_BG_PRESETS.has(prev?.petAiChatBgPreset)
        ? prev.petAiChatBgPreset
        : 'mist_blue';
  /** 自定义背景文件名仅由主进程「选图」IPC 写入，不接受渲染进程随意指定路径。 */
  let imageRel = String(prev?.petAiChatBgImageRel || '').trim().slice(0, 240);

  if (input?.clearPetAiChatBgImage === true && imageRel) {
    tryUnlinkPetAiChatBgImage(imageRel);
    imageRel = '';
  }

  if (imageRel && !safeResolvePetAiChatBgImagePath(imageRel)) {
    imageRel = '';
  }

  if ((kind === 'image' || kind === 'image-fill') && !imageRel) {
    kind = 'default';
  }

  return {
    petAiChatBgKind: kind,
    petAiChatBgPreset: preset,
    petAiChatBgImageRel: imageRel,
  };
}

function normalizeLlmSkills(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(0, LLM_SKILL_MAX)) {
    if (!item || typeof item !== 'object') continue;
    const id =
      String(item.id || '')
        .trim()
        .slice(0, 80) || `skill-${Date.now()}-${out.length}`;
    const name = String(item.name ?? '').trim().slice(0, 80);
    const body = String(item.body || '').slice(0, LLM_SKILL_BODY_MAX);
    out.push({ id, name, body, enabled: Boolean(item.enabled) });
  }
  return out;
}

/** 将已启用技能正文拼成系统提示附录（总长度封顶） */
function buildLlmSkillSystemAppendix(skills) {
  const list = normalizeLlmSkills(skills);
  const enabled = list.filter((s) => s.enabled && String(s.body || '').trim());
  if (!enabled.length) return '';
  const parts = [];
  let budget = LLM_SKILL_APPENDIX_MAX;
  for (const s of enabled) {
    const title = String(s.name || '').trim() || '未命名';
    const header = `### ${title}\n`;
    const body = String(s.body || '').trim();
    const chunk = `${header}${body}`;
    if (chunk.length <= budget) {
      parts.push(chunk);
      budget -= chunk.length + 2;
      continue;
    }
    if (budget > header.length + 24) {
      parts.push(`${header}${body.slice(0, Math.max(0, budget - header.length))}`);
    }
    break;
  }
  return parts.join('\n\n');
}

/** 仅允许 https，或本机 http（便于本地转发服务调试） */
function isAllowedLlmChatUrl(u) {
  if (u.protocol === 'https:') return true;
  if (u.protocol === 'http:') {
    const h = (u.hostname || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  }
  return false;
}

function resolveLlmChatPostUrl() {
  // 使用硬编码的火山引擎 URL，忽略环境变量和用户设置
  const url = HARDCODED_LLM_CHAT_URL;
  try {
    const u = new URL(url);
    if (!isAllowedLlmChatUrl(u)) {
      return { ok: false, message: 'API 地址仅支持 https，或 http://127.0.0.1 / localhost' };
    }
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false, message: 'API 地址格式无效' };
  }
}

/** 从 delta 中取出多段文本（兼容 content 为 string 或 parts 数组）。 */
function deltaTextFromField(field) {
  if (typeof field === 'string') return field;
  if (!Array.isArray(field)) return '';
  return field
    .map((item) => (item && typeof item === 'object' && typeof item.text === 'string' ? item.text : ''))
    .join('');
}

/**
 * 解析 SSE 中 `data: {...}` 的 JSON，取出 Chat Completions 流式增量：
 * - 正文：`choices[0].delta.content`（及常见数组形态）
 * - 思考：方舟 / DeepSeek 等常用 `reasoning_content`，部分实现为 `reasoning` / `thinking`
 */
function extractChatDeltasFromSseDataJson(dataStr) {
  if (!dataStr || dataStr === '[DONE]') return { content: '', reasoning: '' };
  try {
    const j = JSON.parse(dataStr);
    const d = j?.choices?.[0]?.delta;
    if (!d || typeof d !== 'object') return { content: '', reasoning: '' };
    const content = deltaTextFromField(d.content);
    const reasoningRaw = d.reasoning_content ?? d.reasoning ?? d.thinking;
    const reasoning = deltaTextFromField(reasoningRaw);
    return { content, reasoning };
  } catch {
    return { content: '', reasoning: '' };
  }
}

/**
 * 读取 Chat Completions 流式响应（text/event-stream），并向对应窗口推送 `ai-chat:stream-chunk`。
 * 负载可为 `{ delta }` 正文增量、`{ reasoningDelta }` 思考增量，或二者同时出现。
 * @returns {Promise<{ content: string, reasoning: string }>}
 */
async function readChatCompletionSseStream(webContents, res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let fullReasoning = '';
  const t0 = Date.now();
  let rawReadCount = 0;
  let deltaEventCount = 0;
  let reasoningEventCount = 0;
  let loggedFirstRaw = false;

  const emitDeltas = (payload) => {
    const { content, reasoning } = extractChatDeltasFromSseDataJson(payload);
    if (reasoning) {
      reasoningEventCount += 1;
      fullReasoning += reasoning;
      webContents.send('ai-chat:stream-chunk', { reasoningDelta: reasoning });
      debugLog('ai-chat:sse-reasoning', {
        msFromStreamStart: Date.now() - t0,
        n: reasoningEventCount,
        deltaChars: reasoning.length,
        totalChars: fullReasoning.length,
        preview: reasoning.slice(0, 80).replace(/\r?\n/g, '\\n'),
      });
    }
    if (content) {
      deltaEventCount += 1;
      full += content;
      webContents.send('ai-chat:stream-chunk', { delta: content });
      debugLog('ai-chat:sse-delta', {
        msFromStreamStart: Date.now() - t0,
        n: deltaEventCount,
        deltaChars: content.length,
        totalChars: full.length,
        preview: content.slice(0, 80).replace(/\r?\n/g, '\\n'),
      });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    rawReadCount += 1;
    if (!loggedFirstRaw && value?.length) {
      loggedFirstRaw = true;
      debugLog('ai-chat:sse-first-raw', {
        msFromStreamStart: Date.now() - t0,
        bytes: value.length,
      });
    }
    buffer += decoder.decode(value, { stream: true });
    let lineEnd;
    while ((lineEnd = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, lineEnd).replace(/\r$/, '');
      buffer = buffer.slice(lineEnd + 1);
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trimStart();
      emitDeltas(payload);
    }
  }
  const tail = buffer.trim();
  if (tail.startsWith('data:')) {
    const payload = tail.slice(5).trimStart();
    emitDeltas(payload);
  }
  debugLog('ai-chat:sse-summary', {
    msTotal: Date.now() - t0,
    rawReadCount,
    deltaEventCount,
    reasoningEventCount,
    totalChars: full.length,
    reasoningChars: fullReasoning.length,
  });
  return { content: full, reasoning: fullReasoning };
}

function getStateFilePath() {
  return path.join(app.getPath('userData'), 'pet-window-state.json');
}

/** sync-tokens 文件路径（safeStorage 加密后的二进制） */
function getSyncTokensPath() {
  return path.join(app.getPath('userData'), 'sync-tokens.bin');
}

/** sync-state 文件路径（非敏感，明文 JSON） */
function getSyncStatePath() {
  return path.join(app.getPath('userData'), 'sync-state.json');
}

/** 从加密文件读取 auth tokens；失败返回 null */
function readSyncTokens() {
  try {
    if (!fs.existsSync(getSyncTokensPath())) return null;
    const encrypted = fs.readFileSync(getSyncTokensPath());
    const json = safeStorage.decryptString(encrypted);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** 将 auth tokens 加密写入文件 */
function writeSyncTokens(data) {
  try {
    const json = JSON.stringify(data);
    const encrypted = safeStorage.encryptString(json);
    fs.writeFileSync(getSyncTokensPath(), encrypted);
  } catch (err) {
    console.error('[sync] Failed to write tokens:', err);
  }
}

/** 读取 sync-state（lastSyncAt, dirty, stableIds, deviceId）；失败返回默认值 */
function readSyncState() {
  if (_syncStateCache) return _syncStateCache;
  try {
    if (!fs.existsSync(getSyncStatePath())) {
      _syncStateCache = defaultSyncState();
      return _syncStateCache;
    }
    const raw = fs.readFileSync(getSyncStatePath(), 'utf8');
    _syncStateCache = normalizeSyncState(JSON.parse(raw));
    return _syncStateCache;
  } catch {
    return defaultSyncState();
  }
}

function defaultSyncState() {
  return {
    deviceId: null,
    lastSyncAt: {},
    dirty: {
      'time-records': {},
      diaries: {},
      'worklist-items': {},
      'memo-items': {},
      'work-year-digests': {},
    },
    stableIds: {},
  };
}

function normalizeSyncState(raw) {
  const state = { ...defaultSyncState(), ...(raw && typeof raw === 'object' ? raw : {}) };
  state.lastSyncAt = { ...(state.lastSyncAt || {}) };
  state.dirty = {
    'time-records': {},
    diaries: {},
    'worklist-items': {},
    'memo-items': {},
    'work-year-digests': {},
    ...(state.dirty || {}),
  };
  state.stableIds = { ...(state.stableIds || {}) };
  return state;
}

let _syncStateCache = null;
let _writeDebounceTimer = null;

/** 持久化 sync-state（5 秒去抖 + 原子写入） */
// TODO: stableIds 无界增长，Phase 2 前清理超过 90 天的条目
function writeSyncState(state) {
  _syncStateCache = state;
  clearTimeout(_writeDebounceTimer);
  _writeDebounceTimer = setTimeout(() => {
    const target = getSyncStatePath();
    const tmp = target + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tmp, target);
    } catch (err) {
      console.error('[sync] Failed to write sync state:', err);
      try { fs.unlinkSync(tmp); } catch (e) {
        console.error('[sync] Failed to delete tmp file:', e);
      }
    }
  }, 5000);
}

/**
 * 将当前快照中的 perAppToday 写入 dirty queue。
 * snapshot.perAppToday: Array<{ appId, processName, durationMs, windowTitle }>
 * snapshot.dayKey: "2026-04-24"
 */
function updateDirtyTimeRecords(snapshot) {
  try {
    const { perAppToday = [], dayKey } = snapshot;
    if (!dayKey || !perAppToday.length) return;
    const state = readSyncState();
    const deviceId = getSyncDeviceId();
    const now = new Date().toISOString();
    for (const appRecord of perAppToday) {
      const appKey = String(appRecord.appId || '').trim();
      if (!appKey) continue;
      const stableKey = `${dayKey}|${appKey}`;
      if (!state.stableIds[stableKey]) {
        state.stableIds[stableKey] = generateSyncUUID();
      }
      const id = state.stableIds[stableKey];
      state.dirty['time-records'] = state.dirty['time-records'] || {};
      state.dirty['time-records'][id] = {
        id,
        date: dayKey,
        appKey,
        appName: String(appRecord.processName || appRecord.appId || appKey),
        durationMs: Math.round(Number(appRecord.durationMs) || 0),
        updatedAt: now,
        deletedAt: null,
        clientDeviceId: deviceId,
      };
    }
    writeSyncState(state);
  } catch (err) {
    console.error('[sync] updateDirtyTimeRecords error:', err);
  }
}

function generateSyncUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isSyncUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function getSyncDeviceId() {
  const state = readSyncState();
  if (!state.deviceId || !isSyncUUID(state.deviceId)) {
    state.deviceId = generateSyncUUID();
  }
  for (const bucket of Object.values(state.dirty || {})) {
    for (const record of Object.values(bucket || {})) {
      if (record && typeof record === 'object' && !isSyncUUID(record.clientDeviceId)) {
        record.clientDeviceId = state.deviceId;
      }
    }
  }
  writeSyncState(state);
  return state.deviceId;
}

function markDirtyRecord(resource, record) {
  if (!record?.id || !isSyncUUID(record.id)) return;
  const state = readSyncState();
  state.dirty[resource] = state.dirty[resource] || {};
  state.dirty[resource][record.id] = record;
  // 将脏队列写入文件
  writeSyncState(state);
}

function normalizeDiaryForSync(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== 'object') return null;
  const id = isSyncUUID(raw.id) ? raw.id : generateSyncUUID();
  const content = String(raw.content || '').slice(0, 50000);
  const date = String(raw.date || now.slice(0, 10)).slice(0, 20);
  const createdAt = raw.createdAt && !Number.isNaN(Date.parse(raw.createdAt))
    ? new Date(raw.createdAt).toISOString()
    : now;
  const updatedAt = raw.updatedAt && !Number.isNaN(Date.parse(raw.updatedAt))
    ? new Date(raw.updatedAt).toISOString()
    : now;
  const deletedAt = raw.deletedAt && !Number.isNaN(Date.parse(raw.deletedAt))
    ? new Date(raw.deletedAt).toISOString()
    : null;
  return { id, date, content, createdAt, updatedAt, deletedAt, clientDeviceId: getSyncDeviceId() };
}

function normalizeWorklistItemForSync(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== 'object') return null;
  const id = isSyncUUID(raw.id) ? raw.id : generateSyncUUID();
  const name = String(raw.name || '').trim().slice(0, 200);
  if (!name) return null;
  const normalizeDate = (value) => {
    const s = String(value || '').trim();
    if (!s) return null;
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  };
  const completion = String(raw.completionResult || '').trim().toLowerCase();
  return {
    id,
    name,
    icon: String(raw.icon || '📋'),
    note: String(raw.note || '').slice(0, 2000),
    reminderAt: normalizeDate(raw.reminderAt),
    estimateDoneAt: normalizeDate(raw.estimateDoneAt),
    createdAt: normalizeDate(raw.createdAt) || now,
    updatedAt: normalizeDate(raw.updatedAt) || now,
    deletedAt: normalizeDate(raw.deletedAt),
    reminderNotified: Boolean(raw.reminderNotified),
    completionResult: completion === 'completed' || completion === 'incomplete' ? completion : '',
    confirmSnoozeUntil: normalizeDate(raw.confirmSnoozeUntil),
    clientDeviceId: getSyncDeviceId(),
  };
}

function markDirtyDiary(raw, deletedAt = null) {
  const now = new Date().toISOString();
  // 1. 将原始数据转换为同步格式
  const diary = normalizeDiaryForSync({ ...raw, updatedAt: now, deletedAt }, now);
  if (!diary) return null;
  // 2. 将同步格式数据写入脏队列（一个临时的存储，同步成功后会被清除）
  markDirtyRecord('diaries', diary);
  // 3. 广播同步请求
  broadcastSyncRequest('diary-changed');
  return diary;
}

function markDirtyWorklistItem(raw, deletedAt = null) {
  const now = new Date().toISOString();
  const item = normalizeWorklistItemForSync({ ...raw, updatedAt: now, deletedAt }, now);
  if (!item) return null;
  markDirtyRecord('worklist-items', item);
  broadcastSyncRequest('worklist-changed');
  try {
    queueYearWorkDigestsDirty();
  } catch (err) {
    console.error('[sync] queueYearWorkDigestsDirty error:', err);
  }
  return item;
}

function normalizeMemoForSync(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== 'object') return null;
  const id = isSyncUUID(raw.id) ? raw.id : generateSyncUUID();
  const deletedAt =
    raw.deletedAt && !Number.isNaN(Date.parse(raw.deletedAt))
      ? new Date(raw.deletedAt).toISOString()
      : null;
  const content = String(raw.content ?? '').trim().slice(0, 50000);
  if (!content && !deletedAt) return null;
  const name = String(raw.name || '').trim().slice(0, 200) || '备忘录';
  const icon = String(raw.icon || '📝').trim().slice(0, 2000) || '📝';
  const normalizeDate = (value) => {
    const s = String(value || '').trim();
    if (!s) return null;
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  };
  const reminderAt = normalizeDate(raw.reminderAt);
  const createdAt = normalizeDate(raw.createdAt) || now;
  const updatedAt = normalizeDate(raw.updatedAt) || now;
  return {
    id,
    name,
    icon,
    content,
    reminderAt,
    createdAt,
    updatedAt,
    deletedAt,
    reminderNotified: Boolean(raw.reminderNotified),
    clientDeviceId: getSyncDeviceId(),
  };
}

function markDirtyMemoItem(raw, deletedAt = null) {
  const now = new Date().toISOString();
  const deletedIso =
    deletedAt && !Number.isNaN(Date.parse(deletedAt)) ? new Date(deletedAt).toISOString() : null;
  const memo = normalizeMemoForSync({ ...raw, updatedAt: now, deletedAt: deletedIso }, now);
  if (!memo) return null;
  markDirtyRecord('memo-items', memo);
  broadcastSyncRequest('memo-changed');
  return memo;
}

function queueYearWorkDigestsDirty() {
  const state = readSyncState();
  const deviceId = getSyncDeviceId();
  const items = (petState.worklist || []).map((w) => ({
    reminderAt: w.reminderAt,
    estimateDoneAt: w.estimateDoneAt,
  }));
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 4; y -= 1) {
    const stableKey = `year-digest|${y}`;
    if (!state.stableIds[stableKey]) {
      state.stableIds[stableKey] = generateSyncUUID();
    }
    const id = state.stableIds[stableKey];
    const heatmap = computeYearWorkHeatmap(items, y);
    const payloadJson = JSON.stringify(heatmap);
    const nowIso = new Date().toISOString();
    markDirtyRecord('work-year-digests', {
      id,
      year: y,
      payloadJson,
      updatedAt: nowIso,
      deletedAt: null,
      clientDeviceId: deviceId,
    });
  }
}

function mergeRemoteMemoItems(records) {
  let changed = false;
  const byId = new Map((petState.memoList || []).map((m) => [String(m.id), m]));
  for (const record of records || []) {
    const remote = normalizeMemoForSync(record, record.updatedAt);
    if (!remote) continue;
    const existing = byId.get(remote.id);
    const existingTs = Date.parse(existing?.updatedAt || existing?.createdAt || 0);
    const remoteTs = Date.parse(remote.updatedAt);
    if (existing && existingTs >= remoteTs) continue;
    if (remote.deletedAt) {
      byId.delete(remote.id);
    } else {
      byId.set(remote.id, {
        id: remote.id,
        name: remote.name,
        icon: remote.icon,
        content: remote.content,
        reminderAt: remote.reminderAt || '',
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt,
        reminderNotified: remote.reminderNotified,
      });
    }
    changed = true;
  }
  if (changed) {
    petState.memoList = [...byId.values()].sort((a, b) =>
      String(a.createdAt || '').localeCompare(String(b.createdAt || '')),
    );
    persistPetState();
    worklistModule?.broadcastMemoUpdate?.();
  }
  return changed;
}

function queueLegacyDesktopContentForSync() {
  let changed = false;
  let queued = false;

  petState.diaries = (petState.diaries || []).map((diary) => {
    if (isSyncUUID(diary?.id) && diary?.updatedAt) return diary;
    const synced = markDirtyDiary(diary);
    if (!synced) return diary;
    changed = true;
    queued = true;
    return {
      id: synced.id,
      date: synced.date,
      content: synced.content,
      createdAt: synced.createdAt,
      updatedAt: synced.updatedAt,
    };
  });

  petState.worklist = (petState.worklist || []).map((item) => {
    if (isSyncUUID(item?.id) && item?.updatedAt) return item;
    const synced = markDirtyWorklistItem(item);
    if (!synced) return item;
    changed = true;
    queued = true;
    return synced;
  });

  petState.memoList = (petState.memoList || []).map((memo) => {
    if (isSyncUUID(memo?.id) && memo?.updatedAt) return memo;
    const synced = markDirtyMemoItem(memo);
    if (!synced) return memo;
    changed = true;
    queued = true;
    return {
      id: synced.id,
      name: synced.name,
      icon: synced.icon,
      content: synced.content,
      reminderAt: synced.reminderAt || '',
      createdAt: synced.createdAt,
      updatedAt: synced.updatedAt,
      reminderNotified: synced.reminderNotified,
    };
  });

  if (changed) {
    persistPetState();
    broadcastDiariesUpdate();
    worklistModule?.broadcastWorklistUpdate?.();
    worklistModule?.broadcastMemoUpdate?.();
  }
  return queued;
}

function mergeRemoteDiaries(records) {
  let changed = false;
  const byId = new Map((petState.diaries || []).map((d) => [String(d.id), d]));
  for (const record of records || []) {
    const remote = normalizeDiaryForSync(record, record.updatedAt);
    if (!remote) continue;
    const existing = byId.get(remote.id);
    const existingTs = Date.parse(existing?.updatedAt || existing?.createdAt || 0);
    const remoteTs = Date.parse(remote.updatedAt);
    if (existing && existingTs >= remoteTs) continue;
    if (remote.deletedAt) {
      byId.delete(remote.id);
    } else {
      byId.set(remote.id, {
        id: remote.id,
        date: remote.date,
        content: remote.content,
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt,
      });
    }
    changed = true;
  }
  if (changed) {
    petState.diaries = [...byId.values()].sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    );
    persistPetState();
    broadcastDiariesUpdate();
  }
  return changed;
}

function mergeRemoteWorklistItems(records) {
  let changed = false;
  const byId = new Map((petState.worklist || []).map((item) => [String(item.id), item]));
  for (const record of records || []) {
    const remote = normalizeWorklistItemForSync(record, record.updatedAt);
    if (!remote) continue;
    const existing = byId.get(remote.id);
    const existingTs = Date.parse(existing?.updatedAt || existing?.createdAt || 0);
    const remoteTs = Date.parse(remote.updatedAt);
    if (existing && existingTs >= remoteTs) continue;
    if (remote.deletedAt) {
      byId.delete(remote.id);
    } else {
      byId.set(remote.id, remote);
    }
    changed = true;
  }
  if (changed) {
    petState.worklist = [...byId.values()].sort((a, b) =>
      String(a.createdAt || '').localeCompare(String(b.createdAt || '')),
    );
    persistPetState();
    worklistModule?.broadcastWorklistUpdate?.();
  }
  return changed;
}

/** 启动时加载持久化状态；失败时回退到默认值。 */
// 从用户目录里读 pet-window-state.json：上次宠物窗口在哪、收藏夹、工作清单等。
function loadPetState() {
  try {
    const raw = fs.readFileSync(getStateFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      petState.clickThrough = Boolean(parsed.clickThrough);
      petState.showStatsPanel = false;
      petState.windowBounds = parsed.windowBounds || null;
      petState.compactMode = Boolean(parsed.compactMode);
      petState.followMouse = Boolean(parsed.followMouse);
      petState.favorites = Array.isArray(parsed.favorites) ? parsed.favorites : [];
      petState.worklist = Array.isArray(parsed.worklist) ? parsed.worklist : [];
      petState.diaries = Array.isArray(parsed.diaries) ? parsed.diaries : [];
      petState.diaryPasswordHash = parsed.diaryPasswordHash || null;
      petState.diaryPasswordSetAt = parsed.diaryPasswordSetAt || null;
      if (Array.isArray(parsed.memoList)) {
        petState.memoList = parsed.memoList.map((m) => {
          const createdAt = m?.createdAt || new Date().toISOString();
          return {
            ...m,
            createdAt,
            updatedAt: m?.updatedAt || createdAt,
          };
        });
      } else if (typeof parsed.worklistMemo === 'string' && parsed.worklistMemo.trim()) {
        const createdAt = new Date().toISOString();
        petState.memoList = [
          {
            id: `memo-migrated-${Date.now()}`,
            name: '备忘录（迁移）',
            icon: '📝',
            content: parsed.worklistMemo.slice(0, 50000),
            reminderAt: '',
            reminderNotified: true,
            createdAt,
            updatedAt: createdAt,
          },
        ];
      } else {
        petState.memoList = [];
      }
      if (parsed.readerSettings && typeof parsed.readerSettings === 'object') {
        petState.readerSettings = {
          background: String(parsed.readerSettings.background || 'paper'),
          autoScrollSpeed: Number.isFinite(Number(parsed.readerSettings.autoScrollSpeed))
            ? Math.max(0, Math.min(120, Number(parsed.readerSettings.autoScrollSpeed)))
            : 20,
        };
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
          // 使用硬编码的配置，忽略文件中保存的值
          openAiApiKey: HARDCODED_OPENAI_API_KEY,
          llmChatUrl: HARDCODED_LLM_CHAT_URL,
          llmModel: HARDCODED_LLM_MODEL,
          llmSkills: normalizeLlmSkills(parsed.petSettings.llmSkills),
          petAiChatBgKind: PET_AI_CHAT_BG_KINDS.has(String(parsed.petSettings.petAiChatBgKind || '').trim())
            ? String(parsed.petSettings.petAiChatBgKind).trim()
            : 'default',
          petAiChatBgPreset: PET_AI_CHAT_BG_PRESETS.has(String(parsed.petSettings.petAiChatBgPreset || '').trim())
            ? String(parsed.petSettings.petAiChatBgPreset).trim()
            : 'mist_blue',
          petAiChatBgImageRel: String(parsed.petSettings.petAiChatBgImageRel || '')
            .trim()
            .slice(0, 240),
        };
        const bgMerged = mergePetAiChatBgSettings({}, petState.petSettings);
        petState.petSettings = { ...petState.petSettings, ...bgMerged };
      }
      // 加载 AI 对话历史（最多保留 10 条会话）
      if (Array.isArray(parsed.chatHistories)) {
        petState.chatHistories = parsed.chatHistories.slice(0, 10).map(h => ({
          id: String(h.id || ''),
          title: String(h.title || '未命名会话').slice(0, 40),
          messages: Array.isArray(h.messages) ? h.messages.slice(0, 10) : [],
          createdAt: String(h.createdAt || new Date().toISOString()),
        })).filter(h => h.id && h.messages.length > 0);
      }
    }
  } catch {
    // Use defaults when state file does not exist.
  }
}

/** 不下发明文 API 密钥，但下发其他配置给渲染进程 */
function sanitizePetSettingsForClient(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const { openAiApiKey: _secret, ...rest } = raw;
  const imageUrl = petAiChatBgImageUrlForClient(rest.petAiChatBgImageRel);
  return {
    ...rest,
    hasOpenAiKey: Boolean(String(_secret || '').trim()),
    petAiChatBgImageUrl: imageUrl,
    // 下发硬编码的配置给前端显示
    llmChatUrl: HARDCODED_LLM_CHAT_URL,
    llmModel: HARDCODED_LLM_MODEL,
  };
}

function buildPetStatePayload() {
  return {
    clickThrough: petState.clickThrough,
    showStatsPanel: petState.showStatsPanel,
    compactMode: petState.compactMode,
    followMouse: petState.followMouse,
    petSettings: sanitizePetSettingsForClient(petState.petSettings),
    chatHistories: (petState.chatHistories || []).map(h => ({
      id: h.id,
      title: h.title,
      createdAt: h.createdAt,
      // 不返回完整消息列表给宠物窗口，只给 AI 对话窗口单独获取
      messageCount: h.messages?.length || 0,
    })),
  };
}

function broadcastPetStateChanged() {
  const payload = buildPetStatePayload();
  const send = (win) => {
    if (!win || win.isDestroyed()) return;
    try {
      win.webContents.send('pet:state-changed', payload);
    } catch {
      // 窗口可能正在销毁
    }
  };
  send(mainWindow);
  send(petAiChatWindow);
  send(settingsWindow);
}

function broadcastDiariesUpdate() {
  if (!diaryWindow || diaryWindow.isDestroyed()) return;
  try {
    diaryWindow.webContents.send('diary:updated', petState.diaries || []);
  } catch {
    // 窗口可能正在销毁
  }
}

function broadcastSyncRequest(reason = 'data-changed') {
  const payload = {
    reason: String(reason || 'data-changed'),
    requestedAt: new Date().toISOString(),
  };
  const send = (win) => {
    if (!win || win.isDestroyed()) return;
    try {
      win.webContents.send('sync:request', payload);
    } catch {
      // 窗口可能正在销毁
    }
  };
  // 广播同步请求给所有窗口（就是点击右侧菜单打开的每个窗口）
  send(mainWindow);
  send(statsWindow);
  send(settingsWindow);
  send(readerWindow);
  send(petAiChatWindow);
  send(diaryWindow);
}

/**
 * 保存 AI 对话历史会话
 * @param {Array} messages - 当前会话的消息列表
 * @param {string} title - 会话标题（可选，默认取第一条用户消息）
 * @param {string} sessionId - 可选，如果提供则更新现有会话，否则创建新会话
 */
function saveChatHistory(messages, title, sessionId) {
  if (!Array.isArray(messages) || messages.length === 0) return;
  // 过滤掉开场白和流式中的消息，保留完整对话
  const validMessages = messages
    .filter(m => !m.opening && !m.streaming && m.content?.trim())
    .map(m => ({
      id: m.id,
      role: m.role,
      content: String(m.content).slice(0, 2000), // 单条消息限制长度
      reasoning: m.reasoning ? String(m.reasoning).slice(0, 1000) : undefined,
    }));
  if (validMessages.length === 0) return;
  const sessionTitle = title?.trim() ||
    validMessages.find(m => m.role === 'user')?.content?.slice(0, 20) ||
    '未命名会话';

  // 如果提供了 sessionId，尝试更新现有会话
  if (sessionId) {
    const existingIndex = (petState.chatHistories || []).findIndex(h => h.id === sessionId);
    if (existingIndex >= 0) {
      // 更新现有会话
      const existing = petState.chatHistories[existingIndex];
      petState.chatHistories[existingIndex] = {
        ...existing,
        title: sessionTitle,
        messages: validMessages.slice(0, 10), // 每会话最多保留 10 条消息
        updatedAt: new Date().toISOString(),
      };
      // 将该会话移到列表开头
      const updated = petState.chatHistories.splice(existingIndex, 1)[0];
      petState.chatHistories = [updated, ...petState.chatHistories];
      persistPetState();
      broadcastPetStateChanged();
      return;
    }
  }

  // 创建新会话
  const newSession = {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: sessionTitle,
    messages: validMessages.slice(0, 10), // 每会话最多保留 10 条消息
    createdAt: new Date().toISOString(),
  };
  // 将新会话添加到开头，最多保留 10 条
  petState.chatHistories = [newSession, ...(petState.chatHistories || [])].slice(0, 10);
  persistPetState();
  broadcastPetStateChanged();
}

/**
 * 获取 AI 对话历史列表（不含消息详情）
 */
function getChatHistories() {
  return (petState.chatHistories || []).map(h => ({
    id: h.id,
    title: h.title,
    createdAt: h.createdAt,
    messageCount: h.messages?.length || 0,
  }));
}

/**
 * 获取指定会话的完整消息
 */
function getChatHistoryById(sessionId) {
  const session = (petState.chatHistories || []).find(h => h.id === sessionId);
  return session ? { ...session } : null;
}

/**
 * 删除指定会话
 */
function deleteChatHistory(sessionId) {
  petState.chatHistories = (petState.chatHistories || []).filter(h => h.id !== sessionId);
  persistPetState();
  broadcastPetStateChanged();
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
  markDirtyWorklistItem,
  markDirtyMemoItem,
  createSyncId: generateSyncUUID,
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
  onOpenWorklistExport: () => worklistModule.openExportWindow(),
  onOpenReader: () => openReaderWindow(),
  onOpenSettings: () => openSettingsWindow(),
  onOpenLogin: () => openLoginWindow(),
  onOpenStatsWindow: () => openStatsDetailWindow(),
  onOpenDiary: () => openDiaryWindow(),
  onEmitPetAction: (action) => emitPetAction(action),
  onToggleAutoLaunch: () => toggleAutoLaunch(),
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
    maxWidth: 900,
    maxHeight: 960,
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
  if (petState.compactMode) return [PET_COMPACT_WIDTH, PET_COMPACT_HEIGHT];
  if (!petState.showStatsPanel) return [PET_NO_STATS_WIDTH, PET_NO_STATS_HEIGHT];
  return [PET_WINDOW_WIDTH, PET_WINDOW_HEIGHT];
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

/**
 * 切换开机自动启动状态
 * 使用 Electron 的 app.setLoginItemSettings API 设置 Windows 登录时自动启动
 */
function toggleAutoLaunch() {
  try {
    const settings = app.getLoginItemSettings();
    const newValue = !settings.openAtLogin;

    app.setLoginItemSettings({
      openAtLogin: newValue,
      openAsHidden: false, // 启动时显示窗口（不是隐藏）
      path: process.execPath, // 使用当前可执行文件路径
      args: [], // 启动参数
    });

    // 刷新菜单以更新勾选状态
    menuModule.refreshTrayMenu();

    console.log(`[AutoLaunch] 开机自动启动已${newValue ? '开启' : '关闭'}`);
    return newValue;
  } catch (error) {
    console.error('[AutoLaunch] 切换开机自动启动失败:', error);
    return null;
  }
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

function openLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.show();
    loginWindow.focus();
    return;
  }
  loginWindow = new BrowserWindow({
    width: 520,
    height: 660,
    show: false,
    title: '登录',
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      webSecurity: false,
    },
  });
  loginWindow.once('ready-to-show', () => {
    if (!loginWindow || loginWindow.isDestroyed()) return;
    loginWindow.setMenuBarVisibility(false);
    loginWindow.show();
  });
  loginWindow.on('closed', () => {
    loginWindow = null;
  });
  loadPetRenderer(loginWindow, 'login');
}

function openReaderWindow() {
  if (readerWindow && !readerWindow.isDestroyed()) {
    readerWindow.show();
    readerWindow.focus();
    return;
  }
  readerWindow = new BrowserWindow({
    width: 980,
    height: 780,
    minWidth: 560,
    minHeight: 420,
    show: false,
    title: '摸鱼阅读',
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    thickFrame: true,
    resizable: true,
    movable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      webSecurity: false,
    },
  });
  readerWindow.once('ready-to-show', () => {
    if (!readerWindow || readerWindow.isDestroyed()) return;
    readerWindow.setMenuBarVisibility(false);
    readerWindow.show();
  });
  readerWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      event.preventDefault();
      if (readerWindow && !readerWindow.isDestroyed()) {
        readerWindow.close();
      }
    }
  });
  readerWindow.on('closed', () => {
    readerWindow = null;
  });
  loadPetRenderer(readerWindow, 'reader');
}

function toggleReaderWindow() {
  if (readerWindow && !readerWindow.isDestroyed()) {
    readerWindow.close();
    return false;
  }
  openReaderWindow();
  return true;
}

/** 左键双击宠物：独立「AI 对话」窗口（普通边框窗，隐藏菜单栏）。 */
function togglePetAiChatWindow() {
  petMotionModule.resetDragState();
  if (petAiChatWindow && !petAiChatWindow.isDestroyed()) {
    if (petAiChatWindow.isMinimized()) {
      petAiChatWindow.restore();
      petAiChatWindow.focus();
      return;
    }
    if (petAiChatWindow.isVisible()) {
      petAiChatWindow.close();
      return;
    }
    petAiChatWindow.show();
    petAiChatWindow.focus();
    return;
  }

  const aiBounds = getPetAiChatWindowBounds();
  petAiChatWindow = new BrowserWindow({
    ...aiBounds,
    show: false,
    title: 'AI 对话',
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    resizable: true,
    minWidth: PET_AI_CHAT_MIN_WIDTH,
    minHeight: PET_AI_CHAT_MIN_HEIGHT,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      webSecurity: false,
    },
  });

  petAiChatWindow.once('ready-to-show', () => {
    if (!petAiChatWindow || petAiChatWindow.isDestroyed()) return;
    petAiChatWindow.setMenuBarVisibility(false);
    petAiChatWindow.show();
  });

  petAiChatWindow.on('closed', () => {
    petAiChatWindow = null;
  });

  loadPetRenderer(petAiChatWindow, 'pet-ai-chat');
}

function closePetAiChatWindow() {
  if (petAiChatWindow && !petAiChatWindow.isDestroyed()) {
    petAiChatWindow.close();
  }
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
  ipcMain.handle('pet:toggle-ai-chat-window', () => {
    togglePetAiChatWindow();
    return true;
  });
  ipcMain.handle('pet:close-ai-chat-window', () => {
    closePetAiChatWindow();
    return true;
  });
  ipcMain.handle('reader:open-window', () => {
    openReaderWindow();
    return true;
  });
  ipcMain.handle('reader:close-window', () => {
    if (readerWindow && !readerWindow.isDestroyed()) {
      readerWindow.close();
    }
    return true;
  });
  ipcMain.handle('reader-settings:get', () => petState.readerSettings);
  ipcMain.handle('reader-settings:update', (_event, payload) => {
    const input = payload && typeof payload === 'object' ? payload : {};
    petState.readerSettings = {
      background: String(input.background || petState.readerSettings.background || 'paper'),
      autoScrollSpeed: Number.isFinite(Number(input.autoScrollSpeed))
        ? Math.max(0, Math.min(120, Number(input.autoScrollSpeed)))
        : petState.readerSettings.autoScrollSpeed ?? 20,
    };
    persistPetState();
    return { ok: true, readerSettings: petState.readerSettings };
  });
  ipcMain.handle('pet-settings:get', () => sanitizePetSettingsForClient(petState.petSettings));
  ipcMain.handle('pet-settings:update', (_event, payload) => {
    const input = payload && typeof payload === 'object' ? payload : {};
    console.log('[DEBUG] pet-settings:update input:', { petAiChatBgKind: input.petAiChatBgKind });
    const bubbleTextsRaw =
      input.bubbleTexts && typeof input.bubbleTexts === 'object' ? input.bubbleTexts : {};
    const remindContinuousMs = Number.isFinite(Number(input.remindContinuousMs))
      ? Math.max(0, Number(input.remindContinuousMs))
      : petState.petSettings.remindContinuousMs ?? REMIND_CONTINUOUS_MS;
    const longWorkContinuousMs = Number.isFinite(Number(input.longWorkContinuousMs))
      ? Math.max(0, Number(input.longWorkContinuousMs))
      : petState.petSettings.longWorkContinuousMs ?? LONG_WORK_CONTINUOUS_MS;
    const prevPs = petState.petSettings;
    // 使用硬编码的 API 配置，忽略用户输入
    const openAiApiKey = HARDCODED_OPENAI_API_KEY;
    const llmChatUrl = HARDCODED_LLM_CHAT_URL;
    const llmModel = HARDCODED_LLM_MODEL;
    const llmSkills = Array.isArray(input.llmSkills)
      ? normalizeLlmSkills(input.llmSkills)
      : normalizeLlmSkills(prevPs.llmSkills);
    const petAiChatBg = mergePetAiChatBgSettings(input, prevPs);
    console.log('[DEBUG] mergePetAiChatBgSettings result:', petAiChatBg);
    petState.petSettings = {
      selectedPet: String(input.selectedPet || prevPs.selectedPet || 'black-coal'),
      bubbleTexts: {
        work: String(bubbleTextsRaw.work ?? prevPs?.bubbleTexts?.work ?? '').slice(0, 120),
        rest: String(bubbleTextsRaw.rest ?? prevPs?.bubbleTexts?.rest ?? '').slice(0, 120),
        remind: String(bubbleTextsRaw.remind ?? prevPs?.bubbleTexts?.remind ?? '').slice(0, 120),
        'long-work': String(
          bubbleTextsRaw['long-work'] ?? prevPs?.bubbleTexts?.['long-work'] ?? '',
        ).slice(0, 120),
      },
      remindContinuousMs,
      longWorkContinuousMs,
      openAiApiKey,
      llmChatUrl,
      llmModel,
      llmSkills,
      ...petAiChatBg,
    };
    persistPetState();
    broadcastPetStateChanged();
    return { ok: true, petSettings: sanitizePetSettingsForClient(petState.petSettings) };
  });

  // 开机自动启动相关 IPC
  ipcMain.handle('auto-launch:get', () => {
    try {
      const settings = app.getLoginItemSettings();
      return { enabled: settings.openAtLogin };
    } catch (error) {
      console.error('[AutoLaunch] 获取开机启动状态失败:', error);
      return { enabled: false, error: error.message };
    }
  });

  ipcMain.handle('auto-launch:set', (_event, enabled) => {
    try {
      const shouldEnable = Boolean(enabled);
      app.setLoginItemSettings({
        openAtLogin: shouldEnable,
        openAsHidden: false,
        path: process.execPath,
        args: [],
      });
      // 刷新菜单勾选状态
      menuModule.refreshTrayMenu();
      console.log(`[AutoLaunch] 开机自动启动已${shouldEnable ? '开启' : '关闭'} (via IPC)`);
      return { ok: true, enabled: shouldEnable };
    } catch (error) {
      console.error('[AutoLaunch] 设置开机启动状态失败:', error);
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('pet-ai-chat-bg:choose-image', async (event) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ||
      (settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null) ||
      (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null);
    const { canceled, filePaths } = await dialog.showOpenDialog(win || undefined, {
      title: '选择 AI 对话窗口背景图',
      properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (canceled || !filePaths?.[0]) {
      return { ok: false, error: 'CANCELLED' };
    }
    const src = filePaths[0];
    const ext = path.extname(src).toLowerCase();
    if (!PET_AI_CHAT_BG_EXT.has(ext)) {
      return { ok: false, error: '不支持的图片格式（请使用 png / jpg / webp / gif）' };
    }
    let st;
    try {
      st = fs.statSync(src);
    } catch {
      return { ok: false, error: '无法读取所选文件' };
    }
    if (st.size > PET_AI_CHAT_BG_MAX_BYTES) {
      return { ok: false, error: '图片过大（最大约 12MB）' };
    }
    const dir = getPetAiChatBgStoreDir();
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      return { ok: false, error: '无法在应用数据目录创建背景文件夹' };
    }
    const base = `bg-${Date.now()}-${Math.random().toString(16).slice(2, 10)}${ext}`;
    const dest = path.join(dir, base);
    try {
      fs.copyFileSync(src, dest);
    } catch {
      return { ok: false, error: '保存图片失败' };
    }
    const prevRel = String(petState.petSettings?.petAiChatBgImageRel || '').trim();
    if (prevRel && prevRel !== base) {
      tryUnlinkPetAiChatBgImage(prevRel);
    }
    // 保留当前的背景类型（image 或 image-fill）
    const currentKind = petState.petSettings?.petAiChatBgKind;
    const targetKind = (currentKind === 'image' || currentKind === 'image-fill') ? currentKind : 'image';
    const petAiChatBg = mergePetAiChatBgSettings(
      { petAiChatBgKind: targetKind, petAiChatBgImageRel: base },
      { ...petState.petSettings, petAiChatBgImageRel: base },
    );
    petState.petSettings = { ...petState.petSettings, ...petAiChatBg };
    persistPetState();
    broadcastPetStateChanged();
    return { ok: true, petSettings: sanitizePetSettingsForClient(petState.petSettings) };
  });

  ipcMain.handle('ai-chat:send', async (event, payload) => {
    const rawMessages = payload?.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      debugLog('ai-chat:send', 'abort', 'EMPTY_MESSAGES');
      return { ok: false, error: 'EMPTY_MESSAGES', message: '没有可发送的消息。' };
    }
    // 使用硬编码的火山引擎 API 密钥
    const key = HARDCODED_OPENAI_API_KEY;
    if (!key) {
      debugLog('ai-chat:send', 'abort', 'MISSING_KEY');
      return {
        ok: false,
        error: 'MISSING_KEY',
        message: 'API 密钥配置错误。',
      };
    }
    const urlResolved = resolveLlmChatPostUrl();
    if (!urlResolved.ok) {
      debugLog('ai-chat:send', 'abort', 'BAD_URL', urlResolved.message);
      return { ok: false, error: 'BAD_URL', message: urlResolved.message };
    }
    const model = String(
      process.env.TIME_MANAGER_LLM_MODEL || petState.petSettings?.llmModel || 'gpt-4o-mini',
    )
      .trim()
      .slice(0, 128);
    const systemHint =
      '你是桌面宠物「时间管理助手」里的对话伙伴，回复简洁、友好，可适当结合专注工作与劳逸结合给出建议。';
    const skillAppendix = buildLlmSkillSystemAppendix(petState.petSettings?.llmSkills);
    const systemContent = skillAppendix
      ? `${systemHint}\n\n以下为当前启用的技能说明（请严格遵守）：\n\n${skillAppendix}`
      : systemHint;
    const mapped = [
      { role: 'system', content: systemContent },
      ...rawMessages.slice(-24).map((m) => {
        const role = m.role === 'assistant' ? 'assistant' : 'user';
        // 保留原始content格式，支持多模态内容
        return { role, content: m.content || '' };
      }),
    ];
    const wantStream = payload?.stream !== false;
    const streamDisabledEnv = String(process.env.TIME_MANAGER_LLM_STREAM || '')
      .trim()
      .toLowerCase();
    const useStream = wantStream && streamDisabledEnv !== 'false' && streamDisabledEnv !== '0';
    debugLog('ai-chat:send', 'request', {
      url: urlResolved.url,
      model,
      messageCount: mapped.length,
      stream: useStream,
      lastUserLen: mapped.filter((m) => m.role === 'user').slice(-1)[0]?.content?.length ?? 0,
    });
    try {
      const reqHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      };
      if (useStream) {
        reqHeaders.Accept = 'text/event-stream';
      }
      const res = await fetch(urlResolved.url, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: mapped,
          max_tokens: 900,
          temperature: 0.65,
          stream: useStream,
        }),
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const sseEligible = Boolean(res.ok && useStream && res.body && ct.includes('text/event-stream'));
      debugLog('ai-chat:send', 'response-head', {
        status: res.status,
        ok: res.ok,
        contentType: ct || '(empty)',
        useStream,
        sseBranch: sseEligible,
      });

      if (sseEligible) {
        const streamed = await readChatCompletionSseStream(event.sender, res);
        const reply = String(streamed?.content || '').trim();
        const reasoning = String(streamed?.reasoning || '').trim();
        if (!reply) {
          debugLog('ai-chat:send', 'BAD_RESPONSE', {
            mode: 'stream',
            empty: true,
            hadReasoning: reasoning.length > 0,
          });
          return {
            ok: false,
            error: 'BAD_RESPONSE',
            message: reasoning
              ? '流式接口只返回了思考过程，未返回正文；请换模型或检查接口。'
              : '流式接口未返回有效内容。',
          };
        }
        debugLog('ai-chat:send', 'ok', {
          mode: 'stream',
          replyChars: reply.length,
          reasoningChars: reasoning.length,
        });
        return { ok: true, content: reply, reasoning, streamed: true };
      }

      const text = await res.text();
      debugLog('ai-chat:send', 'body-non-sse', {
        bodyChars: text.length,
        bodyPrefix: text.slice(0, 120).replace(/\s+/g, ' '),
      });
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (!res.ok) {
        const errMsg = json?.error?.message || text.slice(0, 240) || res.statusText;
        debugLog('ai-chat:send', 'API_ERROR', { status: res.status, errMsg });
        return { ok: false, error: 'API_ERROR', message: `请求失败（${res.status}）：${errMsg}` };
      }
      const msg = json?.choices?.[0]?.message;
      const content = msg?.content;
      const reasoningRaw = msg?.reasoning_content ?? msg?.reasoning ?? msg?.thinking;
      const reasoning =
        typeof reasoningRaw === 'string' ? reasoningRaw.trim() : '';
      if (typeof content !== 'string' || !content.trim()) {
        debugLog('ai-chat:send', 'BAD_RESPONSE', {
          hasChoices: Array.isArray(json?.choices),
          bodyPreview: text.slice(0, 200),
        });
        return { ok: false, error: 'BAD_RESPONSE', message: '接口未返回有效内容。' };
      }
      debugLog('对话内容', { mode: 'json', replyChars: content.trim(), reasoningChars: reasoning.length });
      return { ok: true, content: content.trim(), reasoning, streamed: false };
    } catch (err) {
      debugLog('ai-chat:send', 'NETWORK', err?.message || String(err));
      return { ok: false, error: 'NETWORK', message: err?.message || '网络错误' };
    }
  });

  // AI 对话历史相关 IPC
  ipcMain.handle('ai-chat:save-history', (_event, messages, title, currentHistoryId) => {
    saveChatHistory(messages, title, currentHistoryId);
    return { ok: true };
  });
  ipcMain.handle('ai-chat:get-histories', () => {
    return getChatHistories();
  });
  ipcMain.handle('ai-chat:get-history', (_event, sessionId) => {
    return getChatHistoryById(sessionId);
  });
  ipcMain.handle('ai-chat:delete-history', (_event, sessionId) => {
    deleteChatHistory(sessionId);
    return { ok: true };
  });

  // 日记模块
  ipcMain.handle('diary:get-diaries', () => {
    return petState.diaries;
  });

  ipcMain.handle('diary:add-diary', (_event, diary) => {
    const normalized = markDirtyDiary(diary);
    if (!normalized) return petState.diaries;
    petState.diaries.unshift({
      id: normalized.id,
      date: normalized.date,
      content: normalized.content,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
    });
    persistPetState();
    broadcastDiariesUpdate();
    return petState.diaries;
  });

  ipcMain.handle('diary:update-diary', (_event, updatedDiary) => {
    const originalId = updatedDiary?.id;
    const existing = petState.diaries.find(d => d.id === updatedDiary.id);
    const normalized = markDirtyDiary({
      ...existing,
      ...updatedDiary,
      createdAt: existing?.createdAt || updatedDiary.createdAt,
    });
    if (!normalized) return petState.diaries;
    const index = petState.diaries.findIndex(d => d.id === originalId || d.id === normalized.id);
    if (index !== -1) {
      petState.diaries[index] = {
        id: normalized.id,
        date: normalized.date,
        content: normalized.content,
        createdAt: normalized.createdAt,
        updatedAt: normalized.updatedAt,
      };
      persistPetState();
      broadcastDiariesUpdate();
    }
    return petState.diaries;
  });

  ipcMain.handle('diary:delete-diary', (_event, id) => {
    const existing = petState.diaries.find(d => d.id === id);
    if (existing) {
      markDirtyDiary(existing, new Date().toISOString());
    }
    petState.diaries = petState.diaries.filter(d => d.id !== id);
    persistPetState();
    broadcastDiariesUpdate();
    return petState.diaries;
  });

  // 日记密码模块
  ipcMain.handle('diary:has-password', () => {
    return !!petState.diaryPasswordHash;
  });

  ipcMain.handle('diary:verify-password', (_event, password) => {
    try {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      return hash === petState.diaryPasswordHash;
    } catch (error) {
      console.error('Failed to verify password:', error);
      return false;
    }
  });

  ipcMain.handle('diary:set-password', (_event, password) => {
    try {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      petState.diaryPasswordHash = hash;
      petState.diaryPasswordSetAt = new Date().toISOString();
      persistPetState();
      return { success: true };
    } catch (error) {
      console.error('Failed to set password:', error);
      return { success: false, message: '设置密码失败' };
    }
  });

  ipcMain.handle('diary:remove-password', () => {
    try {
      petState.diaryPasswordHash = null;
      petState.diaryPasswordSetAt = null;
      persistPetState();
      return { success: true };
    } catch (error) {
      console.error('Failed to remove password:', error);
      return { success: false, message: '移除密码失败' };
    }
  });

  // ── 同步层 IPC ──────────────────────────────────────────────
  ipcMain.handle('sync:getAuthState', () => {
    return readSyncTokens();
  });

  ipcMain.handle('sync:saveAuthState', (_event, data) => {
    const { accessToken, refreshToken, userId, email, apiBase, deviceId } = data;
    writeSyncTokens({ accessToken, refreshToken, userId, email, apiBase });
    if (deviceId) {
      const state = readSyncState();
      state.deviceId = deviceId;
      writeSyncState(state);
    }
    queueLegacyDesktopContentForSync();
    broadcastSyncRequest('auth-initialized');
    return { ok: true };
  });

  ipcMain.handle('sync:clearAuth', () => {
    try {
      if (fs.existsSync(getSyncTokensPath())) {
        fs.unlinkSync(getSyncTokensPath());
      }
    } catch (err) {
      console.error('[sync] Failed to clear auth tokens:', err);
    }
    return { ok: true };
  });

  ipcMain.handle('sync:getState', () => {
    queueLegacyDesktopContentForSync();
    return readSyncState();
  });

  ipcMain.handle('sync:setState', (_event, partial) => {
    const state = readSyncState();
    if (partial.lastSyncAt !== undefined) {
      state.lastSyncAt = { ...state.lastSyncAt, ...partial.lastSyncAt };
    }
    if (partial.dirty !== undefined) {
      state.dirty = { ...state.dirty, ...partial.dirty };
    }
    if (partial.stableIds !== undefined) {
      state.stableIds = { ...state.stableIds, ...partial.stableIds };
    }
    if (partial.deviceId !== undefined) {
      state.deviceId = partial.deviceId;
    }
    writeSyncState(state);
    return { ok: true };
  });

  ipcMain.handle('sync:markClean', (_event, resource, accepted = []) => {
    const state = readSyncState();
    const bucket = { ...(state.dirty?.[resource] || {}) };
    for (const item of Array.isArray(accepted) ? accepted : []) {
      const id = String(item?.id || '');
      const updatedAt = String(item?.updatedAt || '');
      if (id && (!updatedAt || bucket[id]?.updatedAt === updatedAt)) {
        delete bucket[id];
      }
    }
    state.dirty = { ...(state.dirty || {}), [resource]: bucket };
    writeSyncState(state);
    return { ok: true };
  });

  ipcMain.handle('sync:applyRemoteRecords', (_event, resource, records) => {
    if (resource === 'diaries') {
      return { ok: true, changed: mergeRemoteDiaries(records) };
    }
    if (resource === 'worklist-items') {
      const changed = mergeRemoteWorklistItems(records);
      return { ok: true, changed };
    }
    if (resource === 'memo-items') {
      return { ok: true, changed: mergeRemoteMemoItems(records) };
    }
    return { ok: true, changed: false };
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
    globalShortcut.register('CommandOrControl+Shift+R', () => {
      toggleReaderWindow();
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
      updateDirtyTimeRecords(payload);
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
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
    loginWindow = null;
  }
  if (readerWindow && !readerWindow.isDestroyed()) {
    readerWindow.close();
    readerWindow = null;
  }
  petMotionModule.teardown();
  globalShortcut.unregisterAll();
  persistPetState();
  monitor.stop();
});