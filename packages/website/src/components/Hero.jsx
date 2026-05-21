import { motion } from 'framer-motion';
import { APP_NAME } from '../data/siteContent.js';
import ScreenshotFrame from './ScreenshotFrame.jsx';

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero__grid-lines" aria-hidden="true" />
      <div className="hero__mesh" aria-hidden="true">
        <motion.span
          className="hero__orb hero__orb--a"
          animate={{ x: [0, 32, -16, 0], y: [0, -24, 12, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="hero__orb hero__orb--b"
          animate={{ x: [0, -40, 20, 0], y: [0, 28, -10, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="hero__orb hero__orb--c"
          animate={{ scale: [1, 1.12, 0.94, 1], rotate: [0, 8, -6, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="hero__inner">
        <motion.div
          className="hero__copy"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.05 }}
        >
          <h1 className="hero__gradient-text">{APP_NAME}</h1>
          <p className="hero__lead">桌面宠物 · 任务备忘 · 时间统计</p>
          <div className="hero__actions">
            <a className="btn btn--primary btn--lg" href="#download">
              免费下载
            </a>
            <a className="btn btn--ghost btn--lg" href="#showcase">
              浏览实机界面
            </a>
          </div>
          <ul className="hero__stats">
            <li>
              <strong>7+</strong>
              <span>核心窗口</span>
            </li>
            <li>
              <strong>3</strong>
              <span>端同步</span>
            </li>
            <li>
              <strong>0</strong>
              <span>广告</span>
            </li>
          </ul>
        </motion.div>

        <motion.div
          className="hero__visual"
          initial={{ opacity: 0, y: 40, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.9, delay: 0.15 }}
        >
          <div className="hero__visual-glow" aria-hidden="true" />
          <motion.div
            className="hero__main-shot"
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ScreenshotFrame
              src="/screenshots/memo-calendar.png"
              alt="备忘录月历实机界面"
              variant="hero"
              tilt
            />
          </motion.div>
          <motion.div
            className="hero__float-shot hero__float-shot--matrix"
            animate={{ y: [0, 10, 0], rotate: [0, -2, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          >
            <ScreenshotFrame
              src="/screenshots/worklist-matrix.png"
              alt="四象限工作清单"
              caption="今日计划"
              variant="inset"
            />
          </motion.div>
          <motion.div
            className="hero__float-shot hero__float-shot--ai"
            animate={{ y: [0, -8, 0], rotate: [0, 3, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
          >
            <ScreenshotFrame
              src="/screenshots/ai-chat.png"
              alt="AI 对话"
              caption="AI 对话"
              variant="inset"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
