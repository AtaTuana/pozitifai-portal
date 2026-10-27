/** The supplied SVG stays intact; its transparent margins are excluded from layout. */
export const logoArtwork = {
  url: `${import.meta.env.BASE_URL}assets/logo.svg`,
  sourceSize: 377,
  bounds: { x: 0, y: 64, width: 377, height: 249 },
} as const;

/** Reuse the original vector artwork in the navbar and CSS fallback scene. */
export function BrandLogo({ className = '' }: { className?: string }) {
  const { bounds, sourceSize, url } = logoArtwork;
  return (
    <svg
      className={className}
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <image href={url} width={sourceSize} height={sourceSize} />
    </svg>
  );
}
