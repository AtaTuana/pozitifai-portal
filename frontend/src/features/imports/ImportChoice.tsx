import { useLayoutEffect, useRef } from 'react';
import { visualConfig } from '../../config/visual.config';
import { roundedPath } from './useImportTransition';
import type { UploadKind } from './useImportTransition';

const choices: { kind: UploadKind; label: string; path: string }[] = [
  {
    kind: 'calls',
    label: 'Calls',
    path: 'M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2Z',
  },
  { kind: 'quality', label: 'Quality scores', path: 'M8 5H5v16h14V5h-3M8 3h8v5H8zM8 15l3 3 5-6' },
  { kind: 'transcript', label: 'Transkriptler', path: 'M4 4h16v13H9l-5 4V4Zm4 4h8m-8 5h5' },
];

/** Two short highlights start at opposite corners and follow the clockwise perimeter. */
function BorderTrace() {
  const svg = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const node = svg.current;
    if (!node) return;
    const paths = node.querySelectorAll('path');
    const observer = new ResizeObserver(([entry]) => {
      const d = roundedPath(
        1,
        1,
        Math.max(0, entry.contentRect.width - 2),
        Math.max(0, entry.contentRect.height - 2),
        visualConfig.imports.cardRadiusPx,
      );
      paths.forEach((path) => path.setAttribute('d', d));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <svg ref={svg} className="import-border-trace" aria-hidden="true">
      <path className="import-trace-halo" pathLength="100" />
      <path className="import-trace-core" pathLength="100" />
    </svg>
  );
}

export function ImportChoices({
  onChoose,
}: {
  onChoose: (kind: UploadKind, button: HTMLButtonElement) => void;
}) {
  return (
    <div className="import-choices" aria-label="Yüklenecek veri türü">
      {choices.map(({ kind, label, path }) => (
        <button
          key={kind}
          type="button"
          className="import-choice"
          onClick={(event) => onChoose(kind, event.currentTarget)}
        >
          <BorderTrace />
          <span className="import-choice-content">
            <svg
              className="import-choice-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={path} />
            </svg>
            <span>{label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
