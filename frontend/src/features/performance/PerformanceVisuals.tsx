import { useLayoutEffect, useRef } from 'react';
import { useInstrument } from '../dashboard/motion';
import { initials } from './presentation';

export function AgentAvatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span className={`performance-avatar${large ? ' is-large' : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** Transform-only bars share the dashboard's sleeping spring clock. No per-frame React state. */
export function PerformanceBar({
  value,
  maximum,
  secondary = false,
}: {
  value: number | null;
  maximum: number;
  secondary?: boolean;
}) {
  const bar = useRef<HTMLSpanElement>(null);
  useInstrument(
    [maximum > 0 && value !== null ? Math.max(0, Math.min(1, value / maximum)) : 0],
    ([fraction]) => {
      if (bar.current) bar.current.style.transform = `scaleX(${fraction})`;
    },
  );
  return (
    <span className={`performance-track${secondary ? ' is-secondary' : ''}`} aria-hidden="true">
      <span ref={bar} />
    </span>
  );
}

/** FLIP measures once per reorder, then lets the compositor move rows to their new positions. */
export function useRowMotion(order: string) {
  const list = useRef<HTMLDivElement>(null);
  const previous = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const elements = Array.from(list.current?.querySelectorAll<HTMLElement>('[data-agent]') ?? []);
    const next = new Map(elements.map((node) => [node.dataset.agent!, node.offsetTop]));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animations: Animation[] = [];
    if (!reduced)
      elements.forEach((node, index) => {
        const before = previous.current.get(node.dataset.agent!);
        const offset = before === undefined ? 12 : before - next.get(node.dataset.agent!)!;
        if (!offset) return;
        animations.push(
          node.animate(
            [
              { transform: `translateY(${offset}px)`, opacity: before === undefined ? 0 : 1 },
              { transform: 'translateY(0)', opacity: 1 },
            ],
            {
              duration: 560,
              delay: before === undefined ? Math.min(index * 28, 196) : 0,
              easing: 'cubic-bezier(.22, .8, .22, 1)',
              fill: 'backwards',
            },
          ),
        );
      });
    previous.current = next;
    return () => animations.forEach((animation) => animation.cancel());
  }, [order]);
  return list;
}
