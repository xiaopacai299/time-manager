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
        <>
          <span className="download-card__soon">安装包待发布</span>
          <p className="download-card__build">{data.buildNote}</p>
        </>
      )}
    </motion.article>
  );
}

export default function Download() {
  return (
    <section className="section download" id="download">
      <Reveal className="section__head section__head--center">
        <p className="section__eyebrow">Download</p>
        <h2>开始你的专注之旅</h2>
        <p>下载桌面端获得完整体验；移动端用于查看统计、清单与日记。</p>
      </Reveal>

      <div className="download__grid">
        <Reveal delay={0.05}>
          <DownloadCard platform="windows" data={DOWNLOAD_LINKS.windows} />
        </Reveal>
        <Reveal delay={0.12}>
          <DownloadCard platform="android" data={DOWNLOAD_LINKS.android} />
        </Reveal>
      </div>

      <Reveal delay={0.18}>
        <div className="download__note">
          <p>
            开源 monorepo 结构：桌面 Electron、移动 Expo、Node 同步服务与共享协议包。开发者可在本地
            <code> pnpm install </code> 后分别启动各端。
          </p>
        </div>
      </Reveal>
    </section>
  );
}
