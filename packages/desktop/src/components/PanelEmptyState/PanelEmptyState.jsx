import "./PanelEmptyState.css";

/**
 * 面板空白占位：虚线框 + 剪贴板图标 + 骨架线。
 * @param {'neutral'|'accent'|'q1'|'q2'|'q3'|'q4'} [variant]
 * @param {boolean} [fill] 在父级 flex 容器中占满并居中
 * @param {string} [title]
 * @param {string} [ariaLabel]
 * @param {string} [caption] 壳下方短文案（可选）
 * @param {string} [className]
 */
export default function PanelEmptyState({
  variant = "neutral",
  fill = false,
  title,
  ariaLabel,
  caption,
  className = "",
}) {
  const rootClass = [
    "tm-panel-empty",
    `tm-panel-empty--${variant}`,
    fill ? "tm-panel-empty--fill" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClass}
      title={title}
      aria-label={ariaLabel || title || caption}
    >
      <div
        className="tm-panel-empty__shell"
        aria-hidden={caption ? undefined : true}
      >
        <span className="tm-panel-empty__glyph" />
        <span className="tm-panel-empty__line" />
        <span className="tm-panel-empty__line tm-panel-empty__line--mid" />
        <span className="tm-panel-empty__line tm-panel-empty__line--short" />
      </div>
      {caption ? <p className="tm-panel-empty__caption">{caption}</p> : null}
    </div>
  );
}
