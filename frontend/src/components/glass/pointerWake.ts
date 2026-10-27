import { visualConfig } from '../../config/visual.config';

export const MAX_WAKE_SAMPLES = 32;
type WakePoint = { x: number; y: number; born: number; strength: number };

/** Sample a continuous pointer path into short-lived waves without React rerenders. */
export function createPointerWake() {
  const points: WakePoint[] = [];
  const uniforms = new Float32Array(MAX_WAKE_SAMPLES * 4);
  const strengths = new Float32Array(MAX_WAKE_SAMPLES);
  const bounds = new Float32Array(4);
  let previous: { x: number; y: number; time: number } | undefined;
  return {
    uniforms,
    strengths,
    bounds,
    push(x: number, y: number, time: number, dragging: boolean) {
      if (!previous) {
        previous = { x, y, time };
        return;
      }
      const dx = x - previous.x;
      const dy = y - previous.y;
      const distance = Math.hypot(dx, dy);
      if (distance < visualConfig.wake.sampleSpacingPx) return;
      // Interpolate long mouse moves so a fast gesture leaves one continuous wake.
      const steps = Math.min(
        MAX_WAKE_SAMPLES,
        Math.ceil(distance / visualConfig.wake.sampleSpacingPx),
      );
      const speed = distance / Math.max(time - previous.time, 8);
      const strength = Math.min(1, 0.2 + speed * 0.45) * (dragging ? 1.2 : 1);
      for (let step = 1; step <= steps; step++) {
        const fraction = step / steps;
        points.push({
          x: previous.x + dx * fraction,
          y: previous.y + dy * fraction,
          born: time,
          strength,
        });
      }
      if (points.length > MAX_WAKE_SAMPLES) points.splice(0, points.length - MAX_WAKE_SAMPLES);
      previous = { x, y, time };
    },
    update(time: number) {
      while (points.length && time - points[0].born >= visualConfig.wake.lifetimeMs) points.shift();
      bounds.set([Infinity, Infinity, -Infinity, -Infinity]);
      points.forEach((point, index) => {
        const age = (time - point.born) / 1000;
        const radius = 7 + age * visualConfig.wake.spreadPxPerSecond;
        const width = visualConfig.wake.softnessPx + age * 8;
        const support = radius + width * 6;
        uniforms.set([point.x, point.y, radius, width], index * 4);
        strengths[index] =
          Math.pow(Math.max(0, 1 - (age * 1000) / visualConfig.wake.lifetimeMs), 2) *
          point.strength *
          0.35;
        bounds[0] = Math.min(bounds[0], point.x - support);
        bounds[1] = Math.min(bounds[1], point.y - support);
        bounds[2] = Math.max(bounds[2], point.x + support);
        bounds[3] = Math.max(bounds[3], point.y + support);
      });
      if (!points.length) bounds.fill(0);
      return points.length;
    },
    leave() {
      previous = undefined;
    },
    clear() {
      previous = undefined;
      points.length = 0;
    },
  };
}
