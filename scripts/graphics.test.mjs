import test from 'node:test';
import assert from 'node:assert/strict';
import {
  logoProjection,
  logoCssTransform,
  followAmount,
} from '../frontend/src/components/glass/logoProjection.ts';

const settings = {
  tiltXRadians: 0.24,
  tiltYRadians: 0.18,
  parallaxFactor: 0.055,
  cameraDistance: 1.8,
};
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const normalized = (a) => a.map((value) => value / Math.hypot(...a));
const close = (actual, expected, epsilon = 0.000002) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

// Direct equation from the user's reference, independent of the factored implementation.
function reference(width, height, size, aspect, cx, cy, x, y, px, py) {
  const tilt = [x * 0.12, -y * 0.09];
  const n = normalized([
    Math.sin(tilt[0]),
    Math.sin(tilt[1]),
    Math.cos(tilt[0]) * Math.cos(tilt[1]),
  ]);
  const ray = [((px / width - 0.5) * width) / height, 0.5 - py / height, -1.8];
  const origin = [0, 0, 1.8];
  const t = dot(origin, n) / dot(ray, n);
  const hit = origin.map((value, index) => value - t * ray[index]);
  const ax = normalized([n[2], 0, -n[0]]);
  const ay = [n[1] * ax[2], n[2] * ax[0] - n[0] * ax[2], -n[1] * ax[0]];
  return [
    0.5 + ((dot(hit, ax) / (width / height) + 0.5 + x * 0.0275 - cx) * width) / size,
    0.5 - ((dot(hit, ay) + 0.5 - y * 0.0275 - (1 - cy)) * height) / (size * aspect),
  ];
}

test('projection matches ReportGuerilla at center, edges, and mobile/desktop aspect ratios', () => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [2560, 1080],
  ]) {
    const size = Math.min(width * 0.42, 560, (height * 0.44) / (249 / 377));
    for (const [x, y] of [
      [0, 0],
      [-1, -1],
      [1, 1],
      [-1, 1],
      [0.45, -0.7],
    ]) {
      const m = logoProjection(width, height, size, 249 / 377, 0.5, 0.5, x, y, settings);
      for (const [px, py] of [
        [0, 0],
        [width / 2, height / 2],
        [width, height],
        [width * 0.3, height * 0.6],
      ]) {
        const denom = m[2] * px + m[5] * py + m[8];
        const actual = [
          (m[0] * px + m[3] * py + m[6]) / denom,
          (m[1] * px + m[4] * py + m[7]) / denom,
        ];
        const expected = reference(width, height, size, 249 / 377, 0.5, 0.5, x, y, px, py);
        actual.forEach((value, index) => close(value, expected[index]));
      }
    }
  }
});

test('CSS fallback inverts the same projection and moves the logo opposite the look direction', () => {
  const width = 1440,
    height = 900,
    size = 560,
    logoHeight = (size * 249) / 377;
  for (const x of [-1, 0, 1]) {
    const m = logoProjection(width, height, size, 249 / 377, 0.5, 0.5, x, 0, settings);
    const css = logoCssTransform(m, size, logoHeight, width / 2, height / 2)
      .slice(9, -1)
      .split(',')
      .map(Number);
    for (const [u, v] of [
      [0, 0],
      [0.5, 0.5],
      [1, 1],
    ]) {
      const localX = u * size,
        localY = v * logoHeight;
      const w = css[3] * localX + css[7] * localY + css[15];
      const px = (css[0] * localX + css[4] * localY + css[12]) / w + width / 2;
      const py = (css[1] * localX + css[5] * localY + css[13]) / w + height / 2;
      const denom = m[2] * px + m[5] * py + m[8];
      close((m[0] * px + m[3] * py + m[6]) / denom, u);
      close((m[1] * px + m[4] * py + m[7]) / denom, v);
      if (u === 0.5 && x !== 0)
        assert.ok((px - width / 2) * x < 0, 'logo must shift opposite the pointer');
    }
  }
});

test('motion follow speed is independent of display refresh rate', () => {
  const values = [30, 60, 144].map((fps) => {
    let value = 0;
    for (let frame = 0; frame < fps; frame++) value += (1 - value) * followAmount(1 / fps, 0.065);
    return value;
  });
  values.forEach((value) => close(value, values[0], 1e-10));
});

import { surfacePath } from '../frontend/src/features/auth/surfaceGeometry.ts';
test('folder surface has one closed outline and grows flaps only above the workspace', () => {
  const source = { left: 400, right: 860, top: 160, bottom: 650 };
  const flaps = [
    { left: 244, right: 384, top: 14 },
    { left: 400, right: 540, top: 14 },
  ];
  const collapsed = surfacePath(source, 1280, 720, 70, flaps, 0);
  const expanded = surfacePath(source, 1280, 720, 70, flaps, 1);
  assert.ok(collapsed.startsWith('M 400 160'));
  assert.ok(collapsed.endsWith('L 860 160 L 860 650 L 400 650 Z'));
  assert.ok(expanded.startsWith('M 0 70'));
  assert.ok(expanded.includes('244 14'));
  assert.ok(expanded.endsWith('L 1280 70 L 1280 720 L 0 720 Z'));
  for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
    const path = surfacePath(source, 1280, 720, 70, flaps, progress);
    assert.equal((path.match(/M /g) || []).length, 1);
    assert.equal((path.match(/Z/g) || []).length, 1);
    assert.ok(!/NaN|Infinity/.test(path));
  }
});
