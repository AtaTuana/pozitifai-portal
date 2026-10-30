import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { visualConfig } from '../../config/visual.config';

type Track = {
  value: number[];
  velocity: number[];
  target: number[];
  draw: (values: number[]) => void;
};

/** One clock for all instruments. A critically damped spring preserves velocity on retargeting. */
class MotionClock {
  private tracks = new Set<Track>();
  private frame = 0;
  private lastTime = 0;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');

  connect() {
    document.addEventListener('visibilitychange', this.onPreference);
    this.reduced.addEventListener('change', this.onPreference);
    this.wake();
    return () => {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      document.removeEventListener('visibilitychange', this.onPreference);
      this.reduced.removeEventListener('change', this.onPreference);
    };
  }

  private onPreference = () => this.wake();

  add(target: number[], draw: Track['draw']) {
    const track: Track = {
      value: target.map(() => 0),
      velocity: target.map(() => 0),
      target,
      draw,
    };
    this.tracks.add(track);
    draw(track.value);
    this.wake();
    return track;
  }

  remove(track: Track) {
    this.tracks.delete(track);
  }

  set(track: Track, target: number[]) {
    // A new hour range can change vector size; existing hours are keyed by components.
    track.target = target;
    this.wake();
  }

  private settle() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    for (const track of this.tracks) {
      track.value = [...track.target];
      track.velocity = track.target.map(() => 0);
      track.draw(track.value);
    }
  }

  private wake() {
    if (document.hidden || this.reduced.matches) return this.settle();
    if (this.frame) return;
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    const frequency = Math.max(1, visualConfig.dashboard.springFrequency);
    const decay = Math.exp(-frequency * dt);
    let moving = false;
    for (const track of this.tracks) {
      for (let index = 0; index < track.target.length; index++) {
        const target = track.target[index];
        const difference = track.value[index] - target;
        const step = (track.velocity[index] + frequency * difference) * dt;
        const value = target + (difference + step) * decay;
        const velocity = (track.velocity[index] - frequency * step) * decay;
        const epsilon = Math.max(0.0001, Math.abs(target) * 0.00001);
        const settled = Math.abs(value - target) < epsilon && Math.abs(velocity) < epsilon;
        track.value[index] = settled ? target : value;
        track.velocity[index] = settled ? 0 : velocity;
        moving ||= !settled;
      }
      track.draw(track.value);
    }
    this.frame = moving ? requestAnimationFrame(this.tick) : 0;
  };
}

const MotionContext = createContext<MotionClock | null>(null);

export function DashboardMotion({ children }: { children: ReactNode }) {
  const [clock] = useState(() => new MotionClock());
  useEffect(() => clock.connect(), [clock]);
  return <MotionContext.Provider value={clock}>{children}</MotionContext.Provider>;
}

/** SVG attributes/text update without a React render for every animation frame. */
export function useInstrument(target: number[], draw: Track['draw']) {
  const clock = useContext(MotionContext);
  const drawRef = useRef(draw);
  const track = useRef<Track | null>(null);
  useLayoutEffect(() => {
    drawRef.current = draw;
  });
  useLayoutEffect(() => {
    if (!clock) return;
    const registered = clock.add(target, (values) => drawRef.current(values));
    track.current = registered;
    return () => {
      clock.remove(registered);
      track.current = null;
    };
    // Register once; retarget independently so rapid filters retain momentum.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock]);
  useLayoutEffect(() => {
    if (clock && track.current) clock.set(track.current, target);
  }, [clock, target]);
}
