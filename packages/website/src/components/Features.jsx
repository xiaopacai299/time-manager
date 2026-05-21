import { motion } from 'framer-motion';
import { FEATURE_GROUPS } from '../data/siteContent.js';
import Reveal from './Reveal.jsx';

export default function Features() {
  return (
    <section className="section features" id="features">
      <Reveal className="section__head">
        <h2>功能</h2>
      </Reveal>

      {FEATURE_GROUPS.map((group) => (
        <div key={group.tag} className="features__group">
          <Reveal delay={0.05}>
            <div className="features__group-head">
              <span className="features__tag">{group.tag}</span>
            </div>
          </Reveal>
          <div className="features__grid">
            {group.items.map((item, index) => (
              <Reveal key={item.title} delay={0.08 + index * 0.05}>
                <motion.article
                  className="feature-card"
                  whileHover={{ y: -6, scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                >
                  <span className="feature-card__icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <h4>{item.title}</h4>
                  <span className="feature-card__shine" aria-hidden="true" />
                </motion.article>
              </Reveal>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
