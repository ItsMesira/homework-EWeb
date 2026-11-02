// pages/AccountSettingsPage.tsx — Account settings

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { apiClient } from '../api/client';
import { PageHeader, Icon } from '../components/ui';
import './AccountSettingsPage.css';

export function AccountSettingsPage() {
  const { principal, logout, refresh } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [searchParams] = useSearchParams();
  const linkStatus = searchParams.get('link_status');
  const linkError = searchParams.get('link_error');
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // After a successful Discord link the server re-issues the session cookie;
  // refresh the principal so the linked ID appears without a manual reload.
  useEffect(() => {
    if (linkStatus === 'linked') refresh();
  }, [linkStatus, refresh]);

  useEffect(() => {
    setPushSupported('serviceWorker' in navigator && 'PushManager' in window);
    navigator.serviceWorker?.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setPushEnabled(!!sub);
    }).catch(() => {});
  }, []);

  const togglePush = useCallback(async () => {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (pushEnabled) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          // The server row may already be gone (e.g. revoked elsewhere);
          // always drop the browser subscription too.
          try {
            await apiClient.push.unsubscribe(sub.endpoint);
          } catch { /* already unsubscribed server-side */ }
          await sub.unsubscribe();
        }
        setPushEnabled(false);
      } else {
        const { publicKey } = await apiClient.push.vapidPublicKey();
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        });
        await apiClient.push.subscribe(sub);
        setPushEnabled(true);
      }
    } catch (err) {
      console.error('Push toggle failed:', err);
    } finally {
      setPushLoading(false);
    }
  }, [pushEnabled, pushLoading]);

  if (!principal) return null;

  const roleLabel =
    principal.role === 'teacher' ? t('roleTeacher') :
    principal.role === 'president' ? t('rolePresident') : t('roleStudent');

  const initial = (principal.user.firstName || 'U')[0].toUpperCase();

  return (
    <div className="page-container">
      <PageHeader
        title={t('account')}
        description={`${principal.user.firstName} ${principal.user.lastName} • ${roleLabel}`}
      />

      <div className="settings-section">
        {linkStatus === 'linked' && (
          <div className="settings-card" style={{ borderColor: 'var(--success)' }}>
            <div className="cluster gap-2 items-center" style={{ color: 'var(--success)' }} role="status">
              <Icon name="check" size={16} />
              <span className="text-sm">{t('discordLinked')}</span>
            </div>
          </div>
        )}
        {linkError && (
          <div className="settings-card" style={{ borderColor: 'var(--danger)' }}>
            <div className="cluster gap-2 items-center" style={{ color: 'var(--danger)' }} role="alert">
              <Icon name="alert" size={16} />
              <span className="text-sm">{t('discordLinkFailed')}</span>
            </div>
          </div>
        )}

        {/* Profile Card */}
        <div className="profile-card">
          <div className="profile-header">
            <div className="profile-avatar-mark">
              <span>{initial}</span>
            </div>
            <div>
              <div style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-lg)' }}>
                {principal.user.firstName} {principal.user.lastName}
              </div>
              <span className="badge badge-info" style={{ marginTop: '2px' }}>
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="profile-meta-rows">
            <div className="profile-row">
              <span className="profile-row-label">{t('firstName')}</span>
              <span className="profile-row-value">{principal.user.firstName}</span>
            </div>
            <div className="profile-row">
              <span className="profile-row-label">{t('lastName')}</span>
              <span className="profile-row-value">{principal.user.lastName}</span>
            </div>
            <div className="profile-row">
              <span className="profile-row-label">{t('studentId')}</span>
              <span className="profile-row-value">{principal.user.studentId || '—'}</span>
            </div>
            <div className="profile-row">
              <span className="profile-row-label">Discord ID</span>
              <span className="profile-row-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' }}>
                {principal.user.discordId || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Language Preferences */}
        <div className="settings-card">
          <div className="settings-card-header">
            <Icon name="language" size={18} className="text-muted" />
            <h2 className="card-title">{t('language')}</h2>
          </div>
          <div className="language-btn-group">
            <button
              type="button"
              className={`btn flex-1 ${lang === 'th' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setLang('th')}
            >
              ไทย (Thai)
            </button>
            <button
              type="button"
              className={`btn flex-1 ${lang === 'en' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setLang('en')}
            >
              English
            </button>
          </div>
        </div>

        {/* Discord Linking */}
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true">
              <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.02.06.03.09.02 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" />
            </svg>
            <h2 className="card-title">Discord</h2>
          </div>
          <div>
            {principal.user.discordId ? (
              <div className="cluster gap-2 items-center" style={{ color: 'var(--success)', fontSize: 'var(--fs-sm)' }}>
                <Icon name="check" size={16} />
                <span>{t('loginWithDiscord')} ({principal.user.discordId})</span>
              </div>
            ) : (
              <a href="/api/auth/discord?link=1" className="btn btn-outline">
                <Icon name="link" size={14} />
                <span>{t('loginWithDiscord')}</span>
              </a>
            )}
          </div>
        </div>

        {/* Push Notifications */}
        {pushSupported && (
          <div className="settings-card">
            <div className="settings-card-header">
              <Icon name="bell" size={18} className="text-muted" />
              <h2 className="card-title">{t('notifications')}</h2>
            </div>
            <div>
              <button
                type="button"
                className={`btn ${pushEnabled ? 'btn-outline' : 'btn-primary'}`}
                onClick={togglePush}
                disabled={pushLoading}
              >
                {pushLoading ? (
                  <div className="spinner" />
                ) : (
                  <>
                    <Icon name="bell" size={14} />
                    <span>{pushEnabled ? t('disableNotifications') : t('enableNotifications')}</span>
                  </>
                )}
              </button>
              <div className="text-sm text-muted mt-2">
                {pushEnabled ? t('notificationsEnabled') : t('notificationsDisabled')}
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <div style={{ paddingTop: 'var(--sp-2)' }}>
          <button
            type="button"
            className="btn btn-outline btn-danger w-full justify-center"
            onClick={logout}
          >
            <Icon name="logout" size={16} />
            <span>{t('logout')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
