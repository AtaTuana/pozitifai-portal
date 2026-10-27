import type { Theme } from '../../hooks/useTheme';
import { ThemeSwitch } from '../theme/ThemeSwitch';
import { BrandLogo } from '../brand/BrandLogo';
import './PortalHeader.css';
import type { Plan } from '../../api/types';
import { Icon } from '../ui/Icon';

type PortalHeaderProps = {
  theme: Theme;
  onToggleTheme: () => void;
  authenticated?: boolean;
  phase: string;
  plan?: Plan | null;
  campaign?: string;
  onCampaign?: (id: string) => void;
  onMenu?: () => void;
  onHome?: () => void;
  menuOpen?: boolean;
};

/** Transparent controls sit above the separate rear glass and front folder sheet. */
export function PortalHeader({
  theme,
  onToggleTheme,
  authenticated,
  phase,
  plan,
  campaign = '',
  onCampaign,
  onMenu,
  onHome,
  menuOpen,
}: PortalHeaderProps) {
  return (
    <header className="portal-header" inert={phase !== 'workspace'}>
      <div className="portal-navbar">
        <nav className="portal-navigation" aria-label="Ana gezinme">
          <a
            className="brand"
            href="./"
            aria-label="PozitifAI ana sayfa"
            onClick={
              onHome
                ? (event) => {
                    event.preventDefault();
                    onHome();
                  }
                : undefined
            }
          >
            <BrandLogo className="brand-logo" />
          </a>
          {authenticated && (
            <>
              <button
                className="icon-button mobile-menu"
                aria-label="İşlem menüsünü aç"
                aria-expanded={menuOpen}
                onClick={onMenu}
              >
                <Icon name="menu" />
              </button>
              <nav className="campaign-nav" aria-label="Kampanyalar">
                <button
                  type="button"
                  className="campaign-tab"
                  aria-pressed={!campaign}
                  onClick={() => onCampaign?.('')}
                >
                  Tüm kampanyalar
                </button>
                {plan?.nodes
                  .filter((node) => node.kind === 'campaign')
                  .map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      className="campaign-tab"
                      aria-pressed={campaign === node.id}
                      onClick={() => onCampaign?.(node.id)}
                    >
                      {node.name}
                    </button>
                  ))}
              </nav>
            </>
          )}
          <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
        </nav>
      </div>
    </header>
  );
}

/** The login keeps floating brand/theme controls, without a navbar glass strip. */
export function LoginHeader({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return (
    <header className="login-header" aria-label="Giriş görünümü">
      <a className="brand" href="./" aria-label="PozitifAI ana sayfa">
        <BrandLogo className="brand-logo" />
      </a>
      <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
    </header>
  );
}
