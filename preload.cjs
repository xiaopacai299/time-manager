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
});
