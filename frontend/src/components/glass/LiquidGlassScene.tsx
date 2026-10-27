import { useEffect, useRef, useState } from 'react';
import type { Theme } from '../../hooks/useTheme';
import { createGlassRenderer } from './createGlassRenderer';
import type { GlassRenderer } from './createGlassRenderer';
import './LiquidGlassScene.css';
import { BrandLogo, logoArtwork } from '../brand/BrandLogo';
import { createCssPerspective } from './createCssPerspective';
import { visualConfig } from '../../config/visual.config';

/** Keep the decorative optical scene separate from accessible, interactive portal content. */
export function LiquidGlassScene({ theme }: { theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GlassRenderer | null>(null);
  const initialTheme = useRef(theme);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    let stopPerspective: (() => void) | undefined;
    const fallback = (error?: Error) => {
      if (!active) return;
      document.documentElement.dataset.glassRenderer = 'css';
      if (!stopPerspective && planeRef.current)
        stopPerspective = createCssPerspective(planeRef.current);
      if (error) console.warn(error.message);
    };
    const lost = (event: Event) => {
      event.preventDefault();
      fallback();
    };
    const restored = () => setGeneration((value) => value + 1);
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    try {
      if (visualConfig.performance.renderer === 'css') {
        fallback();
      } else
        rendererRef.current = createGlassRenderer(canvas, {
          theme: initialTheme.current,
          logoUrl: logoArtwork.url,
          onReady: () => {
            if (!active) return;
            stopPerspective?.();
            stopPerspective = undefined;
            document.documentElement.dataset.glassRenderer = 'webgl';
          },
          onError: fallback,
        });
    } catch (error) {
      fallback(error instanceof Error ? error : new Error('GL000: Cam görünümü başlatılamadı.'));
    }
    return () => {
      active = false;
      stopPerspective?.();
      rendererRef.current?.dispose();
      rendererRef.current = null;
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      delete document.documentElement.dataset.glassRenderer;
    };
  }, [generation]);

  useEffect(() => {
    initialTheme.current = theme;
    rendererRef.current?.setTheme(theme);
  }, [theme, generation]);

  return (
    <div className="liquid-scene" aria-hidden="true">
      <div className="scene-backdrop">
        <div className="scene-logo-plane" ref={planeRef}>
          <BrandLogo className="scene-logo" />
        </div>
      </div>
      <div className="scene-frost" />
      <canvas className="scene-canvas" ref={canvasRef} />
    </div>
  );
}
