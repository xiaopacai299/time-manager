import './LittleTurtleSplash.css'

export default function LittleTurtleSplash({ facing = 1 }) {
  const sideClass = facing >= 0 ? 'turtle-splash--back-right' : 'turtle-splash--back-left'
  return (
    <div className={`turtle-splash ${sideClass}`} aria-hidden="true">
      <svg className="turtle-splash__rings" viewBox="0 0 220 150" preserveAspectRatio="none">
        <g className="turtle-splash__ring-wrap turtle-splash__ring-wrap--a">
          <ellipse
            className="turtle-splash__ring turtle-splash__ring--a"
            cx="110"
            cy="76"
            rx="33"
            ry="20"
          />
          <ellipse className="turtle-splash__ring-accent turtle-splash__ring-accent--a1" cx="110" cy="76" rx="33" ry="20" />
          <ellipse className="turtle-splash__ring-accent turtle-splash__ring-accent--a2" cx="110" cy="76" rx="33" ry="20" />
        </g>
        <g className="turtle-splash__ring-wrap turtle-splash__ring-wrap--b">
          <ellipse
            className="turtle-splash__ring turtle-splash__ring--b"
            cx="110"
            cy="76"
            rx="47"
            ry="28"
          />
          <ellipse className="turtle-splash__ring-accent turtle-splash__ring-accent--b1" cx="110" cy="76" rx="47" ry="28" />
          <ellipse className="turtle-splash__ring-accent turtle-splash__ring-accent--b2" cx="110" cy="76" rx="47" ry="28" />
        </g>
        <g className="turtle-splash__ring-wrap turtle-splash__ring-wrap--c">
          <ellipse
            className="turtle-splash__ring turtle-splash__ring--c"
            cx="110"
            cy="76"
            rx="61"
            ry="36"
          />
          <ellipse className="turtle-splash__ring-accent turtle-splash__ring-accent--c1" cx="110" cy="76" rx="61" ry="36" />
          <ellipse className="turtle-splash__ring-accent turtle-splash__ring-accent--c2" cx="110" cy="76" rx="61" ry="36" />
        </g>
      </svg>
    </div>
  )
}
