import { LiquidGlassScene } from '../components/glass/LiquidGlassScene';
import { LoginHeader, PortalHeader } from '../components/layout/PortalHeader';
import { useTheme } from '../hooks/useTheme';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { visualConfig } from '../config/visual.config';
import { api, errorMessage } from '../api/client';
import type { Plan, PortalUser, Session, View } from '../api/types';
import { LoginPage } from '../features/auth/LoginPage';
import { AuthGlass } from '../features/auth/AuthGlass';
import { Sidebar } from '../features/workspace/Sidebar';
import { AgentsPage, ActivityPage } from '../features/workspace/RecordPages';
import { UsersPage } from '../features/users/UsersPage';
import { ProfilePage } from '../features/users/ProfilePage';
import { Dialog } from '../components/ui/Dialog';
import '../styles/portal.css';

const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
);
const PerformancePage = lazy(() =>
  import('../features/performance/PerformancePage').then((module) => ({
    default: module.PerformancePage,
  })),
);
const PlanningPage = lazy(() =>
  import('../features/planning/PlanningPage').then((module) => ({
    default: module.PlanningPage,
  })),
);
const ImportsPage = lazy(() =>
  import('../features/imports/ImportsPage').then((module) => ({
    default: module.ImportsPage,
  })),
);
const RejectionsPage = lazy(() =>
  import('../features/rejections/RejectionsPage').then((module) => ({
    default: module.RejectionsPage,
  })),
);
const validViews: View[] = [
  'performance',
  'rejections',
  'workspace',
  'planning',
  'agents',
  'users',
  'activity',
  'profile',
  'imports',
];
function allowedView(view: View, user: PortalUser | null): boolean {
  return !(
    (['users', 'activity'].includes(view) && !user?.capabilities.manage) ||
    (view === 'planning' && !user?.capabilities.allTeams) ||
    (view === 'imports' && !user?.capabilities.upload)
  );
}
function routeView(): View {
  const route = location.hash.slice(1) as View;
  return validViews.includes(route) ? route : 'workspace';
}

const visualTokens = {
  '--header-height': `${visualConfig.layout.navbarHeightPx}px`,
  '--navbar-logo-width': `${visualConfig.layout.navbarLogoWidthPx}px`,
  '--theme-duration': `${visualConfig.theme.transitionMs}ms`,
  '--scene-blur': `${visualConfig.glass.background.blurPx}px`,
  '--logo-max-width': `${visualConfig.logo.maxWidthPx}px`,
  '--logo-width': `${visualConfig.logo.viewportWidthRatio * 100}vw`,
  '--logo-mobile-width': `${visualConfig.logo.mobileWidthRatio * 100}vw`,
  '--logo-max-height': `${visualConfig.logo.maxViewportHeightRatio * 100}svh`,
  '--logo-center-x': `${visualConfig.logo.centerX * 100}%`,
  '--logo-center-y': `${visualConfig.logo.centerY * 100}%`,
  '--logo-opacity': visualConfig.logo.opacity,
  '--logo-glow-radius': `${visualConfig.logo.glowRadiusPx}px`,
  '--logo-glow-strength': visualConfig.logo.glowStrength,
  '--auth-content-duration': `${visualConfig.motion.contentFadeMs}ms`,
  '--rear-glass-blur': `${visualConfig.glass.navigation.blurPx}px`,
  '--workspace-blur': `${visualConfig.glass.workspace.blurPx}px`,
  '--workspace-veil': visualConfig.glass.workspace.veilOpacity,
} as CSSProperties;

/** Keep one visual shell alive while authenticated feature pages enter and leave it. */
export function App() {
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [phase, setPhase] = useState('login');
  const [view, setView] = useState<View>(routeView);
  const [campaign, setCampaign] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<View | 'logout' | null>(null);
  const generation = useRef(0);

  const reset = useCallback(() => {
    generation.current++;
    setExpanded(false);
    setPhase('leaving');
    setUser(null);
    setPlan(null);
    setDirty(false);
    setMobileOpen(false);
    setPendingNavigation(null);
    setCampaign('');
  }, []);
  const openSession = useCallback(async (identity: PortalUser, token: number) => {
    const nextPlan = await api<Plan>('/workspace');
    if (token !== generation.current) return;
    setPlan(nextPlan);
    setUser(identity);
    setNeedsSetup(false);
    const next = routeView();
    setView(allowedView(next, identity) ? next : 'workspace');
    setPhase('entering');
    setExpanded(true);
  }, []);
  const loadSession = useCallback(async () => {
    const token = ++generation.current;
    setLoading(true);
    setLoginError('');
    try {
      const session = await api<Session>('/session');
      if (token !== generation.current) return;
      setNeedsSetup(!!session.needsSetup);
      if (session.user) await openSession(session.user, token);
    } catch (error) {
      if (token === generation.current) setLoginError(errorMessage(error));
    } finally {
      if (token === generation.current) setLoading(false);
    }
  }, [openSession]);
  useEffect(() => {
    void loadSession();
    const expired = () => {
      reset();
      setLoading(false);
      setLoginError('Oturumun sona erdi. Yeniden giriş yap.');
      void api('/session').catch(() => {});
    };
    window.addEventListener('portal:session-expired', expired);
    return () => {
      generation.current++;
      window.removeEventListener('portal:session-expired', expired);
    };
  }, [loadSession, reset]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (phase === 'workspace' && !mobileOpen)
      document.getElementById('main')?.focus({ preventScroll: true });
  }, [phase, view, mobileOpen]);
  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        document.querySelector<HTMLButtonElement>('.mobile-menu')?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [mobileOpen]);
  const navigate = (next: View) => {
    if (!allowedView(next, user)) return;
    if (dirty && next !== view) {
      setPendingNavigation(next);
      return;
    }
    setView(next);
    history.pushState(null, '', `#${next}`);
  };
  useEffect(() => {
    const pop = () => {
      const next = routeView();
      if (dirty) {
        setPendingNavigation(next);
        history.replaceState(null, '', `#${view}`);
      } else setView(allowedView(next, user) ? next : 'workspace');
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [dirty, view, user]);
  const logout = async () => {
    try {
      await api('/logout', 'POST', {});
      reset();
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };
  const savePlan = useCallback((saved: Plan) => {
    setPlan(saved);
    setDirty(false);
  }, []);
  const refreshPlan = useCallback(async () => {
    const token = generation.current;
    const updated = await api<Plan>('/workspace');
    if (token === generation.current) setPlan(updated);
  }, []);

  return (
    <div className="portal-shell" data-auth-phase={phase} style={visualTokens}>
      <a className="skip-link" href={user ? '#main' : '#login-main'}>
        İçeriğe geç
      </a>
      <LiquidGlassScene theme={theme} />
      <AuthGlass expanded={expanded} onSettled={() => setPhase(expanded ? 'workspace' : 'login')} />
      <PortalHeader
        theme={theme}
        onToggleTheme={toggleTheme}
        authenticated={!!user}
        phase={phase}
        plan={plan}
        campaign={campaign}
        onCampaign={(id) => {
          setCampaign(id);
          if (view !== 'rejections' && view !== 'performance') navigate('workspace');
        }}
        onMenu={() => setMobileOpen(!mobileOpen)}
        menuOpen={mobileOpen}
        onHome={user ? () => navigate('workspace') : undefined}
      />
      <div className="login-layer" inert={phase !== 'login'}>
        <LoginHeader theme={theme} onToggleTheme={toggleTheme} />
        <LoginPage
          loading={loading}
          needsSetup={needsSetup}
          error={loginError}
          onRetry={() => void loadSession()}
          onLogin={async (email, password) => {
            const token = ++generation.current;
            const result = await api<Session>('/login', 'POST', {
              email,
              password,
            });
            if (result.user) await openSession(result.user, token);
          }}
        />
      </div>
      {user && plan && (
        <div className="workspace-layer" inert={phase !== 'workspace'}>
          <Sidebar
            user={user}
            view={view}
            onView={navigate}
            mobileOpen={mobileOpen}
            onClose={() => setMobileOpen(false)}
            onLogout={() => (dirty ? setPendingNavigation('logout') : void logout())}
          />
          <main id="main" className="portal-workspace" tabIndex={-1}>
            {view === 'workspace' && (
              <Suspense
                fallback={
                  <p className="loading-state" role="status">
                    Rapor açılıyor…
                  </p>
                }
              >
                <DashboardPage
                  plan={plan}
                  user={user}
                  campaignId={plan.nodes.find((node) => node.id === campaign)?.code || ''}
                  campaignName={
                    plan.nodes.find((node) => node.id === campaign)?.name || 'Tüm kampanyalar'
                  }
                />
              </Suspense>
            )}
            {view === 'rejections' && (
              <Suspense
                fallback={
                  <p className="loading-state" role="status">
                    Analiz alanı açılıyor…
                  </p>
                }
              >
                <RejectionsPage
                  key={campaign}
                  campaignId={plan.nodes.find((node) => node.id === campaign)?.code || ''}
                  campaignName={
                    plan.nodes.find((node) => node.id === campaign)?.name || 'Tüm kampanyalar'
                  }
                />
              </Suspense>
            )}
            {view === 'performance' && (
              <Suspense
                fallback={
                  <p className="loading-state" role="status">
                    Temsilci performansları açılıyor…
                  </p>
                }
              >
                <PerformancePage
                  plan={plan}
                  user={user}
                  campaignId={plan.nodes.find((node) => node.id === campaign)?.code || ''}
                  campaignName={
                    plan.nodes.find((node) => node.id === campaign)?.name || 'Tüm kampanyalar'
                  }
                />
              </Suspense>
            )}
            {view === 'planning' && user.capabilities.allTeams && (
              <Suspense
                fallback={
                  <p className="loading-state" role="status">
                    Planlama açılıyor…
                  </p>
                }
              >
                <PlanningPage
                  key={`${user.id}:${plan.revision}`}
                  initial={plan}
                  editable={user.capabilities.manage}
                  userId={user.id}
                  onSaved={savePlan}
                  onDirty={setDirty}
                />
              </Suspense>
            )}
            {view === 'agents' && (
              <AgentsPage
                plan={plan}
                canManage={user.capabilities.manage}
                onImported={refreshPlan}
              />
            )}
            {view === 'imports' && user.capabilities.upload && (
              <Suspense
                fallback={
                  <p className="loading-state" role="status">
                    Yükleme alanı açılıyor…
                  </p>
                }
              >
                <ImportsPage onImported={refreshPlan} />
              </Suspense>
            )}
            {view === 'users' && user.capabilities.manage && (
              <UsersPage
                plan={plan}
                currentUser={user}
                onSelfChanged={() => {
                  reset();
                  void loadSession();
                }}
              />
            )}
            {view === 'activity' && user.capabilities.manage && <ActivityPage />}
            {view === 'profile' && (
              <ProfilePage
                user={user}
                onUpdated={setUser}
                onSignedOut={() => {
                  reset();
                  setLoginError('Şifren güncellendi. Yeni şifrenle giriş yap.');
                }}
              />
            )}
          </main>
        </div>
      )}
      {notice && (
        <div className="portal-toast" role="status">
          {notice}
        </div>
      )}
      {pendingNavigation && (
        <Dialog title="Kaydedilmemiş değişiklikler" onClose={() => setPendingNavigation(null)}>
          <p>Taslağı kaydetmeden çıkmak istiyor musun?</p>
          <div className="form-actions">
            <button className="text-button" onClick={() => setPendingNavigation(null)}>
              Düzenlemeye dön
            </button>
            <button
              className="primary-button"
              onClick={() => {
                const next = pendingNavigation;
                setPendingNavigation(null);
                setDirty(false);
                if (next === 'logout') void logout();
                else {
                  setView(next);
                  history.pushState(null, '', `#${next}`);
                }
              }}
            >
              Kaydetmeden çık
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
