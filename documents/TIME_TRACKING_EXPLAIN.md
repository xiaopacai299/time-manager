# Time Manager 采样与计时说明

## 1. 为什么 `EMPTY_SNAPSHOT` 里没有 `timestamp`？

`src/App.jsx` 里的 `EMPTY_SNAPSHOT` 只是前端初始化占位对象，不是完整的运行时快照结构。  
真正的 `timestamp` 来自主进程 `ActivityEngine.getSnapshot()` 返回的数据：

- 主进程在 `main/activity-engine.js` 中构造快照时会设置：
  - `timestamp: now`
  - 其中 `now = sample.timestamp ?? this.lastTimestamp ?? Date.now()`

所以页面运行后，前端 `snapshot` 会被 IPC 推送的新快照覆盖，`timestamp` 就有值了。

---

## 2. 当前应用时长是怎么计算的？

前端计算公式（`src/App.jsx`）：

```js
const currentAppElapsedMs = useMemo(() => {
  if (!currentEnteredAt) return 0
  return Math.max(0, (snapshot.timestamp || Date.now()) - currentEnteredAt)
}, [snapshot.timestamp, currentEnteredAt])
```

含义：

- `currentEnteredAt`：进入当前应用的时间（毫秒）
- `snapshot.timestamp`：本次采样时间（毫秒）
- `当前应用时长 = 采样时间 - 进入时间`
- `Math.max(0, ...)` 防止出现负值

并且依赖数组是 `[snapshot.timestamp, currentEnteredAt]`，**任意一个变化都会触发重新计算**。

---

## 3. 采样时收集了哪些数据？

每次采样由 `main/time-monitor-service.js` 的 `collectSample()` 生成，包含：

- `timestamp`：采样时间（`Date.now()`）
- `processName`：当前前台窗口进程名（经过归一化）
- `windowTitle`：当前前台窗口标题
- `processId`：前台窗口进程 ID
- `appId`：应用唯一标识（通常由进程名生成，异常时回退到 pid/标题）
- `idleSeconds`：系统空闲秒数（无键鼠操作时增长）
- `isTrackerApp`：是否是本应用窗口（避免把自己计时进去）
- `isFilteredOut`：是否被白名单/黑名单过滤
- `cpuLoad`、`memoryLoad`、`isFullscreen`（可选指标）

其中前台窗口的底层来源是 `main/foreground.js`：

- Windows：通过 PowerShell + WinAPI 获取前台窗口句柄、标题、进程信息
- macOS：通过 AppleScript 获取 frontmost app 与窗口标题

---

## 4. 我们是如何采样的？

采样流程：

1. `electron-main.js` 中 `monitor.start()`
2. `TimeMonitorService.start()` 先执行一次 `tick()`
3. 然后按 `sampleIntervalMs` 周期执行（当前配置是 `1000ms`，即 1 秒）
4. 每次 `tick()`：
   - 调用 `collectSample()` 采集当前状态
   - 交给 `ActivityEngine.ingest(sample)` 更新计时状态
   - 通过 IPC `time-stats:update` 推送到前端

---

## 5. 采样和“切换应用”是什么关系？

切换应用不是事件驱动，而是**通过相邻采样对比**判断：

- 在 `main/activity-engine.js` 中：
  - `hasAppSwitch = sample.appId !== this.currentSession.appId`
- 若为 `true`，判定发生应用切换：
  - 记录 `transitions`
  - 更新 `currentSession`（含新的 `enteredAt = timestamp`）

同时，上一段时间（`deltaMs = timestamp - lastTimestamp`）会累计给切换前的应用桶 `perAppToday[currentSession.appId].durationMs`。

---

## 6. 计时暂停/不计入的场景

在 `ActivityEngine.ingest()` 中，以下场景会暂停对应用时长的累计：

- 系统空闲超阈值（`idleSeconds >= breakThresholdSeconds`）
- 当前是 Time Manager 自身窗口（`isTrackerApp`）
- 当前应用被过滤（`isFilteredOut`）

这就是为什么“有采样”不一定“有时长增长”。

---

## 7. 前端看到的核心快照字段（简化）

- `timestamp`
- `current: { appId, processName, windowTitle, enteredAt, idleSeconds, isOnBreak }`
- `perAppToday: [{ appId, processName, windowTitle, durationMs }, ...]`
- `continuousUseMs`
- `breakCompletedMs`
- `transitions`

以上字段由主进程计算后，经 `preload.cjs` 暴露的 `timeManagerAPI` 提供给前端：

- `getSnapshot()`
- `onUpdate(callback)`
