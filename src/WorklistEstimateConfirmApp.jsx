import { useEffect, useMemo, useState } from 'react'
import './WorklistEstimateConfirmApp.css'

const ACTIONS = {
  completed: 'completed',
  incomplete: 'incomplete',
  snooze: 'snooze',
}

function formatDatetime(value) {
  const dt = new Date(String(value || ''))
  if (Number.isNaN(dt.getTime())) return '刚刚'
  return dt.toLocaleString()
}

export default function WorklistEstimateConfirmApp() {
  const [payload, setPayload] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true
    window.timeManagerAPI?.getEstimateConfirmPayload?.().then((data) => {
      if (!mounted) return
      setPayload(data && typeof data === 'object' ? data : null)
    })
    return () => {
      mounted = false
    }
  }, [])

  const subtitle = useMemo(() => {
    if (!payload) return '没有待确认的工作项'
    return `预估完成时间：${formatDatetime(payload.estimateDoneAt)}`
  }, [payload])

  async function submit(action) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const result = await window.timeManagerAPI?.submitEstimateConfirm?.(action)
      if (!result?.ok) {
        setMessage(result?.error || '提交失败，请稍后重试。')
      }
    } catch {
      setMessage('提交失败，请稍后重试。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="estimate-confirm-page">
      <section className="estimate-confirm-card">
        <div className="estimate-confirm-badge" aria-hidden="true">🐾</div>
        <h1 className="estimate-confirm-title">工作时间到啦</h1>
        <p className="estimate-confirm-subtitle">{subtitle}</p>
        <h2 className="estimate-confirm-name">{payload?.name || '请返回后重试'}</h2>
        <p className="estimate-confirm-note">{payload?.note ? `备注：${payload.note}` : '备注：无'}</p>

        <div className="estimate-confirm-actions">
          <button
            type="button"
            className="estimate-btn estimate-btn--done"
            disabled={busy || !payload}
            onClick={() => submit(ACTIONS.completed)}
          >
            已完成
          </button>
          <button
            type="button"
            className="estimate-btn estimate-btn--undone"
            disabled={busy || !payload}
            onClick={() => submit(ACTIONS.incomplete)}
          >
            未完成
          </button>
          <button
            type="button"
            className="estimate-btn estimate-btn--later"
            disabled={busy || !payload}
            onClick={() => submit(ACTIONS.snooze)}
          >
            稍后提醒
          </button>
        </div>

        {message ? <p className="estimate-confirm-error">{message}</p> : null}
      </section>
    </main>
  )
}
