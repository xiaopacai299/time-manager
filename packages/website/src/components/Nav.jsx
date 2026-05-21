import { motion } from 'framer-motion';
import { NAV_ITEMS } from '../data/siteContent.js';

export default function Nav() {
  return (
    <motion.header
      className="site-nav"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.33, 1, 0.68, 1] }}
    >
      <a className="site-nav__brand" href="#top">
        <span className="site-nav__logo" aria-hidden="true">
          WM
        </span>
        <span>
          Work Master
          <small>时间管家</small>
        </span>
      </a>
      <nav className="site-nav__links" aria-label="页面导航">
        {NAV_ITEMS.map((item) => (
          <a key={item.id} href={`#${item.id}`}>
            {item.label}
          </a>
        ))}
      </nav>
      <a className="site-nav__cta" href="#download">
        免费下载
      </a>
    </motion.header>
  );
}
