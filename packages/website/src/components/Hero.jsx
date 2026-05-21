import { motion } from 'framer-motion';

const floatTransition = {
  duration: 5,
  repeat: Infinity,
  repeatType: 'reverse',
  ease: 'easeInOut',
};

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero__mesh" aria-hidden="true">
        <motion.span
          className="hero__orb hero__orb--a"
          animate={{ x: [0, 24, -12, 0], y: [0, -18, 10, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="hero__orb hero__orb--b"
          animate={{ x: [0, -30, 16, 0], y: [0, 22, -8, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="hero__orb hero__orb--c"
          animate={{ scale: [1, 1.08, 0.96, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="hero__grid">
        <motion.div
          className="hero__copy"
          initial={{ opacity: 0, x: -32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.75, delay: 0.1 }}
        >
          <p className="hero__eyebrow">Desktop Pet · Time & Focus</p>
          <h1>
            让时间管理
            <br />
            <span className="hero__gradient-text">温柔而高级</span>
          </h1>
          <p className="hero__lead">
            Work Master（时间管家）把专注统计、四象限清单、备忘录月历、日记与 AI
            助手，收进一只常驻桌面的玻璃风宠物里——陪你专注，而不打断心流。
          </p>
          <div className="hero__actions">
            <a className="btn btn--primary" href="#download">
              立即下载
            </a>
            <a className="btn btn--ghost" href="#features">
              探索功能
            </a>
          </div>
          <ul className="hero__stats">
            <li>
              <strong>10+</strong>
              <span>核心模块</span>
            </li>
            <li>
              <strong>3</strong>
              <span>端数据同步</span>
            </li>
            <li>
              <strong>0</strong>
              <span>广告打扰</span>
            </li>
          </ul>
        </motion.div>

        <motion.div
          className="hero__visual"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <motion.div
            className="hero__pet-card"
            animate={{ y: [0, -10, 0] }}
            transition={floatTransition}
          >
            <div className="hero__pet-face" aria-hidden="true">
              <span className="hero__pet-eye" />
              <span className="hero__pet-eye" />
            </div>
            <div className="hero__pet-bubble">已连续专注 42 分钟，起来走走？</div>
            <div className="hero__pet-panel">
              <div className="hero__pet-row">
                <span>今日 Top</span>
                <strong>VS Code</strong>
              </div>
              <div className="hero__pet-bar">
                <span style={{ width: '78%' }} />
              </div>
              <div className="hero__pet-chips">
                <span>工作清单</span>
                <span>备忘录</span>
                <span>AI</span>
              </div>
            </div>
          </motion.div>
          <motion.div
            className="hero__float-card hero__float-card--memo"
            animate={{ y: [0, 8, 0], rotate: [0, 2, 0] }}
            transition={{ ...floatTransition, duration: 6 }}
          >
            <span>📅</span> 劳动节 · ☀26°
          </motion.div>
          <motion.div
            className="hero__float-card hero__float-card--sync"
            animate={{ y: [0, -6, 0] }}
            transition={{ ...floatTransition, duration: 7, delay: 0.4 }}
          >
            <span>☁️</span> 已同步到手机
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
