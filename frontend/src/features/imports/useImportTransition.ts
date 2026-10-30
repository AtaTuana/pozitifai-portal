import { useLayoutEffect, useRef, useState } from 'react';
import { visualConfig } from '../../config/visual.config';
import type { ImportKind } from './types';

export type UploadKind = Exclude<ImportKind, 'agents'>;
type Phase =
  | 'overview'
  | 'leaving-overview'
  | 'expanding'
  | 'entering-upload'
  | 'upload'
  | 'leaving-upload'
  | 'collapsing'
  | 'entering-overview';
type Box = { x: number; y: number; width: number; height: number; radius: number };
const full: Box = { x: 0, y: 0, width: 1, height: 1, radius: 0 };

/** The same clockwise contour is used for card highlights and the expanding sheet. */
export function roundedPath(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const right = x + width,
    bottom = y + height;
  return `M ${x + r} ${y} H ${right - r} Q ${right} ${y} ${right} ${y + r} V ${bottom - r} Q ${right} ${bottom} ${right - r} ${bottom} H ${x + r} Q ${x} ${bottom} ${x} ${bottom - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
}

/** Sequence text fades around one clipped sheet; uploads and API state stay outside this hook. */
export function useImportTransition() {
  const [phase, setPhase] = useState<Phase>('overview');
  const [kind, setKind] = useState<UploadKind | null>(null);
  const stage = useRef<HTMLElement>(null);
  const overview = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const outline = useRef<SVGPathElement>(null);
  const upload = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const origin = useRef<HTMLButtonElement | null>(null);
  const phaseRef = useRef<Phase>('overview');
  const alive = useRef(false);
  const sequence = useRef(0);
  const viewport = useRef({ width: 1, height: 1 });
  const painted = useRef<Box>(full);
  const fades = useRef(new Set<Animation>());
  const cancelMorph = useRef<(() => void) | null>(null);
  const focusFrame = useRef(0);

  function moveTo(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }
  function duration(value: number) {
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : value;
  }

  function paint(box: Box) {
    painted.current = box;
    const { width, height } = viewport.current;
    const x = box.x * width,
      y = box.y * height,
      w = box.width * width,
      h = box.height * height;
    if (surface.current)
      surface.current.style.clipPath = `inset(${y}px ${width - x - w}px ${height - y - h}px ${x}px round ${box.radius}px)`;
    outline.current?.setAttribute(
      'd',
      roundedPath(x + 0.6, y + 0.6, Math.max(0, w - 1.2), Math.max(0, h - 1.2), box.radius),
    );
  }

  function cardBox(): Box {
    if (!origin.current || !stage.current) return painted.current;
    const button = origin.current.getBoundingClientRect(),
      bounds = stage.current.getBoundingClientRect();
    return {
      x: (button.left - bounds.left) / bounds.width,
      y: (button.top - bounds.top) / bounds.height,
      width: button.width / bounds.width,
      height: button.height / bounds.height,
      radius: visualConfig.imports.cardRadiusPx,
    };
  }

  async function fade(element: HTMLElement | null, from: number, to: number) {
    if (!element || !alive.current) return false;
    const animation = element.animate([{ opacity: from }, { opacity: to }], {
      duration: duration(visualConfig.imports.contentFadeMs),
      easing: 'ease-in-out',
      fill: 'forwards',
    });
    fades.current.add(animation);
    try {
      await animation.finished;
      if (!alive.current) return false;
      element.style.opacity = String(to);
      return true;
    } catch {
      return false;
    } finally {
      fades.current.delete(animation);
      animation.cancel();
    }
  }

  function morph(from: Box, to: Box): Promise<boolean> {
    const ms = duration(visualConfig.imports.morphMs);
    return new Promise((resolve) => {
      let frame = 0;
      const started = performance.now();
      cancelMorph.current = () => {
        cancelAnimationFrame(frame);
        resolve(false);
      };
      const tick = (now: number) => {
        if (!alive.current) {
          resolve(false);
          return;
        }
        const t = ms ? Math.min(1, (now - started) / ms) : 1;
        // Symmetric easing makes collapse follow the exact expansion trajectory backwards.
        const progress = t * t * (3 - 2 * t);
        const mix = (a: number, b: number) => a + (b - a) * progress;
        paint({
          x: mix(from.x, to.x),
          y: mix(from.y, to.y),
          width: mix(from.width, to.width),
          height: mix(from.height, to.height),
          radius: mix(from.radius, to.radius) + Math.sin(Math.PI * progress) * 8,
        });
        if (t < 1) frame = requestAnimationFrame(tick);
        else {
          cancelMorph.current = null;
          resolve(true);
        }
      };
      frame = requestAnimationFrame(tick);
    });
  }

  useLayoutEffect(() => {
    alive.current = true;
    const node = stage.current;
    if (!node) return;
    const resize = new ResizeObserver(([entry]) => {
      viewport.current = {
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      };
      paint(painted.current);
    });
    viewport.current = { width: node.clientWidth, height: node.clientHeight };
    resize.observe(node);
    return () => {
      alive.current = false;
      sequence.current++;
      cancelAnimationFrame(focusFrame.current);
      cancelMorph.current?.();
      fades.current.forEach((animation) => animation.cancel());
      resize.disconnect();
    };
  }, []);

  async function open(next: UploadKind, button: HTMLButtonElement) {
    if (phaseRef.current !== 'overview' || !alive.current) return;
    const token = ++sequence.current;
    origin.current = button;
    setKind(next);
    const source = cardBox();
    paint(source);
    if (upload.current) upload.current.scrollTop = 0;
    // Focus must leave a subtree before it becomes inert/aria-hidden.
    stage.current?.focus({ preventScroll: true });
    moveTo('leaving-overview');
    if (!(await fade(overview.current, 1, 0)) || token !== sequence.current) return;
    moveTo('expanding');
    if (!(await morph(source, full)) || token !== sequence.current) return;
    moveTo('entering-upload');
    if (!(await fade(upload.current, 0, 1)) || token !== sequence.current) return;
    moveTo('upload');
    focusFrame.current = requestAnimationFrame(() => back.current?.focus({ preventScroll: true }));
  }

  async function close() {
    if (phaseRef.current !== 'upload' || !alive.current) return;
    const token = ++sequence.current;
    stage.current?.focus({ preventScroll: true });
    moveTo('leaving-upload');
    if (!(await fade(upload.current, 1, 0)) || token !== sequence.current) return;
    moveTo('collapsing');
    if (!(await morph(full, cardBox())) || token !== sequence.current) return;
    setKind(null);
    moveTo('entering-overview');
    if (!(await fade(overview.current, 0, 1)) || token !== sequence.current) return;
    moveTo('overview');
    focusFrame.current = requestAnimationFrame(() =>
      origin.current?.focus({ preventScroll: true }),
    );
  }

  return { phase, kind, stage, overview, surface, outline, upload, back, open, close };
}
