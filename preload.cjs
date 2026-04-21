const { contextBridge, ipcRenderer, webUtils } = require('electron');

// contextBridge：把 API 安全地挂到页面 window
// ipcRenderer：渲染进程发消息/收消息
// webUtils：这里用于拖拽文件时拿本地路径

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

// 核心：将主进程能力封装为 window.timeManagerAPI，供前端安全调用。
contextBridge.exposeInMainWorld('timeManagerAPI', {
  /**
   * 获取最新统计快照。
   * 主进程通道：`time-stats:get-snapshot`（invoke/handle）
   * @returns {Promise<object>}
   */
  getSnapshot: () => ipcRenderer.invoke('time-stats:get-snapshot'),

  /**
   * 获取宠物当前状态（穿透、紧凑模式、跟随等）。
   * 主进程通道：`pet:get-state`（invoke/handle）
   * @returns {Promise<object>}
   */
  getPetState: () => ipcRenderer.invoke('pet:get-state'),


  /**
   * 切换统计面板显示状态。
   * 主进程通道：`pet:toggle-stats-panel`（invoke/handle）
   * @returns {Promise<boolean>}
   */
  toggleStatsPanel: () => ipcRenderer.invoke('pet:toggle-stats-panel'),


  /**
   * 打开统计详情窗口。
   * 主进程通道：`pet:open-stats-window`（invoke/handle）
   * @returns {Promise<boolean>}
   */
  openStatsWindow: () => ipcRenderer.invoke('pet:open-stats-window'),

  /**
   * 切换宠物 AI 对话独立窗口（与左键双击宠物一致）。
   * 主进程通道：`pet:toggle-ai-chat-window`（invoke/handle）
   * @returns {Promise<boolean>}
   */
  togglePetAiChatWindow: () => ipcRenderer.invoke('pet:toggle-ai-chat-window'),

  /**
   * 关闭宠物 AI 对话独立窗口。
   * 主进程通道：`pet:close-ai-chat-window`（invoke/handle）
   * @returns {Promise<boolean>}
   */
  closePetAiChatWindow: () => ipcRenderer.invoke('pet:close-ai-chat-window'),

  /**
   * 打开摸鱼阅读窗口。
   * 主进程通道：`reader:open-window`（invoke/handle）
   * @returns {Promise<boolean>}
   */
  openReaderWindow: () => ipcRenderer.invoke('reader:open-window'),

  /**
   * 关闭摸鱼阅读窗口。
   * 主进程通道：`reader:close-window`（invoke/handle）
   * @returns {Promise<boolean>}
   */
  closeReaderWindow: () => ipcRenderer.invoke('reader:close-window'),

  /**
   * 获取阅读器设置。
   * 主进程通道：`reader-settings:get`（invoke/handle）
   * @returns {Promise<{background:string,autoScrollSpeed:number}>}
   */
  getReaderSettings: () => ipcRenderer.invoke('reader-settings:get'),

  /**
   * 更新阅读器设置。
   * 主进程通道：`reader-settings:update`（invoke/handle）
   * @param {{background?:string,autoScrollSpeed?:number}} payload
   * @returns {Promise<{ok:boolean,readerSettings?:object}>}
   */
  updateReaderSettings: (payload) => ipcRenderer.invoke('reader-settings:update', payload),

  /**
   * 获取收藏夹列表。
   * 主进程通道：`favorites:get-list`（invoke/handle）
   * @returns {Promise<Array<object>>}
   */
  getFavoritesList: () => ipcRenderer.invoke('favorites:get-list'),

  /**
   * 批量添加收藏路径，并可选移动桌面快捷方式。
   * 主进程通道：`favorites:add-paths`（invoke/handle）
   * @param {string[]} paths
   * @param {boolean} moveDesktopShortcuts
   * @returns {Promise<object>}
   */
  addFavoritesPaths: (paths, moveDesktopShortcuts) =>
    ipcRenderer.invoke('favorites:add-paths', { paths, moveDesktopShortcuts }),

  /**
   * 删除指定收藏项。
   * 主进程通道：`favorites:remove`（invoke/handle）
   * @param {string} path
   * @returns {Promise<Array<object>>}
   */
  removeFavorite: (path) => ipcRenderer.invoke('favorites:remove', { path }),

  /**
   * 打开指定收藏项。
   * 主进程通道：`favorites:open`（invoke/handle）
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  openFavorite: (path) => ipcRenderer.invoke('favorites:open', { path }),

  /**
   * 获取收藏项图标 DataURL。
   * 主进程通道：`favorites:get-icon`（invoke/handle）
   * @param {string} path
   * @returns {Promise<string>}
   */
  getFavoriteIcon: (path) => ipcRenderer.invoke('favorites:get-icon', { path }),

  /**
   * 获取工作清单列表。
   * 主进程通道：`worklist:get-list`（invoke/handle）
   * @returns {Promise<Array<object>>}
   */
  getWorklist: () => ipcRenderer.invoke('worklist:get-list'),

  /**
   * 新增工作清单项。
   * 主进程通道：`worklist:add`（invoke/handle）
   * @param {object} item
   * @returns {Promise<object>}
   */
  addWorklistItem: (item) => ipcRenderer.invoke('worklist:add', item),

  /**
   * 更新工作清单项。
   * 主进程通道：`worklist:update`（invoke/handle）
   * @param {object} item
   * @returns {Promise<object>}
   */
  updateWorklistItem: (item) => ipcRenderer.invoke('worklist:update', item),

  /**
   * 删除工作清单项。
   * 主进程通道：`worklist:remove`（invoke/handle）
   * @param {{id:string}} payload
   * @returns {Promise<object>}
   */
  removeWorklistItem: (payload) => ipcRenderer.invoke('worklist:remove', payload),

  /**
   * 获取备忘录列表（提醒时间 + 正文）。
   * 主进程通道：`memo-list:get`
   * @returns {Promise<Array<object>>}
   */
  getMemoList: () => ipcRenderer.invoke('memo-list:get'),

  /**
   * 新增备忘录项。
   * 主进程通道：`memo-list:add`
   * @param {{ name: string, icon?: string, reminderAt?: string, content: string }} payload
   * @returns {Promise<object>}
   */
  addMemoItem: (payload) => ipcRenderer.invoke('memo-list:add', payload),

  /**
   * 更新备忘录项。
   * 主进程通道：`memo-list:update`
   * @param {{ id: string, name: string, icon?: string, reminderAt?: string, content: string }} payload
   * @returns {Promise<object>}
   */
  updateMemoItem: (payload) => ipcRenderer.invoke('memo-list:update', payload),

  /**
   * 删除备忘录项。
   * 主进程通道：`memo-list:remove`
   * @param {{ id: string }} payload
   * @returns {Promise<object>}
   */
  removeMemoItem: (payload) => ipcRenderer.invoke('memo-list:remove', payload),

  /**
   * 订阅备忘录列表更新。
   * 主进程通道：`memo-list:updated`
   * @param {(list: object[]) => void} callback
   * @returns {() => void}
   */
  onMemoListUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('memo-list:updated', handler);
    return () => ipcRenderer.removeListener('memo-list:updated', handler);
  },
  /**
   * 获取宠物设置（类型、气泡文案）。
   * 主进程通道：`pet-settings:get`（invoke/handle）
   * @returns {Promise<object>}
   */
  getPetSettings: () => ipcRenderer.invoke('pet-settings:get'),
  /**
   * 更新宠物设置（类型、气泡文案）。
   * 主进程通道：`pet-settings:update`（invoke/handle）
   * @param {object} payload
   * @returns {Promise<{ok:boolean,petSettings?:object,error?:string}>}
   */
  updatePetSettings: (payload) => ipcRenderer.invoke('pet-settings:update', payload),

  /**
   * 从本地选择一张图片并复制到应用数据目录，设为 AI 独立对话窗口背景；会持久化并广播 `pet:state-changed`。
   * 主进程通道：`pet-ai-chat-bg:choose-image`
   * @returns {Promise<{ ok: boolean, petSettings?: object, error?: string }>}
   */
  choosePetAiChatBackgroundImage: () => ipcRenderer.invoke('pet-ai-chat-bg:choose-image'),

  /**
   * 发送 AI 对话消息（主进程转发 OpenAI Chat Completions；默认请求流式，主进程通过 `onAiChatStreamChunk` 推送增量）。
   * 主进程通道：`ai-chat:send`（invoke/handle）
   * @param {{ messages: Array<{ role: string, content: string }>, stream?: boolean }} payload — `stream: false` 可强制整包 JSON。
   * @returns {Promise<{ ok: boolean, content?: string, reasoning?: string, message?: string, error?: string, streamed?: boolean }>}
   */
  aiChatSend: (payload) => ipcRenderer.invoke('ai-chat:send', payload),

  /**
   * 订阅 AI 流式增量（主进程 `webContents.send('ai-chat:stream-chunk', payload)`）。
   * `payload` 可为 `{ delta }` 正文、`{ reasoningDelta }` 思考链，或二者同时出现。
   * @param {(data: { delta?: string, reasoningDelta?: string }) => void} callback
   * @returns {() => void} 取消订阅
   */
  onAiChatStreamChunk: (callback) => {
    const handler = (_event, data) => {
      if (typeof callback === 'function') callback(data || {});
    };
    ipcRenderer.on('ai-chat:stream-chunk', handler);
    return () => ipcRenderer.removeListener('ai-chat:stream-chunk', handler);
  },

  /**
   * 获取预估完成确认弹窗的数据。
   * 主进程通道：`worklist:estimate-confirm:get-payload`（invoke/handle）
   * @returns {Promise<object|null>}
   */
  getEstimateConfirmPayload: () => ipcRenderer.invoke('worklist:estimate-confirm:get-payload'),
  /**
   * 提交预估完成确认结果。
   * 主进程通道：`worklist:estimate-confirm:submit`（invoke/handle）
   * @param {'completed'|'incomplete'|'snooze'} action
   * @returns {Promise<{ok:boolean,error?:string}>}
   */
  submitEstimateConfirm: (action) =>
    ipcRenderer.invoke('worklist:estimate-confirm:submit', { action }),

  /**
   * 启动收藏项拖拽（单向通知，无返回值）。
   * 主进程通道：`favorites:start-drag`（send/on）
   * @param {string} path
   * @param {string} iconDataUrl
   */
  startFavoriteDrag: (path, iconDataUrl) => ipcRenderer.send('favorites:start-drag', { path, iconDataUrl }),

  /**
   * 将拖拽数据解析为本地路径列表（preload 本地工具，不走 IPC）。
   * @param {FileList|File[]} files
   * @param {string} uriListText
   * @returns {string[]}
   */
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
  /**
   * 打开宠物右键菜单。
   * 主进程通道：`pet:open-context-menu`（invoke/handle）
   * @param {number} x
   * @param {number} y
   * @returns {Promise<void>}
   */
  openContextMenu: (x, y) => ipcRenderer.invoke('pet:open-context-menu', { x, y }),

  /**
   * 开始拖拽宠物窗口（单向通知）。
   * 主进程通道：`pet:start-drag`（send/on）
   * @param {number} offsetX
   * @param {number} offsetY
   */
  startDrag: (offsetX, offsetY) => ipcRenderer.send('pet:start-drag', { offsetX, offsetY }),

  /**
   * 结束拖拽宠物窗口（单向通知）。
   * 主进程通道：`pet:end-drag`（send/on）
   */
  endDrag: () => ipcRenderer.send('pet:end-drag'),

  /**
   * 按增量移动宠物窗口（单向通知）。
   * 主进程通道：`pet:drag-by`（send/on）
   * @param {number} dx
   * @param {number} dy
   */
  dragBy: (dx, dy) => ipcRenderer.send('pet:drag-by', { dx, dy }),

  /**
   * 设置宠物窗口临时可交互态（用于拖拽/菜单场景）。
   * 主进程通道：`pet:set-temp-interactive`（send/on）
   * @param {boolean} active
   */
  setTempInteractive: (active) => ipcRenderer.send('pet:set-temp-interactive', Boolean(active)),

  /**
   * 订阅统计快照推送。
   * 主进程通道：`time-stats:update`（webContents.send -> ipcRenderer.on）
   * @param {(payload: object) => void} callback
   * @returns {() => void} 取消订阅函数
   */
  onUpdate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('time-stats:update', handler);
    return () => ipcRenderer.removeListener('time-stats:update', handler);
  },

  /**
   * 订阅宠物状态变更推送。
   * 主进程通道：`pet:state-changed`（webContents.send -> ipcRenderer.on）
   * @param {(payload: object) => void} callback
   * @returns {() => void}
   */
  onPetStateChanged: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('pet:state-changed', handler);
    return () => ipcRenderer.removeListener('pet:state-changed', handler);
  },

  /**
   * 订阅宠物动作事件（rest/work/remind 等）。
   * 主进程通道：`pet:action`（webContents.send -> ipcRenderer.on）
   * @param {(payload: object) => void} callback
   * @returns {() => void}
   */
  onPetAction: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('pet:action', handler);
    return () => ipcRenderer.removeListener('pet:action', handler);
  },

  /**
   * 订阅宠物运动状态（是否奔跑、方向翻转）。
   * 主进程通道：`pet:motion`（webContents.send -> ipcRenderer.on）
   * @param {(payload: object) => void} callback
   * @returns {() => void}
   */
  onPetMotion: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('pet:motion', handler);
    return () => ipcRenderer.removeListener('pet:motion', handler);
  },

  /**
   * 订阅收藏夹列表更新事件。
   * 主进程通道：`favorites:updated`（webContents.send -> ipcRenderer.on）
   * @param {(payload: object) => void} callback
   * @returns {() => void}
   */
  onFavoritesUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('favorites:updated', handler);
    return () => ipcRenderer.removeListener('favorites:updated', handler);
  },
  /**
   * 订阅工作清单更新事件。
   * 主进程通道：`worklist:updated`（webContents.send -> ipcRenderer.on）
   * @param {(payload: object) => void} callback
   * @returns {() => void}
   */
  onWorklistUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('worklist:updated', handler);
    return () => ipcRenderer.removeListener('worklist:updated', handler);
  },

  /**
   * 保存 AI 对话历史会话。
   * 主进程通道：`ai-chat:save-history`（invoke/handle）
   * @param {Array<object>} messages - 当前会话的消息列表
   * @param {string} [title] - 会话标题（可选）
   * @param {string} [currentHistoryId] - 当前加载的历史会话ID（可选，有则更新原记录）
   * @returns {Promise<{ok: boolean}>}
   */
  saveChatHistory: (messages, title, currentHistoryId) => ipcRenderer.invoke('ai-chat:save-history', messages, title, currentHistoryId),

  /**
   * 获取 AI 对话历史列表（不含消息详情）。
   * 主进程通道：`ai-chat:get-histories`（invoke/handle）
   * @returns {Promise<Array<{id, title, createdAt, messageCount}>>}
   */
  getChatHistories: () => ipcRenderer.invoke('ai-chat:get-histories'),

  /**
   * 获取指定会话的完整消息。
   * 主进程通道：`ai-chat:get-history`（invoke/handle）
   * @param {string} sessionId
   * @returns {Promise<{id, title, createdAt, messages} | null>}
   */
  getChatHistory: (sessionId) => ipcRenderer.invoke('ai-chat:get-history', sessionId),

  /**
   * 删除指定会话。
   * 主进程通道：`ai-chat:delete-history`（invoke/handle）
   * @param {string} sessionId
   * @returns {Promise<{ok: boolean}>}
   */
  deleteChatHistory: (sessionId) => ipcRenderer.invoke('ai-chat:delete-history', sessionId),

  /**
   * 获取开机自动启动状态。
   * 主进程通道：`auto-launch:get`（invoke/handle）
   * @returns {Promise<{enabled: boolean, error?: string}>}
   */
  getAutoLaunchStatus: () => ipcRenderer.invoke('auto-launch:get'),

  /**
   * 设置开机自动启动状态。
   * 主进程通道：`auto-launch:set`（invoke/handle）
   * @param {boolean} enabled - 是否开启开机自动启动
   * @returns {Promise<{ok: boolean, enabled?: boolean, error?: string}>}
   */
  setAutoLaunch: (enabled) => ipcRenderer.invoke('auto-launch:set', enabled),

  /**
   * 获取日记列表。
   * 主进程通道：`diary:get-diaries`（invoke/handle）
   * @returns {Promise<Array<object>>}
   */
  getDiaries: () => ipcRenderer.invoke('diary:get-diaries'),

  /**
   * 添加新日记。
   * 主进程通道：`diary:add-diary`（invoke/handle）
   * @param {object} diary - 日记对象
   * @returns {Promise<Array<object>>}
   */
  addDiary: (diary) => ipcRenderer.invoke('diary:add-diary', diary),

  /**
   * 更新日记。
   * 主进程通道：`diary:update-diary`（invoke/handle）
   * @param {object} diary - 更新后的日记对象
   * @returns {Promise<Array<object>>}
   */
  updateDiary: (diary) => ipcRenderer.invoke('diary:update-diary', diary),

  /**
   * 删除日记。
   * 主进程通道：`diary:delete-diary`（invoke/handle）
   * @param {string} id - 日记ID
   * @returns {Promise<Array<object>>}
   */
  deleteDiary: (id) => ipcRenderer.invoke('diary:delete-diary', id),

  /**
   * 检查是否设置了日记密码。
   * 主进程通道：`diary:has-password`（invoke/handle）
   * @returns {Promise<boolean>}
   */
  hasDiaryPassword: () => ipcRenderer.invoke('diary:has-password'),

  /**
   * 验证日记密码。
   * 主进程通道：`diary:verify-password`（invoke/handle）
   * @param {string} password - 密码
   * @returns {Promise<boolean>}
   */
  verifyDiaryPassword: (password) => ipcRenderer.invoke('diary:verify-password', password),

  /**
   * 设置日记密码。
   * 主进程通道：`diary:set-password`（invoke/handle）
   * @param {string} password - 密码
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  setDiaryPassword: (password) => ipcRenderer.invoke('diary:set-password', password),

  /**
   * 移除日记密码。
   * 主进程通道：`diary:remove-password`（invoke/handle）
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  removeDiaryPassword: () => ipcRenderer.invoke('diary:remove-password'),
});
