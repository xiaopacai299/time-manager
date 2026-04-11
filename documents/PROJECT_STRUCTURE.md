# 项目结构说明

本文描述当前仓库中与**宠物窗口前端**相关的目录与职责，以及主进程、配置的对应关系，便于后续扩展时对照。

---

## 1. 顶层一览

```
time-manager/
├── electron-main.js          # Electron 主进程：宠物窗口、托盘、IPC、采样调度入口
├── preload.cjs               # 预加载脚本，暴露 window.timeManagerAPI
├── vite.config.js
├── package.json
├── main/                     # 主进程业务：前台采集、活动引擎、监控服务
├── src/                      # 宠物窗口 React 前端（Vite）
├── documents/                # 说明文档（含本文件）
├── skill/                    # 协作约定（如 generate_config / generate_doc）
└── assets/                   # 托盘图标等资源
```

---

## 2. 前端 `src/`（宠物窗口）

### 2.1 目录树

```
src/
├── main.jsx                  # React 挂载入口
├── index.css                 # 全局基础样式
├── App.jsx                   # 应用壳：仅组装 hook 与子组件，不写具体业务
├── App.css                   # 宠物窗口布局与宠物相关样式（.pet-shell、.stats-panel 等）
├── configKeys/
│   └── index.js              # 前端可调阈值（连续使用提醒、休息庆祝等），附注释说明用途与引用处
├── constants/
│   └── emptySnapshot.js      # EMPTY_SNAPSHOT，与主进程快照字段对齐的占位初始值
├── hooks/
│   ├── useTimeManagerPetBridge.js   # 订阅 timeManagerAPI：快照、宠物状态、托盘动作测试
│   ├── usePetTempInteractive.js     # 穿透模式下 Alt 临时可交互
│   ├── usePetMood.js                # 由快照 + 短时动作推导宠物 mood
│   └── usePetAvatarInteractions.js  # 头像区右键菜单、主进程拖拽
├── utils/
│   ├── formatDuration.js            # 毫秒格式化为 HH:MM:SS
│   ├── topAppsFromPerAppToday.js    # 今日应用聚合 Top（纯函数）
│   └── snapshotDurationStats.js     # 从快照推导当前会话时长、今日总时长（纯函数）
└── components/
    ├── AnimatedPet.jsx              # 宠物 SVG 动画（仍位于 components 根目录）
    ├── PetBubble/                   # 气泡：组件 + 样式 + index 导出
    │   ├── index.jsx
    │   ├── PetBubble.jsx            # 文案与 variant 主题逻辑内置
    │   └── PetBubble.css
    ├── PetAvatarArea/               # 可拖拽头像区
    │   ├── index.jsx
    │   └── PetAvatarArea.jsx
    └── PetStatsPanel/               # 统计说明与 Top 列表
        ├── index.jsx
        └── PetStatsPanel.jsx
```

### 2.2 约定

| 约定 | 说明 |
|------|------|
| **组件目录** | 每个 UI 组件单独文件夹：`ComponentName/ComponentName.jsx` + 可选 `ComponentName.css` + `index.jsx` 再导出默认组件。 |
| **配置** | 与界面相关的魔法数字、阈值放在 `configKeys/index.js`，并在文件中注释**作用**与**使用文件**。 |
| **App.jsx** | 只做数据流组装（hook + `useMemo`）与 JSX 挂载，具体逻辑进 hook / util / 子组件。 |

### 2.3 数据流（简图）

```
preload (timeManagerAPI)
        ↓
useTimeManagerPetBridge → snapshot, petState, transientAction
        ↓
usePetMood / topAppsFromPerAppToday / getSnapshotDurationStats
        ↓
PetBubble / PetAvatarArea / PetStatsPanel
```

---

## 3. 主进程 `main/` 与入口

| 文件 | 职责 |
|------|------|
| `main/time-monitor-service.js` | 定时 tick、调用采集、驱动 `ActivityEngine` |
| `main/activity-engine.js` | 应用切换、连续使用、休息累计、生成快照 |
| `main/foreground.js` | 前台窗口信息采集（平台相关） |
| `main/app-filter-config.js` | 过滤规则等 |
| `electron-main.js` | 创建无边框宠物窗口、托盘、IPC、`monitor.start()` |

快照字段含义可与 `documents/TIME_TRACKING_EXPLAIN.md` 对照。

---

## 4. 相关文档索引

| 文档 | 内容 |
|------|------|
| `TIME_TRACKING_EXPLAIN.md` | 采样、快照字段、前后端如何协作 |
| `2petModel.md` | 宠物模型相关说明（若仍适用） |
| `PROJECT_STRUCTURE.md` | 本文件：目录与职责 |

---

## 5. 后续扩展建议

- 新增宠物相关 UI：在 `src/components/<Name>/` 下按现有组件模式建文件夹。
- 新增与 Electron 桥接的逻辑：优先 `src/hooks/use*.js`。
- 新增纯计算、无 React 依赖：优先 `src/utils/*.js`。
- 修改提醒阈值：只改 `src/configKeys/index.js`（并确认主进程统计语义是否需对齐）。
