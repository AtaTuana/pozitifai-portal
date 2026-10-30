import { useLayoutEffect, useRef } from 'react';
import { visualConfig } from '../../config/visual.config';
import { surfacePath } from './surfaceGeometry';
import type { Flap } from './surfaceGeometry';

/** Only the selected flap belongs to the front sheet; inactive folders sit behind it. */
export function AuthGlass({ expanded, onSettled }: { expanded: boolean; onSettled: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rear = useRef<HTMLDivElement>(null);
  const outline = useRef<SVGPathElement>(null);
  const rearFolders = useRef<SVGSVGElement>(null);
  const rearOutline = useRef<SVGPathElement>(null);
  const progress = useRef(0);
  const previousFlaps = useRef<Flap[]>([]);
  const settled = useRef(onSettled);
  settled.current = onSettled;
  useLayoutEffect(() => {
    const sheet = ref.current;
    const login = document.querySelector<HTMLElement>('.login-sheet');
    if (!sheet || !login) return;
    const header = document.querySelector<HTMLElement>('.portal-header');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      measureFrame = 0;
    let source = login.getBoundingClientRect();
    let flaps: Flap[] = [];
    let inactiveFlaps: Flap[] = [];
    const from = progress.current,
      to = expanded ? 1 : 0,
      started =
        performance.now() +
        (from !== to && !reduced.matches ? visualConfig.motion.contentFadeMs : 0);
    const duration = reduced.matches ? 0 : visualConfig.motion.authMorphMs * Math.abs(to - from);
    const paint = () => {
      const glass = visualConfig.glass.workspace;
      sheet.style.setProperty(
        '--sheet-veil',
        String(
          glass.loginVeilOpacity + (glass.veilOpacity - glass.loginVeilOpacity) * progress.current,
        ),
      );
      const path = surfacePath(
        source,
        innerWidth,
        innerHeight,
        visualConfig.layout.navbarHeightPx,
        flaps,
        progress.current,
      );
      sheet.style.clipPath = `path("${path}")`;
      outline.current?.setAttribute('d', path);
      // These silhouettes reuse the rear glass; no extra full-screen blur is computed.
      const baseline = visualConfig.layout.navbarHeightPx;
      rearOutline.current?.setAttribute(
        'd',
        inactiveFlaps
          .map(
            ({ left, right, top }) =>
              `M ${left - 6} ${baseline + 4} L ${left - 6} ${baseline} Q ${left} ${baseline} ${left} ${baseline - 6} L ${left} ${top + 6} Q ${left} ${top} ${left + 6} ${top} L ${right - 6} ${top} Q ${right} ${top} ${right} ${top + 6} L ${right} ${baseline - 6} Q ${right} ${baseline} ${right + 6} ${baseline} L ${right + 6} ${baseline + 4} Z`,
          )
          .join(' '),
      );
      if (rearFolders.current) rearFolders.current.style.opacity = String(progress.current);

      const h = visualConfig.layout.navbarHeightPx;
      const top = source.top + (h - source.top) * progress.current;
      const rearY =
        source.top - h >= h ? -Math.min(h, Math.max(0, top - h)) : -h * (1 - progress.current);
      if (rear.current) {
        rear.current.style.transform = `translate3d(0, ${rearY}px, 0)`;
        rear.current.style.visibility = progress.current === 0 ? 'hidden' : 'visible';
      }
      // Controls mounted on the rear sheet use its exact position, without CSS easing lag.
      header?.style.setProperty('--rear-offset', `${rearY}px`);
      window.dispatchEvent(new Event('portal:glass-change'));
    };
    const measure = () => {
      measureFrame = 0;
      source = login.getBoundingClientRect();
      const nav = document.querySelector('.campaign-nav')?.getBoundingClientRect();
      inactiveFlaps = nav
        ? [...document.querySelectorAll('.campaign-tab[aria-pressed="false"]')].flatMap(
            (button) => {
              const box = button.getBoundingClientRect();
              const left = Math.max(nav.left + 6, box.left),
                right = Math.min(nav.right - 6, box.right);
              return right - left > 12 ? [{ left, right, top: box.top }] : [];
            },
          )
        : [];
      flaps = nav
        ? [...document.querySelectorAll('.campaign-tab[aria-pressed="true"]')].flatMap((button) => {
            const box = button.getBoundingClientRect();
            const left = Math.max(nav.left + 6, box.left),
              right = Math.min(nav.right - 6, box.right);
            return right - left > 12 ? [{ left, right, top: box.top }] : [];
          })
        : expanded
          ? []
          : previousFlaps.current;
      if (nav) previousFlaps.current = flaps;
      paint();
    };
    const scheduleMeasure = () => {
      if (!measureFrame) measureFrame = requestAnimationFrame(measure);
    };
    const tick = (now: number) => {
      const t =
        duration && !reduced.matches ? Math.max(0, Math.min(1, (now - started) / duration)) : 1;
      progress.current = from + (to - from) * t * t * (3 - 2 * t);
      paint();
      if (t < 1) frame = requestAnimationFrame(tick);
      else settled.current();
    };
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(login);
    const nav = document.querySelector('.campaign-nav');
    if (nav) observer.observe(nav);
    const mutations = new MutationObserver(scheduleMeasure);
    if (nav)
      mutations.observe(nav, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-pressed'],
      });
    window.addEventListener('resize', scheduleMeasure);
    // Capture scroll from the horizontally scrollable campaign strip too.
    window.addEventListener('scroll', scheduleMeasure, true);
    document.fonts.ready.then(() => {
      if (sheet.isConnected) scheduleMeasure();
    });
    measure();
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(measureFrame);
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
    };
  }, [expanded]);
  return (
    <>
      <div ref={rear} className="auth-rear-glass" aria-hidden="true" />
      <svg ref={rearFolders} className="auth-rear-folders" aria-hidden="true">
        <path ref={rearOutline} />
      </svg>
      <div ref={ref} className="auth-glass" aria-hidden="true">
        <svg className="sheet-outline">
          <path ref={outline} />
        </svg>
      </div>
    </>
  );
}
