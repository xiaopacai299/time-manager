import { formatDuration } from '../../utils/formatDuration'

/**
 * 宠物窗口内统计说明与今日数据列表（样式沿用 `App.css` 的 `.stats-panel`）。
 */
export default function PetStatsPanel({ snapshot, topApps, durationStats }) {
  const { currentAppElapsedMs, todayTotalMs } = durationStats

  return (
    <section className="stats-panel">
      <p>快捷键：按住 Alt 临时关闭穿透，松开恢复。</p>
      <p>控制项：右键宠物或托盘菜单 -&gt; 穿透/面板/模式/动作测试。</p>
      <p>当前应用：{snapshot.current.windowTitle || '无窗口标题'}</p>
      <p>当前应用时长：{formatDuration(currentAppElapsedMs)}</p>
      <p>今日总时长：{formatDuration(todayTotalMs)}</p>
      <p>休息累计：{formatDuration(snapshot.breakCompletedMs)}</p>
      <h4>今日 Top 应用</h4>
      <ul>
        {topApps.length === 0 ? (
          <li>暂无数据</li>
        ) : (
          topApps.slice(0, 5).map((item) => (
            <li key={item.appId}>
              {item.appName}: {formatDuration(item.durationMs)}
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
