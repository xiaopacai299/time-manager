/**
 * 从快照推导当前前台会话已持续时长、今日各应用累计总时长。
 * 1. 使用：`src/App.jsx`、`PetStatsPanel`
 */
export function getSnapshotDurationStats(snapshot) {
  const enteredAt = snapshot.current?.enteredAt || 0
  const currentAppElapsedMs =
    !enteredAt ? 0 : Math.max(0, (snapshot.timestamp || 0) - enteredAt)
  const todayTotalMs = (snapshot.perAppToday || []).reduce(
    (total, item) => total + (item.durationMs || 0),
    0,
  )
  return { currentAppElapsedMs, todayTotalMs }
}
