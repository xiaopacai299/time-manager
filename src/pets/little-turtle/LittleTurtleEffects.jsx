import './LittleTurtleEffects.css'

export default function LittleTurtleEffects({ mood }) {
  const showBackRock = mood === 'work'
  const showRockStack3 = mood === 'remind'
  const showRockStack5 = mood === 'long-work'
  const showSweat = mood === 'remind'
  const showFoam = mood === 'long-work'
  if (!showBackRock && !showRockStack3 && !showRockStack5 && !showSweat && !showFoam) return null

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
        {showBackRock ? (
          <g className="little-turtle-overlay__rock little-turtle-overlay__rock--back" aria-hidden="true">
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
        ) : null}

        {showRockStack3 ? (
          <g className="little-turtle-overlay__rock-stack little-turtle-overlay__rock-stack--3">
            <g className="little-turtle-overlay__rock little-turtle-overlay__rock--left">
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

            <g className="little-turtle-overlay__rock little-turtle-overlay__rock--middle">
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

            <g className="little-turtle-overlay__rock little-turtle-overlay__rock--right">
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
        ) : null}

        {showRockStack5 ? (
          <g className="little-turtle-overlay__rock-stack little-turtle-overlay__rock-stack--5">
            <g className="little-turtle-overlay__rock little-turtle-overlay__rock--alarm-1">
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

            <g className="little-turtle-overlay__rock little-turtle-overlay__rock--alarm-2">
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

            <g className="little-turtle-overlay__rock little-turtle-overlay__rock--alarm-3">
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

            <g className="little-turtle-overlay__rock little-turtle-overlay__rock--alarm-4">
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

            <g className="little-turtle-overlay__rock little-turtle-overlay__rock--alarm-5">
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
        ) : null}

        {showSweat ? (
          <g className="little-turtle-overlay__sweat">
            <path
              className="little-turtle-overlay__sweat-drop little-turtle-overlay__sweat-drop--main"
              d="M112 83 C116 74, 124 68, 129 68 C134 68, 140 73, 140 81 C140 90, 135 96, 129 96 C121 96, 114 90, 112 83 Z"
              fill="#92d7ff"
              stroke="rgba(46, 110, 156, 0.75)"
              strokeWidth="1.2"
            />
            <path
              className="little-turtle-overlay__sweat-drop little-turtle-overlay__sweat-drop--small"
              d="M102 88 C104 83, 109 80, 112 80 C115 80, 118 83, 118 87 C118 92, 115 95, 111 95 C106 95, 102 92, 102 88 Z"
              fill="#bfe9ff"
              stroke="rgba(70, 132, 177, 0.7)"
              strokeWidth="1"
            />
          </g>
        ) : null}

        {showFoam ? (
          <g className="little-turtle-overlay__foam" aria-hidden="true">
            <circle className="little-turtle-overlay__foam-bubble little-turtle-overlay__foam-bubble--a" cx="160" cy="90" r="7" fill="rgba(255,255,255,0.9)" />
            <circle className="little-turtle-overlay__foam-bubble little-turtle-overlay__foam-bubble--b" cx="150" cy="100" r="5.5" fill="rgba(255,255,255,0.86)" />
            <circle className="little-turtle-overlay__foam-bubble little-turtle-overlay__foam-bubble--c" cx="150" cy="120" r="4.2" fill="rgba(255,255,255,0.82)" />
            <circle className="little-turtle-overlay__foam-bubble little-turtle-overlay__foam-bubble--d" cx="154" cy="130" r="3.6" fill="rgba(255,255,255,0.78)" />
          </g>
        ) : null}
      </g>
    </svg>
  )
}
