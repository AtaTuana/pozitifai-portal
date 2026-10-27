export type ProjectionSettings = {
  tiltXRadians: number;
  tiltYRadians: number;
  parallaxFactor: number;
  cameraDistance: number;
};

/** ReportGuerilla's tilted-plane ray equation, factored into one CPU-side homography.
 * The view slides opposite the pointer; there is no camera orbit around the logo.
 * Output is column-major and maps viewport CSS pixels to logo texture coordinates.
 */
export function logoProjection(
  width: number,
  height: number,
  logoWidth: number,
  logoAspect: number,
  centerX: number,
  centerY: number,
  x: number,
  y: number,
  settings: ProjectionSettings,
  output = new Float32Array(9),
) {
  const tx = x * settings.tiltXRadians * 0.5;
  const ty = -y * settings.tiltYRadians * 0.5;
  const raw = [Math.sin(tx), Math.sin(ty), Math.cos(tx) * Math.cos(ty)];
  const length = Math.hypot(...raw);
  const [nx, ny, nz] = raw.map((value) => value / length);
  const axisLength = Math.hypot(nz, nx);
  const ax = [nz / axisLength, 0, -nx / axisLength];
  const ay = [ny * ax[2], nz * ax[0] - nx * ax[2], -ny * ax[0]];
  const aspect = width / height,
    distance = settings.cameraDistance;
  const offsetU = 0.5 + x * settings.parallaxFactor * 0.5 - centerX;
  const offsetV = 0.5 - y * settings.parallaxFactor * 0.5 - (1 - centerY);
  const scaleU = width / logoWidth,
    scaleV = height / (logoWidth * logoAspect);
  const rays = [
    [1 / height, 0, 0],
    [0, -1 / height, 0],
    [-aspect * 0.5, 0.5, -distance],
  ];
  rays.forEach(([rx, ry, rz], column) => {
    const denominator = rx * nx + ry * ny + rz * nz;
    const hitX = distance * (ax[2] * denominator - nz * (rx * ax[0] + ry * ax[1] + rz * ax[2]));
    const hitY = distance * (ay[2] * denominator - nz * (rx * ay[0] + ry * ay[1] + rz * ay[2]));
    output[column * 3] = scaleU * (hitX / aspect + offsetU * denominator) + 0.5 * denominator;
    output[column * 3 + 1] = -scaleV * (hitY + offsetV * denominator) + 0.5 * denominator;
    output[column * 3 + 2] = denominator;
  });
  return output;
}

/** Invert the same projection for CSS matrix3d, so WebGL fallback keeps the same depth cues. */
export function logoCssTransform(
  matrix: Float32Array,
  logoWidth: number,
  logoHeight: number,
  anchorX: number,
  anchorY: number,
) {
  const [a, d, g, b, e, h, c, f, i] = matrix;
  const inverse = [
    e * i - f * h,
    f * g - d * i,
    d * h - e * g,
    c * h - b * i,
    a * i - c * g,
    b * g - a * h,
    b * f - c * e,
    c * d - a * f,
    a * e - b * d,
  ];
  const divisor = inverse[8];
  const m = inverse.map((value) => value / divisor);
  for (let column = 0; column < 3; column++) {
    const offset = column * 3;
    m[offset] -= anchorX * m[offset + 2];
    m[offset + 1] -= anchorY * m[offset + 2];
    if (column < 2) {
      const size = column === 0 ? logoWidth : logoHeight;
      m[offset] /= size;
      m[offset + 1] /= size;
      m[offset + 2] /= size;
    }
  }
  return `matrix3d(${[m[0], m[1], 0, m[2], m[3], m[4], 0, m[5], 0, 0, 1, 0, m[6], m[7], 0, m[8]].join(',')})`;
}

/** Match the reference's 0.065 follow rate at 60 Hz without changing speed at other refresh rates. */
export function followAmount(seconds: number, amountAt60Fps: number) {
  return 1 - Math.pow(1 - amountAt60Fps, Math.min(seconds, 0.1) * 60);
}
