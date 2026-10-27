import { fragmentShader, vertexShader } from './shaders';
import type { Theme } from '../../hooks/useTheme';
import { visualConfig } from '../../config/visual.config';
import { logoArtwork } from '../brand/BrandLogo';
import { createPointerWake } from './pointerWake';
import { followAmount, logoProjection } from './logoProjection';

import { themeProgress } from '../../hooks/themeTransition';

const MAX_SURFACES = 8;
const LOGO_TEXTURE_WIDTH = 1536;
const LOGO_ASPECT = logoArtwork.bounds.height / logoArtwork.bounds.width;

type RendererOptions = {
  theme: Theme;
  logoUrl: string;
  onReady: () => void;
  onError: (error: Error) => void;
};

/** Compile shader sources once; startup failure leaves the CSS material usable. */
function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('GL001: Grafik kaynaÄŸÄ± oluÅŸturulamadÄ±.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const detail = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`GL002: Cam efekti derlenemedi. ${detail ?? ''}`);
  }
  return shader;
}

/**
 * One GPU context owns every optical layer. Animation stops when motion settles
 * and while the tab is hidden, so the future local LLM need not compete with an idle effect.
 */
export function createGlassRenderer(canvas: HTMLCanvasElement, options: RendererOptions) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: visualConfig.performance.powerPreference,
  });
  if (!gl)
    throw new Error('GL003: WebGL 2 kullanÄ±lamÄ±yor; CSS cam ve perspektif gÃ¶rÃ¼nÃ¼mÃ¼ etkin.');

  const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
  const program = gl.createProgram();
  if (!program) throw new Error('GL001: Grafik programÄ± oluÅŸturulamadÄ±.');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const detail = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`GL004: Cam katmanlarÄ± baÄŸlanamadÄ±. ${detail ?? ''}`);
  }

  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  );

  const uniforms = {
    resolution: gl.getUniformLocation(program, 'uResolution'),
    motion: gl.getUniformLocation(program, 'uMotion'),
    dark: gl.getUniformLocation(program, 'uDark'),
    logoSize: gl.getUniformLocation(program, 'uLogoSize'),
    count: gl.getUniformLocation(program, 'uSurfaceCount'),
    rects: gl.getUniformLocation(program, 'uRects[0]'),
    materials: gl.getUniformLocation(program, 'uMaterials[0]'),
    logoAspect: gl.getUniformLocation(program, 'uLogoAspect'),
    logoCenter: gl.getUniformLocation(program, 'uLogoCenter'),
    projection: gl.getUniformLocation(program, 'uLogoProjection'),
    scene: gl.getUniformLocation(program, 'uScene'),
    logoGlow: gl.getUniformLocation(program, 'uLogoGlow'),
    wakeCount: gl.getUniformLocation(program, 'uWakeCount'),
    wake: gl.getUniformLocation(program, 'uWake[0]'),
    wakeStrength: gl.getUniformLocation(program, 'uWakeStrength[0]'),
    wakeBounds: gl.getUniformLocation(program, 'uWakeBounds'),
    wakeSettings: gl.getUniformLocation(program, 'uWakeSettings'),
    wakeLight: gl.getUniformLocation(program, 'uWakeLight'),
  };
  gl.uniform1i(gl.getUniformLocation(program, 'uLogo'), 0);
  gl.uniform1f(uniforms.logoAspect, LOGO_ASPECT);
  gl.uniform2f(uniforms.logoCenter, visualConfig.logo.centerX, visualConfig.logo.centerY);
  gl.uniform2f(uniforms.logoGlow, visualConfig.logo.glowRadiusPx, visualConfig.logo.glowStrength);
  gl.uniform4f(
    uniforms.scene,
    visualConfig.glass.background.blurPx,
    visualConfig.glass.background.refractionPx,
    visualConfig.logo.opacity,
    LOGO_TEXTURE_WIDTH,
  );
  gl.uniform4f(
    uniforms.wakeSettings,
    visualConfig.wake.lifetimeMs / 1000,
    visualConfig.wake.spreadPxPerSecond,
    visualConfig.wake.softnessPx,
    visualConfig.wake.refractionPx,
  );
  gl.uniform1f(uniforms.wakeLight, visualConfig.wake.lightStrength);

  const rects = new Float32Array(MAX_SURFACES * 4);
  const materials = new Float32Array(MAX_SURFACES * 4);
  const projection = new Float32Array(9);
  const wake = createPointerWake();
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new AbortController();
  let disposed = false;
  let loaded = false;
  let frame = 0;
  let lastTime = 0;
  let animateUntil = 0;
  let width = 1;
  let height = 1;
  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;
  let measurementsDirty = true;
  let lastDraw = -Infinity;
  const frameInterval = 1000 / Math.max(1, visualConfig.performance.maxFps);
  let surfaces: HTMLElement[] = [];

  function requestFrame() {
    if (!disposed && !frame && loaded && !document.hidden && !gl!.isContextLost()) {
      frame = requestAnimationFrame(render);
    }
  }

  /** Cap backing resolution independently from layout to bound GPU cost on high-DPI screens. */
  function resize() {
    width = Math.max(canvas.clientWidth, 1);
    height = Math.max(canvas.clientHeight, 1);
    const scale = Math.min(
      devicePixelRatio || 1,
      visualConfig.performance.maxDevicePixelRatio,
      Math.sqrt(visualConfig.performance.maxRenderPixels / (width * height)),
    );
    const nextWidth = Math.round(width * scale),
      nextHeight = Math.round(height * scale);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    gl!.viewport(0, 0, canvas.width, canvas.height);
    surfaces = [...document.querySelectorAll<HTMLElement>('[data-glass-surface]')].slice(
      0,
      MAX_SURFACES,
    );
    measurementsDirty = true;
    requestFrame();
  }

  /** Read the live DOM bounds so the animated switch lens and its refraction stay aligned. */
  function measureSurfaces(animatedOnly = false) {
    const origin = canvas.getBoundingClientRect();
    surfaces.forEach((element, index) => {
      if (animatedOnly && element.dataset.glassSurface !== 'selection') return;
      const offset = index * 4;
      if (
        getComputedStyle(element).visibility === 'hidden' ||
        element.closest('.login-layer[inert]')
      ) {
        rects.set([-10000, -10000, 0, 0], offset);
        materials.fill(0, offset, offset + 4);
        return;
      }
      const rect = element.getBoundingClientRect();
      rects.set([rect.left - origin.left, rect.top - origin.top, rect.width, rect.height], offset);
      materials.set(
        [
          Number(element.dataset.glassRadius),
          Number(element.dataset.glassRefraction),
          Number(element.dataset.glassBlur),
          Number(element.dataset.glassTint),
        ],
        offset,
      );
    });
  }

  function render(time: number) {
    frame = 0;
    if (disposed || document.hidden || gl!.isContextLost()) return;
    if (time - lastDraw < frameInterval - 0.5) {
      requestFrame();
      return;
    }
    lastDraw = Number.isFinite(lastDraw) ? time - ((time - lastDraw) % frameInterval) : time;
    const dt = Math.min((time - lastTime) / 1000 || 1 / 60, 0.1);
    lastTime = time;

    if (media.matches) {
      x = y = 0;

      wake.clear();
    } else {
      const follow = followAmount(dt, visualConfig.perspective.followAt60Fps);
      x += (targetX - x) * follow;
      y += (targetY - y) * follow;
    }

    if (measurementsDirty || time < animateUntil) {
      measureSurfaces(!measurementsDirty);
      measurementsDirty = false;
    }
    gl!.useProgram(program);
    gl!.uniform2f(uniforms.resolution, width, height);
    gl!.uniform2f(uniforms.motion, x, y);
    gl!.uniform1f(uniforms.dark, themeProgress());
    const logo = visualConfig.logo;
    const logoWidth = Math.min(
      width * (width < 600 ? logo.mobileWidthRatio : logo.viewportWidthRatio),
      logo.maxWidthPx,
      (height * logo.maxViewportHeightRatio) / LOGO_ASPECT,
    );
    gl!.uniform1f(uniforms.logoSize, logoWidth);
    logoProjection(
      width,
      height,
      logoWidth,
      LOGO_ASPECT,
      logo.centerX,
      logo.centerY,
      visualConfig.perspective.enabled ? x : 0,
      visualConfig.perspective.enabled ? y : 0,
      visualConfig.perspective,
      projection,
    );
    gl!.uniformMatrix3fv(uniforms.projection, false, projection);
    const wakeCount = wake.update(time);
    gl!.uniform1i(uniforms.wakeCount, wakeCount);
    gl!.uniform4fv(uniforms.wake, wake.uniforms);
    gl!.uniform1fv(uniforms.wakeStrength, wake.strengths);
    gl!.uniform4fv(uniforms.wakeBounds, wake.bounds);
    gl!.uniform1i(uniforms.count, surfaces.length);
    gl!.uniform4fv(uniforms.rects, rects);
    gl!.uniform4fv(uniforms.materials, materials);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);

    const unsettled = Math.abs(targetX - x) + Math.abs(targetY - y) > 0.001;
    if (!media.matches && (unsettled || wakeCount > 0 || time < animateUntil)) requestFrame();
  }

  function onPointerMove(event: PointerEvent) {
    if (media.matches || event.pointerType === 'touch') return;
    targetX = Math.max(-1, Math.min(1, (event.clientX / width) * 2 - 1));
    targetY = Math.max(-1, Math.min(1, (event.clientY / height) * 2 - 1));
    if (visualConfig.wake.enabled)
      wake.push(event.clientX, event.clientY, performance.now(), event.buttons !== 0);
    requestFrame();
  }

  function resetPointer() {
    targetX = targetY = 0;
    wake.leave();
    requestFrame();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const surfaceObserver = new MutationObserver((changes) => {
    const glassChanged = changes.some((change) =>
      [...change.addedNodes, ...change.removedNodes].some(
        (node) =>
          node instanceof Element &&
          (node.matches('[data-glass-surface]') || node.querySelector('[data-glass-surface]')),
      ),
    );
    if (!glassChanged) return;
    surfaces = [...document.querySelectorAll<HTMLElement>('[data-glass-surface]')].slice(
      0,
      MAX_SURFACES,
    );
    measurementsDirty = true;
    requestFrame();
  });
  surfaceObserver.observe(document.getElementById('root')!, { childList: true, subtree: true });
  window.addEventListener('pointermove', onPointerMove, {
    passive: true,
    signal: listeners.signal,
  });
  document.documentElement.addEventListener('pointerleave', resetPointer, {
    signal: listeners.signal,
  });
  window.addEventListener('blur', resetPointer, { signal: listeners.signal });
  const invalidateMeasurements = () => {
    measurementsDirty = true;
    requestFrame();
  };
  window.addEventListener('scroll', invalidateMeasurements, {
    passive: true,
    signal: listeners.signal,
  });
  window.addEventListener('portal:glass-change', invalidateMeasurements, {
    signal: listeners.signal,
  });
  window.addEventListener('portal:theme-frame', requestFrame, { signal: listeners.signal });
  media.addEventListener('change', resetPointer, { signal: listeners.signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        lastTime = performance.now();
        requestFrame();
      }
    },
    { signal: listeners.signal },
  );

  const image = new Image();
  image.onload = () => {
    if (disposed) return;
    // Crop only the SVG's transparent margins so the visible artwork is centered consistently.
    const artwork = document.createElement('canvas');
    artwork.width = LOGO_TEXTURE_WIDTH;
    artwork.height = Math.round(LOGO_TEXTURE_WIDTH * LOGO_ASPECT);
    const context = artwork.getContext('2d');
    if (!context) {
      options.onError(new Error('GL005: Logo dokusu oluÅŸturulamadÄ±.'));
      return;
    }
    const { bounds, sourceSize } = logoArtwork;
    // Some browsers report a default SVG intrinsic size. Crop a rasterized copy instead.
    const original = document.createElement('canvas');
    original.width = original.height = LOGO_TEXTURE_WIDTH;
    const originalContext = original.getContext('2d');
    if (!originalContext) {
      options.onError(new Error('GL005: Logo dokusu oluÅŸturulamadÄ±.'));
      return;
    }
    originalContext.drawImage(image, 0, 0, original.width, original.height);
    const scaleX = original.width / sourceSize;
    const scaleY = original.height / sourceSize;
    context.drawImage(
      original,
      bounds.x * scaleX,
      bounds.y * scaleY,
      bounds.width * scaleX,
      bounds.height * scaleY,
      0,
      0,
      artwork.width,
      artwork.height,
    );
    gl!.bindTexture(gl!.TEXTURE_2D, texture);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, artwork);
    gl!.generateMipmap(gl!.TEXTURE_2D);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR_MIPMAP_LINEAR);
    loaded = true;
    resize();
    options.onReady();
  };
  image.onerror = () => options.onError(new Error('GL006: Logo yÃ¼klenemedi.'));
  image.src = options.logoUrl;
  resize();

  return {
    setTheme(theme: Theme) {
      // Only the switch lens moves. Theme frames do not invalidate surface geometry.
      void theme;
      animateUntil = performance.now() + 650;
      requestFrame();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      listeners.abort();
      resizeObserver.disconnect();
      surfaceObserver.disconnect();
      image.onload = image.onerror = null;
      gl!.deleteTexture(texture);
      gl!.deleteBuffer(buffer);
      gl!.deleteProgram(program);
    },
  };
}

export type GlassRenderer = ReturnType<typeof createGlassRenderer>;
