/**
 * @param {object} props
 * @param {string} props.src
 * @param {string} props.alt
 * @param {string} [props.caption]
 * @param {'default' | 'inset' | 'hero'} [props.variant]
 * @param {boolean} [props.tilt]
 */
export default function ScreenshotFrame({
  src,
  alt,
  caption,
  variant = 'default',
  tilt = false,
}) {
  return (
    <figure
      className={`shot-frame shot-frame--${variant}${tilt ? ' shot-frame--tilt' : ''}`}
    >
      <div className="shot-frame__chrome" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="shot-frame__viewport">
        <img src={src} alt={alt} loading="lazy" decoding="async" />
        <div className="shot-frame__sheen" aria-hidden="true" />
      </div>
      {caption ? <figcaption className="shot-frame__caption">{caption}</figcaption> : null}
    </figure>
  );
}
