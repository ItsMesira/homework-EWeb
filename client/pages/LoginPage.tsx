// pages/LoginPage.tsx — Login page

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { BrandMark, Icon } from '../components/ui';
import './LoginPage.css';

export function LoginPage() {
  const { refresh } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  // Surface OAuth failures redirected back by the server (?login_error=...)
  const [error, setError] = useState(() => {
    const code = new URLSearchParams(location.search).get('login_error');
    if (!code) return '';
    if (code === 'discord_not_linked') return t('discordNotLinked');
    if (code === 'login_required') return t('loginRequired');
    return t('oauthError');
  });
  const [loading, setLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiClient.auth.login(studentId.trim(), password);
      await refresh();
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || t('loginError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Header / Brand */}
        <header className="login-header">
          <BrandMark size={44} />
          <div>
            <h1 className="login-title">{t('appName')}</h1>
            <p className="login-subtitle">{t('appSubtitle')}</p>
          </div>
        </header>

        {/* Login Card */}
        <div className="card login-card">
          <form onSubmit={handleLogin} className="login-form">
            <div className="field">
              <label htmlFor="login-studentId">{t('studentId')}</label>
              <input
                id="login-studentId"
                className="input"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder={t('studentId')}
                required
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="login-password">{t('password')}</label>
              <input
                id="login-password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('password')}
                required
              />
            </div>

            {error && (
              <div className="field-error" role="alert">
                <Icon name="alert" size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              className="btn btn-primary w-full"
              type="submit"
              disabled={loading}
            >
              {loading ? <div className="spinner" /> : t('login')}
            </button>
          </form>

          {/* Divider */}
          <div className="login-divider">
            <span>OR</span>
          </div>

          {/* Discord login */}
          <a
            href={apiClient.auth.discordUrl}
            className="btn btn-outline login-discord-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true">
              <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.02.06.03.09.02 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" />
            </svg>
            <span>{t('loginWithDiscord')}</span>
          </a>
        </div>

        {/* Language toggle */}
        <footer className="login-footer">
          <button
            type="button"
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            className="btn btn-ghost btn-sm"
          >
            <Icon name="language" size={14} />
            <span>{lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
