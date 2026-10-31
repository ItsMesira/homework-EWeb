// components/AppShell.tsx — Responsive layout shell
//
// Desktop: sidebar navigation + top bar
// Mobile: bottom navigation with safe-area padding + More menu

import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/th';

interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: string;
  roles?: string[]; // if set, only show for these roles
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',            labelKey: 'overview',      icon: '🏠' },
  { to: '/homework',    labelKey: 'homework',      icon: '📝' },
  { to: '/calendar',    labelKey: 'calendar',      icon: '📅' },
  { to: '/timetable',   labelKey: 'timetable',     icon: '🗓️' },
  { to: '/subjects',    labelKey: 'subjects',      icon: '📚' },
  { to: '/announcements', labelKey: 'announcements', icon: '📢' },
  { to: '/analytics',   labelKey: 'analytics',     icon: '📊', roles: ['president', 'teacher'] },
  { to: '/teacher',     labelKey: 'teacherArea',   icon: '⚙️', roles: ['teacher'] },
];

const MOBILE_NAV_ITEMS = NAV_ITEMS.slice(0, 4);
const MORE_NAV_ITEMS = NAV_ITEMS.slice(4);

export function AppShell({ children }: { children: ReactNode }) {
  const { principal, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!principal) return null;

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(principal.role)
  );
  const visibleMobileItems = MOBILE_NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(principal.role)
  );
  const visibleMoreItems = MORE_NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(principal.role)
  );

  const roleLabel = principal.role === 'teacher' ? t('roleTeacher') :
                    principal.role === 'president' ? t('rolePresident') : t('roleStudent');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      {/* ─── Desktop sidebar ─── */}
      <aside className="app-sidebar" style={{
        width: 'var(--sidebar-width)',
        flexShrink: 0,
        backgroundColor: 'var(--card-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
      }}>
        <div style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--primary)' }}>
            {t('appName')}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
            {t('appSubtitle')}
          </div>
        </div>

        <nav style={{ flex: 1, padding: 'var(--sp-2)', overflowY: 'auto' }}>
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-2)',
                padding: 'var(--sp-2) var(--sp-3)',
                borderRadius: 'var(--radius-btn)',
                fontSize: 'var(--fs-sm)',
                fontWeight: isActive ? 'var(--fw-semibold)' : 'var(--fw-normal)',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--ghost-bg)' : 'transparent',
                textDecoration: 'none',
                marginBottom: '2px',
                transition: 'background-color var(--transition), color var(--transition)',
                minHeight: '44px',
              })}
            >
              <span style={{ fontSize: 'var(--fs-base)' }}>{item.icon}</span>
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: 'var(--sp-3)', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', marginBottom: 'var(--sp-1)' }}>
            {principal.user.firstName} {principal.user.lastName}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>
            {roleLabel}
          </div>
          <button
            className="btn btn-outline"
            style={{ width: '100%', fontSize: 'var(--fs-xs)' }}
            onClick={handleLogout}
          >
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <div style={{
        flex: 1,
        marginLeft: 'var(--sidebar-width)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        {/* Top bar (mobile) */}
        <header className="app-topbar safe-top" style={{
          display: 'none',
          padding: 'var(--sp-3) var(--sp-4)',
          backgroundColor: 'var(--card-surface)',
          borderBottom: '1px solid var(--border)',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 'var(--fw-bold)', color: 'var(--primary)' }}>
            {t('appName')}
          </div>
          <button
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            className="btn btn-ghost"
            style={{ fontSize: 'var(--fs-xs)', minHeight: '36px', padding: '4px 12px' }}
          >
            {lang === 'th' ? 'EN' : 'ไทย'}
          </button>
        </header>

        <main style={{
          flex: 1,
          padding: 'var(--sp-4)',
          paddingBottom: `calc(var(--bottom-nav-height) + var(--sp-4) + env(safe-area-inset-bottom, 0))`,
        }}>
          {children}
        </main>
      </div>

      {/* ─── Mobile bottom navigation ─── */}
      <nav className="app-bottom-nav safe-bottom" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0))',
        backgroundColor: 'var(--card-surface)',
        borderTop: '1px solid var(--border)',
        boxShadow: 'var(--shadow-nav)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 100,
      }}>
        {visibleMobileItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            style={({ isActive }) => ({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              textDecoration: 'none',
              fontSize: 'var(--fs-xs)',
              minHeight: '44px',
              paddingTop: 'var(--sp-1)',
            })}
          >
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            background: 'none',
            border: 'none',
            color: moreOpen ? 'var(--primary)' : 'var(--text-muted)',
            fontSize: 'var(--fs-xs)',
            cursor: 'pointer',
            minHeight: '44px',
            paddingTop: 'var(--sp-1)',
          }}
        >
          <span style={{ fontSize: '20px' }}>{moreOpen ? '✕' : '⋯'}</span>
          <span>{moreOpen ? t('close') : t('more')}</span>
        </button>
      </nav>

      {/* More menu overlay */}
      {moreOpen && (
        <>
          <div
            onClick={() => setMoreOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99,
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
          />
          <div style={{
            position: 'fixed',
            bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0))',
            left: 0,
            right: 0,
            backgroundColor: 'var(--card-surface)',
            borderTop: '1px solid var(--border)',
            borderRadius: 'var(--radius-card) var(--radius-card) 0 0',
            padding: 'var(--sp-4)',
            zIndex: 101,
            boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
          }}>
            {visibleMoreItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMoreOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-3)',
                  padding: 'var(--sp-3)',
                  borderRadius: 'var(--radius-btn)',
                  fontSize: 'var(--fs-base)',
                  fontWeight: isActive ? 'var(--fw-semibold)' : 'var(--fw-normal)',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--ghost-bg)' : 'transparent',
                  textDecoration: 'none',
                  marginBottom: 'var(--sp-1)',
                })}
              >
                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                {t(item.labelKey)}
              </NavLink>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 'var(--sp-2)', paddingTop: 'var(--sp-2)' }}>
              <button
                onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
                className="btn btn-ghost"
                style={{ width: '100%', marginBottom: 'var(--sp-2)' }}
              >
                {lang === 'th' ? t('english') : t('thai')}
              </button>
              <button
                onClick={handleLogout}
                className="btn btn-outline"
                style={{ width: '100%' }}
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Responsive: show/hide sidebar vs bottom nav */}
      <style>{`
        @media (max-width: 768px) {
          .app-sidebar { display: none !important; }
          .app-topbar { display: flex !important; }
          main { margin-left: 0 !important; }
        }
        @media (min-width: 769px) {
          .app-bottom-nav { display: none !important; }
        }
      `}</style>
    </div>
  );
}
