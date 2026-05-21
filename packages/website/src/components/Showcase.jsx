import { SHOWCASE_BENTO, SHOWCASE_SPOTLIGHTS } from '../data/siteContent.js';
import Reveal from './Reveal.jsx';
import ScreenshotFrame from './ScreenshotFrame.jsx';

export default function Showcase() {
  return (
    <section className="section showcase" id="showcase">
      <div className="showcase__bg" aria-hidden="true" />
      <Reveal className="section__head section__head--center showcase__intro">
        <h2>界面预览</h2>
      </Reveal>

      <div className="showcase__bento">
        {SHOWCASE_BENTO.map((item, index) => (
          <Reveal
            key={item.src}
            delay={index * 0.05}
            className={`showcase__bento-cell showcase__bento-cell--${item.size}`}
          >
            <ScreenshotFrame
              src={item.src}
              alt={item.alt}
              caption={item.label}
              variant={item.size === 'hero' ? 'hero' : 'default'}
              tilt={item.size === 'hero'}
            />
          </Reveal>
        ))}
      </div>

      <div className="showcase__spotlights">
        {SHOWCASE_SPOTLIGHTS.map((spot) => {
          const imageFirst = spot.align === 'left';
          return (
            <article
              key={spot.id}
              className={`showcase__spot${imageFirst ? '' : ' showcase__spot--reverse'}`}
            >
              <Reveal className="showcase__spot-media" y={36}>
                <div className="showcase__spot-visual">
                  <ScreenshotFrame
                    src={spot.image}
                    alt={spot.alt}
                    variant="hero"
                    tilt
                  />
                  {spot.inset ? (
                    <Reveal
                      delay={0.15}
                      className="showcase__inset showcase__inset--tr"
                      y={12}
                    >
                      <ScreenshotFrame
                        src={spot.inset.src}
                        alt={spot.inset.alt}
                        caption={spot.inset.caption}
                        variant="inset"
                      />
                    </Reveal>
                  ) : null}
                  {spot.secondary ? (
                    <Reveal
                      delay={0.22}
                      className="showcase__inset showcase__inset--bl"
                      y={12}
                    >
                      <ScreenshotFrame
                        src={spot.secondary.src}
                        alt={spot.secondary.alt}
                        caption={spot.secondary.caption}
                        variant="inset"
                      />
                    </Reveal>
                  ) : null}
                </div>
              </Reveal>

              <Reveal className="showcase__spot-copy" delay={0.08} y={28}>
                <span className="showcase__spot-tag">{spot.tag}</span>
                <h3>{spot.title}</h3>
              </Reveal>
            </article>
          );
        })}
      </div>
    </section>
  );
}
