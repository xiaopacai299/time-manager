# Electron 功能模块划分说明

本文档说明 `time-manger` 项目中 Electron 主进程按功能模块的划分方式、职责边界、IPC 设计，以及后续可继续拆分的建议顺序。

## 1. 当前主进程模块总览

### 启动与生命周期编排（Orchestrator）
- 文件：`electron-main.js`
- 职责：
  - 应用单实例控制（`requestSingleInstanceLock`）
  - 启动流程（`app.whenReady`）
  - 窗口/托盘/全局快捷键初始化顺序
  - 退出前资源释放（timer、hook、monitor）
- 说明：
  - 该文件现在主要是“编排层”，不再承载所有业务细节。

### 时间统计模块（Time Monitor）
- 文件：`main/time-monitor-service.js`
- 职责：
  - 采样活跃状态并产出统计快照
  - 通过 IPC 将统计数据提供给渲染层

### 收藏夹模块（Favorites）【已拆分】
- 文件：`main/electron/favorites-module.js`
- 职责：
  - 收藏夹数据清洗、增删改查
  - 图标解析与缓存
  - 拖拽快捷方式生成与桌面快捷方式移动
  - 收藏夹窗口打开逻辑

### 工作清单模块（Worklist）【已拆分】
- 文件：`main/electron/worklist-module.js`
- 职责：
  - 工作清单数据清洗与写入
  - 工作清单窗口创建与展示
  - 提醒时间轮询并触发系统通知
  - 注册自身 IPC（`worklist:get-list`、`worklist:add`）

### 菜单模块（Menu/Tray）【已拆分】
- 文件：`main/electron/menu-module.js`
- 职责：
  - 托盘菜单构建与刷新
  - 托盘图标初始化与点击行为
  - 宠物右键菜单构建与弹出
  - 菜单动作回调分发（跟随、捣乱、收藏夹、工作清单、动作测试、退出）

### 宠物行为模块（Pet Motion）【已拆分】
- 文件：`main/electron/pet-motion-module.js`
- 职责：
  - 拖拽状态机
  - 跟随鼠标逻辑
  - 捣乱模式随机游走
  - 全局鼠标 Hook 与行为触发

## 2. IPC 设计分层建议

主进程 IPC 建议按“模块注册”方式组织：

- `setupIpc()` 只负责总入口顺序
- 每个功能模块提供自己的 `registerIpc(ipcMain)`，例如：
  - 收藏夹：`favorites:*`
  - 工作清单：`worklist:*`
  - 宠物状态：`pet:*`
  - 统计快照：`time-stats:*`

这样可以避免单文件里混杂大量通道定义，降低冲突和回归风险。

## 3. 本次已完成的拆分

已将工作清单能力从 `electron-main.js` 抽离到 `main/electron/worklist-module.js`：

- `openWorklistWindow` → `worklistModule.openWindow`
- `checkWorklistReminders` → `worklistModule.checkReminders`
- `worklist:get-list / worklist:add` → `worklistModule.registerIpc`
- 主进程仅保留调度：
  - 菜单点击时调用 `worklistModule.openWindow()`
  - 启动后定时器调用 `worklistModule.checkReminders()`

已将收藏夹能力从 `electron-main.js` 抽离到 `main/electron/favorites-module.js`：

- `openFavoritesWindow` → `favoritesModule.openWindow`
- `favorites:*` IPC 与 `favorites:start-drag` 监听 → `favoritesModule.registerIpc`
- 收藏夹数据、图标缓存、桌面快捷方式移动、拖拽文件生成逻辑统一收敛到模块内

已将菜单能力从 `electron-main.js` 抽离到 `main/electron/menu-module.js`：

- `buildTrayMenu/createTray` → `menuModule.createTray / menuModule.refreshTrayMenu`
- 宠物右键菜单 `pet:open-context-menu` 的菜单构建逻辑迁移到 `menuModule.popupPetContextMenu`
- 主进程只保留菜单弹出/关闭时对宠物行为模块的通知调用

已将宠物运动能力从 `electron-main.js` 抽离到 `main/electron/pet-motion-module.js`：

- `drag/follow/chaos` 的计时器、状态机与运动计算全部迁移
- `pet:start-drag / pet:end-drag / pet:drag-by` IPC 监听迁移到 `petMotionModule.registerIpc`
- 全局鼠标 Hook 与右键菜单期间抑制追鼠标逻辑迁移到模块内
- 主进程仅在关键生命周期调用：
  - `petMotionModule.setupGlobalMouseHook()`
  - `petMotionModule.teardown()`

## 4. 关键流程说明（便于排查问题）

### 启动流程
1. `loadPetState` 读取 `pet-window-state.json`
2. `setupIpc` 注册桥接
3. `createMainWindow` 创建宠物窗口
4. `createTray` 初始化托盘菜单
5. 启动 monitor 与工作清单提醒轮询

### 工作清单提醒
1. 渲染层通过 `worklist:add` 提交表单
2. 主进程模块清洗后写入 `petState.worklist`
3. 定时轮询到达提醒时间后触发 `Notification`
4. 条目标记 `reminderNotified = true`，避免重复提醒

## 5. 后续推荐优化方向

核心模块拆分已完成，后续可考虑：

1. **状态与事件总线统一**
   - 抽出 `main/electron/pet-state-store.js`
   - 让模块只依赖标准化状态 API，进一步降低耦合

## 6. 第五阶段（接口统一）结果

为降低主进程认知负担，模块接口已统一为“生命周期 + 能力函数”模式：

- **生命周期接口**
  - `setup`：可选，模块初始化（如托盘、全局鼠标 hook）
  - `registerIpc`：可选，集中注册 IPC
  - `teardown`：可选，应用退出时释放资源

- **窗口类模块能力**
  - `openWindow`：显式打开窗口（favorites/worklist）

- **主进程当前调用形态**
  - 启动：`menuModule.setup()`、`petMotionModule.setup()`
  - IPC：`favoritesModule.registerIpc(ipcMain)`、`worklistModule.registerIpc(ipcMain)`、`petMotionModule.registerIpc(ipcMain)`
  - 退出：`menuModule.teardown()`、`favoritesModule.teardown()`、`worklistModule.teardown()`、`petMotionModule.teardown()`

同时保留了旧方法别名（例如 `createTray`、`checkReminders`、`setupGlobalMouseHook`），确保现有调用兼容。

## 7. 注释规范建议（主进程）

建议在以下关键节点必须保留注释：

- 生命周期入口（`app.whenReady`、`before-quit`）
- 状态持久化边界（读取/写入 state）
- IPC 入口分组（模块边界）
- 定时器职责（谁创建、谁销毁、谁消费）
- 跨模块依赖注入（为什么以参数传入而不是直接 import）

这样在后续继续拆分时，迁移成本会明显降低。
