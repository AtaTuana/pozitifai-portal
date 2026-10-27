import { MAX_WAKE_SAMPLES } from './pointerWake';

/** Full-screen triangle with the same top-left coordinate origin as the DOM. */
export const vertexShader = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

/** Screen-space glass over the reference project's distant-plane perspective. */
export const fragmentShader = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uLogo;
uniform vec2 uResolution;
uniform float uDark;
uniform float uLogoSize;
uniform float uLogoAspect;
uniform vec2 uLogoCenter;
uniform mat3 uLogoProjection;
uniform vec4 uScene;
uniform vec2 uLogoGlow;
uniform vec2 uMotion;
uniform int uSurfaceCount;
uniform vec4 uRects[8];
uniform vec4 uMaterials[8];
uniform int uWakeCount;
uniform vec4 uWake[${MAX_WAKE_SAMPLES}];
uniform float uWakeStrength[${MAX_WAKE_SAMPLES}];
uniform vec4 uWakeBounds;
uniform vec4 uWakeSettings;
uniform float uWakeLight;

float roundedDistance(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

vec2 roundedNormal(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  if (q.x > 0.0 && q.y > 0.0) return normalize(q) * sign(p);
  return q.x > q.y ? vec2(sign(p.x), 0.0) : vec2(0.0, sign(p.y));
}

/** The reference ray/plane calculation is factored once per frame on the CPU. */
vec2 projectLogo(vec2 pixel) {
  vec3 projected = uLogoProjection * vec3(pixel, 1.0);
  return projected.xy / projected.z;
}

float logoSample(vec2 uv, float lod) {
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  return textureLod(uLogo, uv, lod).a;
}

/** Mip-filtered taps give a continuous blur instead of visible displaced logo copies. */
float scatteredLogo(vec2 uv, float blur) {
  float texelsPerPixel = uScene.w / uLogoSize;
  float lod = max(0.0, log2(max(1.0, texelsPerPixel * max(blur, 0.5))));
  vec2 stepSize = vec2(blur / uLogoSize, blur / (uLogoSize * uLogoAspect));
  // Preserve all nine taps where the blurred logo is present; skip empty background pixels.
  if (any(lessThan(uv, -stepSize)) || any(greaterThan(uv, vec2(1.0) + stepSize))) return 0.0;
  float alpha = logoSample(uv, lod) * 0.25;
  alpha += logoSample(uv + vec2(stepSize.x, 0.0), lod) * 0.125;
  alpha += logoSample(uv - vec2(stepSize.x, 0.0), lod) * 0.125;
  alpha += logoSample(uv + vec2(0.0, stepSize.y), lod) * 0.125;
  alpha += logoSample(uv - vec2(0.0, stepSize.y), lod) * 0.125;
  alpha += logoSample(uv + stepSize, lod) * 0.0625;
  alpha += logoSample(uv - stepSize, lod) * 0.0625;
  alpha += logoSample(uv + vec2(stepSize.x, -stepSize.y), lod) * 0.0625;
  alpha += logoSample(uv + vec2(-stepSize.x, stepSize.y), lod) * 0.0625;
  return alpha;
}

/** A fading height-field gradient leaves soft expanding crests along the pointer path. */
vec2 wakeNormal(vec2 pixel) {
  vec2 normal = vec2(0.0);
  if (uWakeCount == 0 || any(lessThan(pixel, uWakeBounds.xy)) || any(greaterThan(pixel, uWakeBounds.zw))) return normal;
  for (int i = 0; i < ${MAX_WAKE_SAMPLES}; i++) {
    if (i >= uWakeCount) break;
    vec4 point = uWake[i];
    vec2 delta = pixel - point.xy;
    float radius = point.z;
    float width = point.w;
    float support = radius + width * 6.0;
    if (any(greaterThan(abs(delta), vec2(support)))) continue;
    float distance = length(delta);
    float band = (distance - radius) / width;
    if (abs(band) > 6.0) continue;
    float crest = -band * exp(-0.5 * band * band) * uWakeStrength[i];
    normal += delta / max(distance, 1.0) * crest;
  }
  return clamp(normal, vec2(-1.5), vec2(1.5));
}

void main() {
  vec2 pixel = vUv * uResolution;
  vec2 ray = pixel;
  float scatter = uScene.x;
  float tint = 0.0;
  float reflection = 0.0;
  float shadow = 0.0;

  // Trace from the frontmost lens through the housing and navbar.
  for (int i = 7; i >= 0; i--) {
    if (i >= uSurfaceCount) continue;
    vec4 rect = uRects[i];
    vec4 material = uMaterials[i];
    vec2 halfSize = rect.zw * 0.5;
    vec2 p = ray - rect.xy - halfSize;
    if (any(greaterThan(abs(p), halfSize + vec2(100.0)))) continue;
    float radius = min(material.x, min(halfSize.x, halfSize.y));
    float d = roundedDistance(p, halfSize, radius);
    float inside = 1.0 - smoothstep(-0.7, 0.7, d);
    shadow += exp(-max(d, 0.0) / 9.0) * (1.0 - inside) * 0.008;
    if (inside < 0.001) continue;
    vec2 edgeNormal = roundedNormal(p, halfSize, radius);
    float slope = exp(-max(-d, 0.0) / 9.0);
    vec3 normal = normalize(vec3(edgeNormal * slope * 0.88, 1.0));
    vec3 refracted = refract(vec3(0.0, 0.0, -1.0), normal, 1.0 / 1.46);
    ray += refracted.xy * material.y * inside;
    ray -= p * 0.006 * inside;
    scatter = sqrt(scatter * scatter + material.z * material.z * inside);
    tint = 1.0 - (1.0 - tint) * (1.0 - material.w * inside);
    vec2 light = normalize(vec2(-0.7, -0.9) + uMotion * 0.24);
    float glint = pow(max(dot(edgeNormal, light), 0.0), 3.0);
    float rim = exp(-abs(d + 0.7) * 1.25);
    reflection += rim * (0.02 + glint * 0.16) * inside;
  }

  vec2 sheetPosition = ray / uResolution - uLogoCenter;
  vec2 sheetSlope = vec2(sin(sheetPosition.y * 6.0), sin(sheetPosition.x * 5.0)) * 0.12;
  vec2 wake = wakeNormal(ray);
  vec3 sheetRay = refract(vec3(0.0, 0.0, -1.0), normalize(vec3(sheetSlope, 1.0)), 1.0 / 1.46);
  ray += sheetRay.xy * uScene.y + wake * uWakeSettings.w;

  vec2 atmosphere = vUv - vec2(0.5);
  float lightPool = exp(-dot(atmosphere, atmosphere) * 3.5);
  vec3 lightBackground = vec3(0.92, 0.93, 0.94) + lightPool * 0.035;
  vec3 darkBackground = vec3(0.038, 0.045, 0.052) + lightPool * 0.026;
  vec3 background = mix(lightBackground, darkBackground, uDark);
  vec3 ink = mix(vec3(0.0), vec3(1.0), uDark);
  vec2 logoUv = projectLogo(ray);
  float coverage = scatteredLogo(logoUv, scatter) * uScene.z;
  float halo = scatteredLogo(logoUv, max(scatter, uLogoGlow.x)) * uLogoGlow.y * uScene.z;
  // Keep fully covered logo pixels black/white; the subtle halo only surrounds them.
  vec3 color = mix(mix(background, ink, halo), ink, coverage);
  color = mix(color, mix(vec3(1.0), vec3(0.3, 0.33, 0.36), uDark), tint);
  color += reflection * 0.8 - shadow;
  color += dot(wake, normalize(vec2(-0.7, -0.9))) * uWakeLight;
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  color += grain / 700.0;
  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;
