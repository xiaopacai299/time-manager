import { useMemo } from 'react'
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { formatDuration } from '../../utils/formatDuration'
import './PetStatsPanel.css'

const PIE_WORK = '#6366f1'
const PIE_REST = '#34d399'

const RANK_BAR_GRADIENTS = [
  'linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #fcd34d 100%)',
  'linear-gradient(90deg, #64748b 0%, #94a3b8 50%, #cbd5e1 100%)',
  'linear-gradient(90deg, #c2410c 0%, #ea580c 50%, #fb923c 100%)',
  'linear-gradient(90deg, #6d28d9 0%, #8b5cf6 50%, #a78bfa 100%)',
  'linear-gradient(90deg, #db2777 0%, #ec4899 50%, #f472b6 100%)',
]

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="recharts-default-tooltip" style={{ padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 700 }}>{name}</div>
      <div style={{ color: '#6366f1' }}>{formatDuration(value)}</div>
    </div>
  )
}

/**
 * 统计面板：当前应用标题 + 居中时长、Top 排行进度条、工作/休息饼图。
 */
export default function PetStatsPanel({ snapshot, topApps, durationStats }) {
  const { currentAppElapsedMs, todayTotalMs } = durationStats
  const workMs = todayTotalMs || 0
  const restMs = snapshot.breakCompletedMs || 0

  const displayApps = useMemo(() => topApps.slice(0, 5), [topApps])
  const maxBarMs = useMemo(() => {
    if (!displayApps.length) return 0
    return Math.max(...displayApps.map((a) => a.durationMs || 0), 1)
  }, [displayApps])

  const pieSlices = useMemo(() => {
    const rows = [
      { name: '今日工作', value: workMs },
      { name: '今日休息', value: restMs },
    ]
    return rows.filter((r) => r.value > 0)
  }, [workMs, restMs])

  const pieTotal = workMs + restMs
  const currentTitle =
    (snapshot.current?.windowTitle || '').trim() ||
    snapshot.current?.processName ||
    '无窗口标题'

  return (
    <section className="stats-panel pet-stats-panel">
      <div className="pet-stats-panel__current">
        <p className="pet-stats-panel__current-label">当前应用</p>
        <h2 className="pet-stats-panel__current-title" title={currentTitle}>
          {currentTitle}
        </h2>
        <p className="pet-stats-panel__current-duration">{formatDuration(currentAppElapsedMs)}</p>
      </div>

      <div>
        <h3 className="pet-stats-panel__section-title">今日应用排行</h3>
        <div className="pet-stats-panel__rank-list">
          {displayApps.length === 0 ? (
            <p style={{ margin: 0, color: '#64748b', textAlign: 'center' }}>暂无数据</p>
          ) : (
            displayApps.map((item, index) => {
              const rank = index + 1
              const ms = item.durationMs || 0
              const pct = maxBarMs > 0 ? Math.min(100, Math.round((ms / maxBarMs) * 100)) : 0
              return (
                <div key={item.appId} className="pet-stats-panel__rank-row">
                  <div className="pet-stats-panel__rank-badge" data-rank={String(rank)}>
                    {rank}
                  </div>
                  <div className="pet-stats-panel__rank-meta">
                    <span className="pet-stats-panel__rank-name" title={item.appName}>
                      {item.appName}
                    </span>
                    <span className="pet-stats-panel__rank-time">{formatDuration(ms)}</span>
                  </div>
                  <div className="pet-stats-panel__bar-track">
                    <div
                      className="pet-stats-panel__bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: RANK_BAR_GRADIENTS[index % RANK_BAR_GRADIENTS.length],
                      }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div>
        <h3 className="pet-stats-panel__section-title">今日时间分配</h3>
        <div className="pet-stats-panel__split">
          <div className="pet-stats-panel__totals">
            <div className="pet-stats-panel__total-pill pet-stats-panel__total-pill--work">
              <span>工作总时长</span>
              <span>{formatDuration(workMs)}</span>
            </div>
            <div className="pet-stats-panel__total-pill pet-stats-panel__total-pill--rest">
              <span>休息总时长</span>
              <span>{formatDuration(restMs)}</span>
            </div>
          </div>
          <div className="pet-stats-panel__chart-card">
            <h3>工作 / 休息</h3>
            {pieTotal <= 0 ? (
              <div className="pet-stats-panel__pie-empty">暂无累计数据</div>
            ) : (
              <div className="pet-stats-panel__chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieSlices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="48%"
                      outerRadius="78%"
                      paddingAngle={pieSlices.length > 1 ? 2 : 0}
                      stroke="rgba(255,255,255,0.85)"
                      strokeWidth={2}
                    >
                      {pieSlices.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.name === '今日工作' ? PIE_WORK : PIE_REST}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      formatter={(value) => <span style={{ color: '#475569', fontSize: 11 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="pet-stats-panel__footnote">
        提示：按住 Alt 可临时关闭鼠标穿透；右键宠物或托盘可调整穿透、面板与模式。
      </p>
    </section>
  )
}
