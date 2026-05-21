import { motion } from 'framer-motion';
import { ADVANTAGES } from '../data/siteContent.js';
import Reveal from './Reveal.jsx';

export default function Advantages() {
  return (
    <section className="section advantages" id="advantages">
      <Reveal className="section__head section__head--center">
        <h2>亮点</h2>
      </Reveal>

      <div className="advantages__grid">
        {ADVANTAGES.map((item, index) => (
          <Reveal key={item.title} delay={index * 0.06}>
            <motion.div
              className="advantage-card"
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            >
              <span className="advantage-card__icon">{item.icon}</span>
              <h3>{item.title}</h3>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
