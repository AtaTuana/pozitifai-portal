/** Adapted from ReportGuerilla/app/js/report-particles.js: Fibonacci shell → spiral → fused core.
 * A smaller particle budget, capped DPR/30fps and paused hidden tabs bound rendering cost.
 */
export function createAnalysisOrb(canvas: HTMLCanvasElement, onFused: () => void) {
  const context = canvas.getContext('2d');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  if (!context) return { setReady: () => queueMicrotask(onFused), dispose: () => {} };
  const ctx = context;
  const points = Array.from({ length: 900 }, (_, i) => {
    const f = (i + 0.5) / 900,
      y = 1 - 2 * f,
      radius = Math.sqrt(1 - y * y),
      a = i * 2.399963229728653;
    return { x: Math.cos(a) * radius, y, z: Math.sin(a) * radius, f, a, px: 0, py: 0 };
  });
  const ease = (n: number) => {
    const t = Math.max(0, Math.min(1, n));
    return t * t * (3 - 2 * t);
  };
  let frame = 0,
    disposed = false,
    ready = false,
    fused = false,
    entered = 0;
  let width = 1,
    height = 1,
    last = 0,
    sampled = 0,
    neutral = 'white';
  const started = performance.now();
  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (media.matches && !fused) draw(performance.now());
  };
  function draw(now: number) {
    frame = 0;
    if (disposed || fused || document.hidden) return;
    if (now - last < 32 && !media.matches) {
      frame = requestAnimationFrame(draw);
      return;
    }
    last = now;
    const age = now - entered,
      t = media.matches ? 0 : (now - started) / 1000;
    const fuse = ready ? (media.matches ? 1 : ease((age - 300) / 1700)) : 0;
    const ignite = ready ? (media.matches ? 1 : ease((age - 1860) / 440)) : 0;
    if (now - sampled > 250 || !sampled) {
      neutral = getComputedStyle(canvas).color;
      sampled = now;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = ready ? '#38bc86' : neutral;
    ctx.strokeStyle = ctx.fillStyle;
    const radius = Math.min(width * 0.32, height * 0.39),
      yaw = t * 0.24 + Math.sin(t * 0.13) * 0.6,
      pitch = Math.sin(t * 0.19) * 0.45;
    const ca = Math.cos(yaw),
      sa = Math.sin(yaw),
      cp = Math.cos(pitch),
      sp = Math.sin(pitch);
    const fade = ready ? 1 - ease((age - 2050) / 300) : 1;
    if (!(ready && media.matches))
      points.forEach((p, i) => {
        const breath = 1 + 0.055 * Math.sin(t * 1.2 + p.f * 6) * (1 - fuse);
        const curl = 0.11 * Math.sin(p.y * 4 + t * 0.69 + p.a * 0.1) * (1 - fuse);
        const x = p.x * ca + p.z * sa,
          z0 = -p.x * sa + p.z * ca;
        const y = p.y * cp - z0 * sp,
          z = p.y * sp + z0 * cp,
          perspective = 1 / (1 - z * 0.19 * (1 - fuse));
        const sx = (x + curl) * radius * breath * perspective,
          sy = (y + curl * 0.6) * radius * breath * perspective;
        const rotation = fuse * fuse * (Math.PI * 7 + p.f * 2.5),
          floor = Math.min(1, 40 / Math.max(1, radius));
        const shrink = floor + (1 - floor) * Math.pow(1 - fuse, 1.45);
        const ox = (sx * Math.cos(rotation) - sy * Math.sin(rotation)) * shrink;
        const oy = (sx * Math.sin(rotation) + sy * Math.cos(rotation)) * shrink;
        const arm = ((i % 3) * Math.PI * 2) / 3 + p.f * Math.PI * 3.4 + rotation;
        const armRadius = radius * shrink * (0.12 + 0.88 * p.f),
          spiral = Math.sin(fuse * Math.PI) * 0.9;
        const px = width / 2 + ox * (1 - spiral) + Math.cos(arm) * armRadius * spiral;
        const py = height / 2 + oy * (1 - spiral) + Math.sin(arm) * armRadius * 0.88 * spiral;
        const depth = (z + 1) / 2,
          alpha = (0.24 + 0.65 * depth) * fade;
        if (fuse > 0.02 && fuse < 0.97 && p.px) {
          ctx.globalAlpha = alpha * 0.3;
          ctx.lineWidth = 0.65;
          ctx.beginPath();
          ctx.moveTo(p.px, p.py);
          ctx.lineTo(px, py);
          ctx.stroke();
        }
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(px, py, (0.9 + depth * 1.3) * 0.8, 0, Math.PI * 2);
        ctx.fill();
        p.px = px;
        p.py = py;
      });
    if (ignite) {
      ctx.globalAlpha = ignite;
      ctx.fillStyle = '#38bc86';
      ctx.shadowColor = '#38bc86';
      ctx.shadowBlur = 16 * Math.sin(ignite * Math.PI) + 8;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 40 + 6 * ignite, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    if (ready && (media.matches || age >= 2350)) {
      fused = true;
      onFused();
      return;
    }
    if (!media.matches) frame = requestAnimationFrame(draw);
  }
  const resume = () => {
    if (!document.hidden && !frame && !fused) frame = requestAnimationFrame(draw);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener('visibilitychange', resume);
  media.addEventListener('change', resume);
  resize();
  resume();
  return {
    setReady() {
      if (ready) return;
      ready = true;
      entered = performance.now();
      resume();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', resume);
      media.removeEventListener('change', resume);
    },
  };
}
