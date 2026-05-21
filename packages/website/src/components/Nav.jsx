import { motion } from 'framer-motion';
import { APP_ICON, APP_NAME, NAV_ITEMS } from '../data/siteContent.js';

export default function Nav() {
  return (
    <motion.header
      className="site-nav"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.33, 1, 0.68, 1] }}
    >
      <a className="site-nav__brand" href="#top">
        <img className="site-nav__logo" src={APP_ICON} alt="" width={36} height={36} />
        <span>{APP_NAME}</span>
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
