import type { Theme } from '../../hooks/useTheme';
import { GlassSurface } from '../glass/GlassSurface';
import './ThemeSwitch.css';

/** A single keyboard-operable switch with a sliding glass selection lens. */
export function ThemeSwitch({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <GlassSurface material="control" className="theme-control">
      <GlassSurface material="selection" className="theme-lens" aria-hidden="true" />
      <button
        type="button"
        className="theme-switch"
        role="switch"
        aria-label="Koyu tema"
        aria-checked={theme === 'dark'}
        title={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
        onClick={onToggle}
      >
        <span className="theme-icon theme-icon-sun" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="3.75" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </svg>
        </span>
        <span className="theme-icon theme-icon-moon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.6 13.6A8.7 8.7 0 0 1 10.4 3.4 8.7 8.7 0 1 0 20.6 13.6Z" />
          </svg>
        </span>
      </button>
    </GlassSurface>
  );
}
