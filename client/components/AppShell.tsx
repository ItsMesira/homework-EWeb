// components/AppShell.tsx — Responsive layout shell
//
// Desktop: sidebar navigation + top bar
// Mobile: bottom navigation with safe-area padding + More menu

import { ReactNode, useState } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/th';
import { BrandMark, Icon, IconName } from './ui';
import './AppShell.css';

interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: IconName;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',            labelKey: 'overview',      icon: 'overview' },
  { to: '/homework',    labelKey: 'homework',      icon: 'homework' },
  { to: '/calendar',    labelKey: 'calendar',      icon: 'calendar' },
  { to: '/timetable',   labelKey: 'timetable',     icon: 'timetable' },
  { to: '/subjects',    labelKey: 'subjects',      icon: 'subjects' },
  { to: '/announcements', labelKey: 'announcements', icon: 'announcements' },
  { to: '/analytics',   labelKey: 'analytics',     icon: 'analytics', roles: ['president', 'teacher'] },
  { to: '/teacher',     labelKey: 'teacherArea',   icon: 'settings', roles: ['teacher'] },
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

  const roleLabel =
    principal.role === 'teacher' ? t('roleTeacher') :
    principal.role === 'president' ? t('rolePresident') : t('roleStudent');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      {/* ─── Desktop sidebar ─── */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <BrandMark size={28} />
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">{t('appName')}</div>
            <div className="sidebar-brand-subtitle">{t('appSubtitle')}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon name={item.icon} size={18} />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link to="/account" className="sidebar-user-card" style={{ textDecoration: 'none' }}>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {principal.user.firstName} {principal.user.lastName}
              </div>
              <div className="sidebar-user-role">{roleLabel}</div>
            </div>
            <Icon name="account" size={16} className="text-muted" />
          </Link>

          <div className="sidebar-actions">
            <button
              type="button"
              onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
              className="btn btn-ghost btn-sm flex-1"
              title="Toggle Language"
            >
              <Icon name="language" size={14} />
              <span>{lang === 'th' ? 'EN' : 'ไทย'}</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              onClick={handleLogout}
              title={t('logout')}
              aria-label={t('logout')}
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <div className="app-main">
        {/* Top bar (mobile) */}
        <header className="app-topbar safe-top">
          <div className="topbar-brand">
            <BrandMark size={24} />
            <span>{t('appName')}</span>
          </div>
          <button
            type="button"
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            className="btn btn-ghost btn-sm"
          >
            <Icon name="language" size={14} />
            <span>{lang === 'th' ? 'EN' : 'ไทย'}</span>
          </button>
        </header>

        <main className="app-content">
          {children}
        </main>
      </div>

      {/* ─── Mobile bottom navigation ─── */}
      <nav className="app-bottom-nav safe-bottom">
        {visibleMobileItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name={item.icon} size={20} />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}

        {/* More button */}
        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          className={`bottom-nav-item ${moreOpen ? 'active' : ''}`}
          aria-expanded={moreOpen}
          aria-label={moreOpen ? t('close') : t('more')}
        >
          <Icon name={moreOpen ? 'close' : 'more'} size={20} />
          <span>{moreOpen ? t('close') : t('more')}</span>
        </button>
      </nav>

      {/* More menu sheet */}
      {moreOpen && (
        <>
          <div
            className="more-sheet-backdrop"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="more-sheet" role="dialog" aria-modal="true" aria-label={t('more')}>
            <div className="more-sheet-nav">
              {visibleMoreItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) => `more-sheet-link ${isActive ? 'active' : ''}`}
                >
                  <Icon name={item.icon} size={20} />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              ))}

              <NavLink
                to="/account"
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) => `more-sheet-link ${isActive ? 'active' : ''}`}
              >
                <Icon name="account" size={20} />
                <span>{t('account')}</span>
              </NavLink>
            </div>

            <div className="more-sheet-actions">
              <button
                type="button"
                onClick={() => {
                  setLang(lang === 'th' ? 'en' : 'th');
                  setMoreOpen(false);
                }}
                className="btn btn-ghost w-full justify-center"
              >
                <Icon name="language" size={16} />
                <span>{lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  handleLogout();
                }}
                className="btn btn-outline btn-danger w-full justify-center"
              >
                <Icon name="logout" size={16} />
                <span>{t('logout')}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
