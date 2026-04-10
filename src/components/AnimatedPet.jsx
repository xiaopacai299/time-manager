import { useEffect, useMemo, useState } from 'react'

const BLINK_MS_MIN = 2200
const BLINK_MS_MAX = 5200

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export default function AnimatedPet({ mood = 'idle' }) {
  const [blink, setBlink] = useState(false)

  useEffect(() => {
    let timer = null
    let closeTimer = null
    const tick = () => {
      timer = setTimeout(() => {
        setBlink(true)
        closeTimer = setTimeout(() => {
          setBlink(false)
          tick()
        }, 150)
      }, rand(BLINK_MS_MIN, BLINK_MS_MAX))
    }
    tick()
    return () => {
      if (timer) clearTimeout(timer)
      if (closeTimer) clearTimeout(closeTimer)
    }
  }, [])

  const moodClass = useMemo(() => `pet-svg-${mood}`, [mood])
  const isSleep = mood === 'sleep'
  const isWarn = mood === 'warn'
  const isCelebrate = mood === 'celebrate'

  return (
    <svg className={`pet-svg ${moodClass}`} viewBox="0 0 180 180" aria-label="animated pet fox" role="img">
      <defs>
        <radialGradient id="foxBody" cx="30%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffd7a5" />
          <stop offset="100%" stopColor="#ff9f53" />
        </radialGradient>
      </defs>

      <g className="pet-root">
        <g className="pet-tail">
          <path
            className="pet-tail-shape"
            d="M130 98 C158 78 166 116 136 126 C158 114 151 141 126 140 C141 131 138 110 116 109 C122 105 125 101 130 98 Z"
            fill="#ff8e45"
          >
            <animate
              attributeName="d"
              dur="0.9s"
              repeatCount="indefinite"
              values="
                M130 98 C158 78 166 116 136 126 C158 114 151 141 126 140 C141 131 138 110 116 109 C122 105 125 101 130 98 Z;
                M130 98 C161 82 171 112 140 124 C162 112 157 143 128 142 C143 130 142 106 118 108 C124 104 127 100 130 98 Z;
                M130 98 C158 78 166 116 136 126 C158 114 151 141 126 140 C141 131 138 110 116 109 C122 105 125 101 130 98 Z"
            />
          </path>
        </g>

        <g className="pet-body-wrap">
          <ellipse className="pet-body" cx="90" cy="104" rx="43" ry="34" fill="url(#foxBody)" />
          <ellipse className="pet-belly" cx="90" cy="111" rx="20" ry="15" fill="#ffe9cf" />
        </g>

        <g className="pet-leg-back pet-leg">
          <rect x="60" y="123" width="11" height="30" rx="5" fill="#f28a42" />
          <rect x="59" y="147" width="13" height="8" rx="4" fill="#6a371a" />
        </g>
        <g className="pet-leg-front pet-leg">
          <rect x="108" y="123" width="11" height="30" rx="5" fill="#f28a42" />
          <rect x="107" y="147" width="13" height="8" rx="4" fill="#6a371a" />
        </g>

        <g className="pet-head-wrap">
          <circle className="pet-head" cx="90" cy="72" r="31" fill="#ffac63" />

          <g className="pet-ear-l">
            <path d="M67 50 L74 22 L86 46 Z" fill="#f28a42" />
            <path d="M73 47 L77 31 L83 44 Z" fill="#ffd5b0" />
          </g>
          <g className="pet-ear-r">
            <path d="M113 50 L106 22 L94 46 Z" fill="#f28a42" />
            <path d="M107 47 L103 31 L97 44 Z" fill="#ffd5b0" />
          </g>

          <ellipse cx="90" cy="83" rx="18" ry="12" fill="#ffe9cf" />
          <circle cx="90" cy="80" r="3.5" fill="#5a2f13" />
          <path
            className="pet-mouth"
            d={isSleep ? 'M83 89 Q90 86 97 89' : isWarn ? 'M83 91 Q90 84 97 91' : 'M82 88 Q90 95 98 88'}
            stroke="#5a2f13"
            strokeWidth="2.3"
            fill="none"
          />

          <g className={`pet-eyes ${blink ? 'is-blink' : ''}`}>
            <ellipse className="pet-eye-l" cx="79" cy="72" rx="4.2" ry="6.5" fill="#2e1e13" />
            <ellipse className="pet-eye-r" cx="101" cy="72" rx="4.2" ry="6.5" fill="#2e1e13" />
          </g>
        </g>

        {isSleep && (
          <g className="pet-sleep-z">
            <text x="124" y="44" fontSize="14" fill="#7da5ff">z</text>
            <text x="136" y="34" fontSize="11" fill="#9cbcff">z</text>
          </g>
        )}
        {isWarn && (
          <g className="pet-warn-mark">
            <circle cx="135" cy="42" r="10" fill="#ffd26a" />
            <rect x="133.7" y="36" width="2.6" height="8" rx="1.2" fill="#7a3a00" />
            <circle cx="135" cy="47.2" r="1.3" fill="#7a3a00" />
          </g>
        )}
        {isCelebrate && (
          <g className="pet-celebrate-stars">
            <path d="M48 44 L51 51 L58 52 L52.5 57 L54 64 L48 60 L42 64 L43.5 57 L38 52 L45 51 Z" fill="#ffe36d" />
            <path d="M128 26 L130 31 L136 32 L131.5 36 L133 41 L128 38 L123 41 L124.5 36 L120 32 L126 31 Z" fill="#fff1a6" />
          </g>
        )}
      </g>
    </svg>
  )
}
