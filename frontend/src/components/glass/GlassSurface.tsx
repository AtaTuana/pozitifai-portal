import type { CSSProperties, HTMLAttributes } from 'react';
import { visualConfig } from '../../config/visual.config';
import type { GlassMaterial } from '../../config/visual.config';

type GlassSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  material?: GlassMaterial;
};

/** Register a DOM boundary with the shared optical scene; content remains ordinary accessible HTML. */
export function GlassSurface({
  material = 'navigation',
  className = '',
  style,
  children,
  ...props
}: GlassSurfaceProps) {
  const optics = visualConfig.glass[material];

  return (
    <div
      {...props}
      className={`glass-surface ${className}`}
      style={{ '--surface-blur': `${optics.blurPx}px`, ...style } as CSSProperties}
      data-glass-surface={material}
      data-glass-radius={optics.radiusPx}
      data-glass-refraction={optics.refractionPx}
      data-glass-blur={optics.blurPx}
      data-glass-tint={optics.tint}
    >
      {children}
    </div>
  );
}
