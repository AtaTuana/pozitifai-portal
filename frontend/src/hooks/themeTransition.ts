import { visualConfig } from '../config/visual.config';

// CSS and WebGL consume the same sampled value; neither starts a second color animation.
let value = document.documentElement.dataset.theme === 'light' ? 0 : 1;
let target = value;
let frame = 0;
export const themeProgress = () => value;
export function transitionTheme(theme: 'light' | 'dark') {
  const next = theme === 'dark' ? 1 : 0;
  document.documentElement.style.setProperty('--theme-progress', String(value));
  if (next === target) return;
  cancelAnimationFrame(frame);
  target = next;
  const from = value,
    started = performance.now();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const tick = (now: number) => {
    const t = reduced.matches ? 1 : Math.min(1, (now - started) / visualConfig.theme.transitionMs);
    value = from + (target - from) * t * t * (3 - 2 * t);
    document.documentElement.style.setProperty('--theme-progress', String(value));
    window.dispatchEvent(new Event('portal:theme-frame'));
    frame = t < 1 ? requestAnimationFrame(tick) : 0;
  };
  tick(started);
}
