import { useEffect, useRef } from 'react';
import { APP_NAME } from '../data/siteContent.js';
import ScreenshotFrame from './ScreenshotFrame.jsx';

export default function Hero() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        el.classList.toggle('hero--inview', entry.isIntersecting);
      },
      { threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="hero hero--inview" id="top" ref={sectionRef}>
      <div className="hero__grid-lines" aria-hidden="true" />
      <div className="hero__mesh" aria-hidden="true">
        <span className="hero__orb hero__orb--a" />
        <span className="hero__orb hero__orb--b" />
        <span className="hero__orb hero__orb--c" />
      </div>

      <div className="hero__inner">
        <div className="hero__copy hero__enter">
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
        </div>

        <div className="hero__visual hero__enter hero__enter--late">
          <div className="hero__visual-glow" aria-hidden="true" />
          <div className="hero__main-shot hero__float-anim hero__float-anim--main">
            <ScreenshotFrame
              src="/screenshots/memo-calendar.png"
              alt="备忘录月历实机界面"
              variant="hero"
              tilt
            />
          </div>
          <div className="hero__float-shot hero__float-shot--matrix hero__float-anim hero__float-anim--matrix">
            <ScreenshotFrame
              src="/screenshots/worklist-matrix.png"
              alt="四象限工作清单"
              caption="今日计划"
              variant="inset"
            />
          </div>
          <div className="hero__float-shot hero__float-shot--ai hero__float-anim hero__float-anim--ai">
            <ScreenshotFrame
              src="/screenshots/ai-chat.png"
              alt="AI 对话"
              caption="AI 对话"
              variant="inset"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
