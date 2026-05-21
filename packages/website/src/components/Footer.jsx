import { APP_ICON, APP_NAME } from '../data/siteContent.js';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <img className="site-footer__logo" src={APP_ICON} alt="" width={40} height={40} />
          <div>
            <strong>{APP_NAME}</strong>
          </div>
        </div>
        <nav className="site-footer__links" aria-label="页脚导航">
          <a href="#showcase">界面</a>
          <a href="#features">功能</a>
          <a href="#advantages">亮点</a>
          <a href="#sync">多端</a>
          <a href="#download">下载</a>
        </nav>
      </div>
      <p className="site-footer__copy">© {year} {APP_NAME}</p>
    </footer>
  );
}
