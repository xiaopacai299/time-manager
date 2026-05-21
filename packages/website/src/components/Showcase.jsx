import { motion } from 'framer-motion';
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

      <Reveal delay={0.08}>
        <div className="showcase__bento">
          {SHOWCASE_BENTO.map((item, index) => (
            <motion.div
              key={item.src}
              className={`showcase__bento-cell showcase__bento-cell--${item.size}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, delay: index * 0.07 }}
            >
              <ScreenshotFrame
                src={item.src}
                alt={item.alt}
                caption={item.label}
                variant={item.size === 'hero' ? 'hero' : 'default'}
                tilt={item.size === 'hero'}
              />
            </motion.div>
          ))}
        </div>
      </Reveal>

      <div className="showcase__spotlights">
        {SHOWCASE_SPOTLIGHTS.map((spot, index) => {
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
                    <motion.div
                      className="showcase__inset showcase__inset--tr"
                      initial={{ opacity: 0, scale: 0.92, y: 16 }}
                      whileInView={{ opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.25, duration: 0.5 }}
                    >
                      <ScreenshotFrame
                        src={spot.inset.src}
                        alt={spot.inset.alt}
                        caption={spot.inset.caption}
                        variant="inset"
                      />
                    </motion.div>
                  ) : null}
                  {spot.secondary ? (
                    <motion.div
                      className="showcase__inset showcase__inset--bl"
                      initial={{ opacity: 0, scale: 0.92, y: 16 }}
                      whileInView={{ opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.35, duration: 0.5 }}
                    >
                      <ScreenshotFrame
                        src={spot.secondary.src}
                        alt={spot.secondary.alt}
                        caption={spot.secondary.caption}
                        variant="inset"
                      />
                    </motion.div>
                  ) : null}
                </div>
              </Reveal>

              <Reveal className="showcase__spot-copy" delay={0.1} y={28}>
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
