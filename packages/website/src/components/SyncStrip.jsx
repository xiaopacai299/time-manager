import { motion } from 'framer-motion';
import { SYNC_PLATFORMS } from '../data/siteContent.js';
import Reveal from './Reveal.jsx';

export default function SyncStrip() {
  return (
    <section className="section sync" id="sync">
      <Reveal className="section__head section__head--center">
        <h2>多端同步</h2>
      </Reveal>

      <div className="sync__flow">
        <motion.div
          className="sync__line"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.33, 1, 0.68, 1] }}
        />
        <div className="sync__nodes">
          {SYNC_PLATFORMS.map((p, index) => (
            <Reveal key={p.name} delay={index * 0.12} y={20}>
              <motion.div
                className="sync__node"
                whileHover={{ y: -4 }}
              >
                <span className="sync__node-icon">{p.icon}</span>
                <strong>{p.name}</strong>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
