import { useEffect, useRef } from 'react';
import { observeReveal } from '../utils/revealObserver.js';

export default function Reveal({
  children,
  className = '',
  delay = 0,
  y = 28,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--reveal-y', `${y}px`);
    el.style.setProperty('--reveal-delay', `${delay}s`);
    observeReveal(el);
  }, [delay, y]);

  return (
    <div ref={ref} className={`reveal ${className}`.trim()}>
      {children}
    </div>
  );
}
