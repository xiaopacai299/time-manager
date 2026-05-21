export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-footer__logo">WM</span>
          <div>
            <strong>Work Master</strong>
            <p>时间管家 · 桌面宠物式时间管理</p>
          </div>
        </div>
        <nav className="site-footer__links" aria-label="页脚导航">
          <a href="#features">功能</a>
          <a href="#advantages">亮点</a>
          <a href="#sync">多端</a>
          <a href="#download">下载</a>
        </nav>
      </div>
      <p className="site-footer__copy">© {year} Work Master. All rights reserved.</p>
    </footer>
  );
}
