import { motion } from 'framer-motion';
import { SYNC_PLATFORMS } from '../data/siteContent.js';
import Reveal from './Reveal.jsx';

export default function SyncStrip() {
  return (
    <section className="section sync" id="sync">
      <Reveal className="section__head section__head--center">
        <p className="section__eyebrow">Sync</p>
        <h2>桌面 + 手机 + 云端</h2>
        <p>同一账号，增量同步工作清单、日记、备忘录与时间记录。</p>
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
                <p>{p.desc}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
