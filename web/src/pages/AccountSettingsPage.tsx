// pages/AccountSettingsPage.tsx — Account settings

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { apiClient } from '../api/client';

export function AccountSettingsPage() {
  const { principal, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    setPushSupported('serviceWorker' in navigator && 'PushManager' in window);
    // Check if already subscribed
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
        // Unsubscribe
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await apiClient.push.unsubscribe(sub.endpoint);
          await sub.unsubscribe();
        }
        setPushEnabled(false);
      } else {
        // Subscribe
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

  const roleLabel = principal.role === 'teacher' ? t('roleTeacher') :
                    principal.role === 'president' ? t('rolePresident') : t('roleStudent');

  return (
    <div className="page-container">
      <h1 style={{ marginBottom: 'var(--sp-4)' }}>{t('account')}</h1>

      {/* Profile */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <h3 style={{ marginBottom: 'var(--sp-3)' }}>{t('account')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">{t('firstName')}</span>
            <span style={{ fontWeight: 'var(--fw-medium)' }}>{principal.user.firstName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">{t('lastName')}</span>
            <span style={{ fontWeight: 'var(--fw-medium)' }}>{principal.user.lastName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">{t('studentId')}</span>
            <span style={{ fontWeight: 'var(--fw-medium)' }}>{principal.user.studentId || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">Discord ID</span>
            <span style={{ fontWeight: 'var(--fw-medium)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>
              {principal.user.discordId || '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">{t('roleStudent')}/{t('rolePresident')}/{t('roleTeacher')}</span>
            <span className="badge badge-info">{roleLabel}</span>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <h3 style={{ marginBottom: 'var(--sp-3)' }}>{t('language')}</h3>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button
            className={`btn ${lang === 'th' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setLang('th')}
          >
            {t('thai')}
          </button>
          <button
            className={`btn ${lang === 'en' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setLang('en')}
          >
            {t('english')}
          </button>
        </div>
      </div>

      {/* Discord linking */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <h3 style={{ marginBottom: 'var(--sp-3)' }}>Discord</h3>
        {principal.user.discordId ? (
          <div className="text-sm" style={{ color: 'var(--success)' }}>
            ✅ {t('loginWithDiscord')}
          </div>
        ) : (
          <a href="/api/auth/discord?link=1" className="btn btn-ghost">
            {t('loginWithDiscord')}
          </a>
        )}
      </div>

      {/* Push notifications */}
      {pushSupported && (
        <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <h3 style={{ marginBottom: 'var(--sp-3)' }}>{t('notifications')}</h3>
          <button
            className={`btn ${pushEnabled ? 'btn-outline' : 'btn-primary'}`}
            onClick={togglePush}
            disabled={pushLoading}
            style={{ width: '100%' }}
          >
            {pushLoading ? '…' : pushEnabled ? t('disableNotifications') : t('enableNotifications')}
          </button>
          <div className="text-sm" style={{ marginTop: 'var(--sp-2)', color: 'var(--text-muted)' }}>
            {pushEnabled ? t('notificationsEnabled') : t('notificationsDisabled')}
          </div>
        </div>
      )}

      {/* Logout */}
      <button className="btn btn-danger" style={{ width: '100%' }} onClick={logout}>
        {t('logout')}
      </button>
    </div>
  );
}
