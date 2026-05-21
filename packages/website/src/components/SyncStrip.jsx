import { SYNC_PLATFORMS } from '../data/siteContent.js';
import Reveal from './Reveal.jsx';

export default function SyncStrip() {
  return (
    <section className="section sync" id="sync">
      <Reveal className="section__head section__head--center">
        <h2>多端同步</h2>
      </Reveal>

      <Reveal className="sync__flow">
        <div className="sync__line" aria-hidden="true" />
        <div className="sync__nodes">
          {SYNC_PLATFORMS.map((p, index) => (
            <Reveal key={p.name} delay={index * 0.1} y={20}>
              <div className="sync__node">
                <span className="sync__node-icon">{p.icon}</span>
                <strong>{p.name}</strong>
              </div>
            </Reveal>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
