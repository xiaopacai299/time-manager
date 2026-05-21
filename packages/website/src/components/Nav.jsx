import { APP_ICON, APP_NAME, NAV_ITEMS } from '../data/siteContent.js';
import { useActiveSection } from '../hooks/useActiveSection.js';

const SECTION_IDS = NAV_ITEMS.map((item) => item.id);

export default function Nav() {
  const activeId = useActiveSection(SECTION_IDS, SECTION_IDS[0]);

  return (
    <header className="site-nav">
      <div className="site-nav__inner">
        <a className="site-nav__brand" href="#top">
          <img
            className="site-nav__logo"
            src={APP_ICON}
            alt=""
            width={40}
            height={40}
            decoding="async"
          />
          <span className="site-nav__name">{APP_NAME}</span>
        </a>

        <nav className="site-nav__tabs" aria-label="页面导航">
          <div className="site-nav__track">
            {NAV_ITEMS.map((item) => {
              const isActive = activeId === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`site-nav__tab${isActive ? ' site-nav__tab--active' : ''}`}
                  aria-current={isActive ? 'location' : undefined}
                >
                  <span className="site-nav__tab-glow" aria-hidden="true" />
                  <span className="site-nav__tab-label">{item.label}</span>
                </a>
              );
            })}
          </div>
        </nav>

        <a className="site-nav__cta" href="#download">
          <span>免费下载</span>
        </a>
      </div>
    </header>
  );
}
