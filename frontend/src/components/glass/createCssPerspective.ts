import { visualConfig } from '../../config/visual.config';
import { followAmount, logoCssTransform, logoProjection } from './logoProjection';

/** Keep depth movement available without a WebGL context. CSS approximates the camera with a plane. */
export function createCssPerspective(plane: HTMLElement) {
  const settings = visualConfig.perspective;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new AbortController();
  let frame = 0;
  let lastTime = 0;
  let disposed = false;
  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;
  let logoWidth = 1;
  let logoHeight = 1;
  const projection = new Float32Array(9);

  function requestFrame() {
    if (!disposed && !frame && !document.hidden) frame = requestAnimationFrame(render);
  }

  function render(time: number) {
    frame = 0;
    if (disposed || document.hidden) return;
    const dt = Math.min((time - lastTime) / 1000 || 1 / 60, 0.1);
    lastTime = time;
    if (media.matches || !settings.enabled) {
      x = y = targetX = targetY = 0;
    } else {
      const follow = followAmount(dt, settings.followAt60Fps);
      x += (targetX - x) * follow;
      y += (targetY - y) * follow;
    }

    const logo = visualConfig.logo;
    logoProjection(
      innerWidth,
      innerHeight,
      logoWidth,
      logoHeight / logoWidth,
      logo.centerX,
      logo.centerY,
      x,
      y,
      settings,
      projection,
    );
    plane.style.setProperty(
      '--logo-transform',
      logoCssTransform(
        projection,
        logoWidth,
        logoHeight,
        innerWidth * logo.centerX,
        innerHeight * logo.centerY,
      ),
    );
    const unsettled = Math.abs(targetX - x) + Math.abs(targetY - y);
    if (unsettled > 0.001) requestFrame();
  }

  function move(event: PointerEvent) {
    if (!settings.enabled || media.matches || event.pointerType === 'touch') return;
    targetX = Math.max(-1, Math.min(1, (event.clientX / Math.max(innerWidth, 1)) * 2 - 1));
    targetY = Math.max(-1, Math.min(1, (event.clientY / Math.max(innerHeight, 1)) * 2 - 1));
    requestFrame();
  }

  function reset() {
    targetX = targetY = 0;
    requestFrame();
  }

  /** Cache layout size; pointer animation only writes a composited transform. */
  const resizeObserver = new ResizeObserver(() => {
    logoWidth = Math.max(1, plane.clientWidth);
    logoHeight = Math.max(1, plane.clientHeight);
    reset();
  });
  resizeObserver.observe(plane);
  window.addEventListener('pointermove', move, { passive: true, signal: listeners.signal });
  window.addEventListener('blur', reset, { signal: listeners.signal });
  document.documentElement.addEventListener('pointerleave', reset, { signal: listeners.signal });
  media.addEventListener('change', reset, { signal: listeners.signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        lastTime = performance.now();
        reset();
      }
    },
    { signal: listeners.signal },
  );

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    listeners.abort();
    resizeObserver.disconnect();
    plane.style.removeProperty('--logo-transform');
  };
}
