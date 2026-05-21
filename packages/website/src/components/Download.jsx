import { motion } from 'framer-motion';
import { DOWNLOAD_LINKS } from '../data/siteContent.js';
import Reveal from './Reveal.jsx';

function DownloadCard({ platform, data }) {
  const hasLink = Boolean(String(data.href || '').trim());

  return (
    <motion.article
      className="download-card"
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className="download-card__glow" aria-hidden="true" />
      <h3>{data.label}</h3>
      <p className="download-card__hint">{data.hint}</p>
      {hasLink ? (
        <a className="btn btn--primary btn--block" href={data.href} download>
          下载安装包
        </a>
      ) : (
        <span className="download-card__soon">安装包待发布</span>
      )}
    </motion.article>
  );
}

export default function Download() {
  return (
    <section className="section download" id="download">
      <Reveal className="section__head section__head--center">
        <h2>下载</h2>
      </Reveal>

      <div className="download__grid">
        <Reveal delay={0.05}>
          <DownloadCard platform="windows" data={DOWNLOAD_LINKS.windows} />
        </Reveal>
        <Reveal delay={0.12}>
          <DownloadCard platform="android" data={DOWNLOAD_LINKS.android} />
        </Reveal>
      </div>

    </section>
  );
}
