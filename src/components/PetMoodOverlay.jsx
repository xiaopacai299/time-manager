import './PetMoodOverlay.css'

/**
 * 叠在 bad-cat Lottie 上的道具层（viewBox 400×400，内层 scale(2) 对应 200 设计稿单位）。
 */
export default function PetMoodOverlay({ mood }) {
  const showRestHandCup = mood === 'rest'
  const showDesk = mood === 'work' || mood === 'remind' || mood === 'long-work'
  const showPainBack = mood === 'remind' || mood === 'long-work'
  const showPainHead = mood === 'long-work'
  const showDizzy = mood === 'long-work'
  const showWarn = mood === 'remind'

  return (
    <svg className={`pet-mood-overlay pet-mood-overlay--${mood}`} viewBox="0 0 400 400" aria-hidden="true">
      <defs>
        <linearGradient id="petMoodPainGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,90,90,0.55)" />
          <stop offset="100%" stopColor="rgba(255,50,50,0.12)" />
        </linearGradient>
        <linearGradient id="petMoodHeadPainGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,70,70,0.5)" />
          <stop offset="100%" stopColor="rgba(255,40,40,0.08)" />
        </linearGradient>
      </defs>
      <g className="pet-mood-overlay__inner" transform="scale(2)">
        {showDesk && (
          <g className="pet-mood-overlay__desk">
            <rect x="28" y="152" width="144" height="8" rx="3" fill="#c4b8a8" />
            <rect x="36" y="138" width="128" height="16" rx="2" fill="#faf6ef" stroke="#d7cfc0" strokeWidth="1" />
          </g>
        )}

        {showPainBack && (
          <ellipse
            className="pet-mood-overlay__pain-back"
            cx="100"
            cy="118"
            rx="44"
            ry="36"
            fill="url(#petMoodPainGrad)"
          />
        )}

        {showPainHead && (
          <ellipse
            className="pet-mood-overlay__pain-head"
            cx="100"
            cy="72"
            rx="34"
            ry="30"
            fill="url(#petMoodHeadPainGrad)"
          />
        )}

        {showDesk && (
          <g className="pet-mood-overlay__glasses" stroke="#2a2a2a" strokeWidth="2.2" fill="none">
            <ellipse cx="86" cy="80" rx="17" ry="14" />
            <ellipse cx="114" cy="80" rx="17" ry="14" />
            <line x1="103" y1="80" x2="97" y2="80" strokeLinecap="round" />
            <line x1="69" y1="78" x2="62" y2="76" strokeLinecap="round" />
            <line x1="131" y1="78" x2="138" y2="76" strokeLinecap="round" />
          </g>
        )}

        {showWarn && (
          <g transform="translate(148, 38)">
            <g className="pet-mood-overlay__warn-badge">
              <circle r="11" fill="#ffd54a" />
              <circle r="8.5" fill="#ffeb7a" opacity="0.45" />
              <rect x="-1.6" y="-5" width="3.2" height="6.5" rx="1" fill="#7a4a00" />
              <circle cy="4.5" r="1.4" fill="#7a4a00" />
            </g>
          </g>
        )}

        {/*
          休息态叠加层说明（杯子不在这里画）：
          - 杯子：由底层 Lottie `bad-cat` 休息变体里的 `cup` 层渲染，水平翻转等在 `src/utils/badCatRestVariant.js`。
          - 下面第一个 <g>：杯口上方的三道白线 = 热气（不是杯子）。
          - 下面 <ellipse>：左手前爪的简化占位（与 `pet-mood-overlay__rest-hand-sway` 一起做轻微上下动）。
          坐标：合成 400×400，内层先有 scale(2)，故此处数值约为合成坐标的一半。
        */}
        {showRestHandCup && (
          <g className="pet-mood-overlay__rest-hand-sway">
            {/* 热气（白烟），非杯身 */}
            <g
              className="pet-mood-overlay__steam-rest"
              transform="translate(15, 90)"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            >
              <path d="M 10 6 Q 8 -2 12 -12" />
              <path d="M 20 4 Q 18 -6 22 -16" />
              <path d="M 30 6 Q 28 -3 32 -13" />
            </g>
            {/* 左手（前爪） */}
            <ellipse
              cx="60"
              cy="132"
              rx="15"
              ry="11"
              fill="#141414"
              stroke="#0a0a0a"
              strokeWidth="0.5"
              opacity="0.95"
            />
          </g>
        )}

        {showDesk && (
          <g className="pet-mood-overlay__scribble" fill="none" stroke="#6d6d8a" strokeWidth="1.4" strokeLinecap="round">
            <path className="pet-mood-overlay__scribble-line pet-mood-overlay__scribble-line--a" d="M 48 148 L 92 146 L 78 150 L 118 147" />
            <path className="pet-mood-overlay__scribble-line pet-mood-overlay__scribble-line--b" d="M 52 154 L 88 152 L 104 155 L 132 151" />
          </g>
        )}

        {showDesk && (
          <g transform="translate(108, 118)">
            <g className="pet-mood-overlay__pen-arm">
              <ellipse cx="0" cy="8" rx="16" ry="12" fill="#252525" />
              <g className="pet-mood-overlay__pen" transform="translate(6, -4)">
                <rect x="-4" y="-2" width="8" height="26" rx="2" fill="#1565c0" />
                <path d="M 0 24 L -3 32 L 3 32 Z" fill="#0d47a1" />
                <rect x="-2" y="-8" width="4" height="8" rx="1" fill="#ffc107" />
              </g>
            </g>
          </g>
        )}

        {showDizzy && (
          <g transform="translate(100, 80)">
            <g className="pet-mood-overlay__dizzy">
              <circle r="22" fill="none" stroke="rgba(120,120,140,0.55)" strokeWidth="2" strokeDasharray="5 7" />
              <circle r="30" fill="none" stroke="rgba(100,100,130,0.45)" strokeWidth="1.6" strokeDasharray="4 9" />
              <circle r="38" fill="none" stroke="rgba(90,90,120,0.35)" strokeWidth="1.4" strokeDasharray="3 11" />
            </g>
          </g>
        )}
      </g>
    </svg>
  )
}
