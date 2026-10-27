type Bounds = { left: number; right: number; top: number; bottom: number };
export type Flap = { left: number; right: number; top: number };
/** ReportGuerilla's continuous folder outline: flaps grow from the same upper edge. */
export function surfacePath(
  source: Bounds,
  width: number,
  height: number,
  header: number,
  flaps: Flap[],
  progress: number,
) {
  const p = Math.max(0, Math.min(1, progress));
  const mix = (a: number, b: number) => a + (b - a) * p;
  const left = mix(source.left, 0),
    right = mix(source.right, width);
  const top = mix(source.top, header),
    bottom = mix(source.bottom, height);
  const x = (n: number) => left + (n / width) * (right - left);
  const depth = p * p * (3 - 2 * p);
  let path = `M ${left} ${top}`;
  for (const flap of flaps) {
    const start = x(flap.left),
      end = x(flap.right);
    const y = top - (header - flap.top) * depth;
    const r = Math.max(0, Math.min(6, (end - start) / 4, (top - y) / 3));
    path += ` L ${start - r} ${top} Q ${start} ${top} ${start} ${top - r} L ${start} ${y + r} Q ${start} ${y} ${start + r} ${y} L ${end - r} ${y} Q ${end} ${y} ${end} ${y + r} L ${end} ${top - r} Q ${end} ${top} ${end + r} ${top}`;
  }
  return `${path} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} Z`;
}
