import { motion } from 'framer-motion';
import { ADVANTAGES } from '../data/siteContent.js';
import Reveal from './Reveal.jsx';

export default function Advantages() {
  return (
    <section className="section advantages" id="advantages">
      <Reveal className="section__head section__head--center">
        <p className="section__eyebrow">Why Work Master</p>
        <h2>为什么选择我们</h2>
        <p>不是又一个冷冰冰的 Todo，而是能长期住在桌面上的时间伙伴。</p>
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
              <p>{item.desc}</p>
            </motion.div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.2}>
        <div className="advantages__quote">
          <p>
            「我需要的是——抬头能看见进度，低头能记下一句话，而不是被又一个全屏工具占满。」
          </p>
          <span>— Work Master 设计初衷</span>
        </div>
      </Reveal>
    </section>
  );
}
