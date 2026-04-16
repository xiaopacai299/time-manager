import './LittleTurtleEffects.css'

export default function LittleTurtleEffects({ mood }) {
  const showWorkRock = mood === 'work'
  if (!showWorkRock) return null

  return (
    <svg className={`little-turtle-overlay little-turtle-overlay--${mood}`} viewBox="0 0 400 400" aria-hidden="true">
      <defs>
        <linearGradient id="turtleRockGrad" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#98a3ad" />
          <stop offset="52%" stopColor="#7c8792" />
          <stop offset="100%" stopColor="#616a73" />
        </linearGradient>
        <radialGradient id="turtleRockHighlight" cx="0.28" cy="0.2" r="0.76">
          <stop offset="0%" stopColor="rgba(232,240,246,0.95)" />
          <stop offset="65%" stopColor="rgba(180,194,206,0)" />
        </radialGradient>
      </defs>

      <g className="little-turtle-overlay__inner" transform="scale(2)">
        <g className="little-turtle-overlay__rock">
          <path
            d="M72 78 C76 70, 89 64, 102 66 C116 68, 126 76, 128 87 C130 101, 122 113, 108 118 C95 123, 79 120, 69 111 C59 101, 61 87, 72 78 Z"
            fill="url(#turtleRockGrad)"
            stroke="#586068"
            strokeWidth="1.8"
          />
          <path
            d="M84 80 C90 75, 101 74, 110 78"
            fill="none"
            stroke="rgba(228,236,243,0.68)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M82 98 C89 94, 98 92, 107 93"
            fill="none"
            stroke="rgba(80,88,97,0.42)"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <ellipse cx="94" cy="88" rx="25" ry="19" fill="url(#turtleRockHighlight)" />
          <ellipse cx="86" cy="104" rx="5.5" ry="3.5" fill="rgba(74,83,92,0.5)" />
        </g>
      </g>
    </svg>
  )
}
