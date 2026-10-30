import { useLayoutEffect, useRef, useState } from 'react';
import type { PortalUser, View } from '../../api/types';
import { Icon } from '../../components/ui/Icon';
import type { IconName } from '../../components/ui/Icon';

type Item = {
  view: View;
  text: string;
  icon: IconName;
  admin?: boolean;
  upload?: boolean;
  planning?: boolean;
};
const items: Item[] = [
  { view: 'workspace', text: 'Genel bakış', icon: 'overview' },
  { view: 'performance', text: 'Temsilci performansları', icon: 'performance' },
  { view: 'rejections', text: 'Reddedilme nedenleri', icon: 'rejections' },
  { view: 'planning', text: 'Takım planlama', icon: 'plan', planning: true },
  { view: 'agents', text: 'Temsilciler', icon: 'agent' },
  { view: 'imports', text: 'Veri yükleme', icon: 'upload', upload: true },
  { view: 'users', text: 'Kullanıcılar', icon: 'users', admin: true },
  { view: 'activity', text: 'İşlem geçmişi', icon: 'history', admin: true },
];

export function Sidebar({
  user,
  view,
  onView,
  onLogout,
  mobileOpen,
  onClose,
}: {
  user: PortalUser;
  view: View;
  onView: (view: View) => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const nav = useRef<HTMLElement>(null);
  const [selector, setSelector] = useState({ top: 0, height: 48, opacity: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      const active = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
      setSelector(
        active
          ? { top: active.offsetTop, height: active.offsetHeight, opacity: 1 }
          : { top: 0, height: 48, opacity: 0 },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (nav.current) observer.observe(nav.current);
    return () => observer.disconnect();
  }, [view]);
  return (
    <>
      {mobileOpen && (
        <button className="sidebar-scrim" aria-label="Menüyü kapat" onClick={onClose} />
      )}
      <aside
        className={`portal-sidebar ${mobileOpen ? 'is-open' : ''}`}
        aria-label="İşlem navigasyonu"
      >
        <nav ref={nav} className="operation-nav" aria-label="İşlemler">
          <span
            className="navigation-lens"
            aria-hidden
            style={{
              height: selector.height,
              transform: `translateY(${selector.top}px)`,
              opacity: selector.opacity,
            }}
          />
          {items
            .filter(
              (item) =>
                (!item.admin || user.capabilities.manage) &&
                (!item.planning || user.capabilities.allTeams) &&
                (!item.upload || user.capabilities.upload),
            )
            .map((item) => (
              <button
                key={item.view}
                type="button"
                className="operation-button"
                aria-current={view === item.view ? 'page' : undefined}
                onClick={() => {
                  onView(item.view);
                  onClose();
                }}
              >
                <Icon name={item.icon} />
                <span>{item.text}</span>
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="profile-control"
            aria-current={view === 'profile' ? 'page' : undefined}
            onClick={() => {
              onView('profile');
              onClose();
            }}
          >
            <span className="avatar" aria-hidden>
              {user.name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((word) => word[0])
                .join('')
                .toLocaleUpperCase('tr')}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.roleLabel}</small>
            </span>
            <Icon name="chevron" />
          </button>
          <button className="logout-control" onClick={onLogout}>
            <Icon name="logout" />
            <span>Çıkış yap</span>
          </button>
        </div>
      </aside>
    </>
  );
}
