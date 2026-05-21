/** 全局单一 IntersectionObserver，避免每块内容各挂一个监听器 */
let observer;

function getObserver() {
  if (typeof window === 'undefined') return null;
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('reveal--visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    );
  }
  return observer;
}

/** @param {HTMLElement} el */
export function observeReveal(el) {
  const obs = getObserver();
  if (!obs) return;
  obs.observe(el);
}
