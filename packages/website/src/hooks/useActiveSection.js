import { useEffect, useRef, useState } from 'react';

/**
 * @param {readonly string[]} sectionIds
 * @param {string} [fallback]
 */
export function useActiveSection(sectionIds, fallback = sectionIds[0]) {
  const [active, setActive] = useState(fallback);
  const activeRef = useRef(fallback);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (elements.length === 0) return undefined;

    let raf = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          const next = visible[0]?.target?.id;
          if (!next || next === activeRef.current) return;
          activeRef.current = next;
          setActive(next);
        });
      },
      { rootMargin: '-38% 0px -52% 0px', threshold: 0.2 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [sectionIds]);

  return active;
}
