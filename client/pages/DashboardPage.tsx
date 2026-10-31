// pages/DashboardPage.tsx — Overview page

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, Homework, Announcement, Analytics, ClassInfo } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';

export function DashboardPage() {
  const { principal } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.homework.list({ status: 'pending' }).catch(() => ({ homework: [] })),
      apiClient.announcements.list().catch(() => ({ announcements: [] })),
      apiClient.analytics.me().catch(() => null),
      apiClient.meta.class().catch(() => null),
    ]).then(([hwRes, annRes, analyticsData, classData]) => {
      setHomework(hwRes.homework || []);
      setAnnouncements(annRes.announcements || []);
      setAnalytics(analyticsData);
      setClassInfo(classData);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="state-container">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const upcoming = homework.slice(0, 5);
  const pinnedAnnouncements = announcements.filter((a) => a.isPinned).slice(0, 3);

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <h1>{t('welcome')}, {principal?.user.firstName}!</h1>
        {classInfo && (
          <p className="text-muted text-sm mt-2">
            {classInfo.className} • {t('roleStudent')}/{t('rolePresident')}/{t('roleTeacher')}
            {' '}- {principal?.role === 'teacher' ? t('roleTeacher') :
                   principal?.role === 'president' ? t('rolePresident') : t('roleStudent')}
          </p>
        )}
      </div>

      {/* Stats cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--sp-3)',
        marginBottom: 'var(--sp-6)',
      }}>
        <div className="card">
          <div className="card-title">{t('pendingCount')}</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)' }}>
            {analytics?.pendingCount ?? homework.length}
          </div>
        </div>
        <div className="card">
          <div className="card-title">{t('completedCount')}</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--success)' }}>
            {analytics?.doneCount ?? 0}
          </div>
        </div>
        <div className="card">
          <div className="card-title">{t('completionRate')}</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)' }}>
            {analytics?.completionRate ?? 0}%
          </div>
        </div>
      </div>

      {/* Upcoming homework */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
          <h3>{t('upcoming')}</h3>
          <Link to="/homework" className="text-sm">{t('homework')} →</Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="text-muted text-center" style={{ padding: 'var(--sp-4)' }}>
            {t('noHomework')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {upcoming.map((hw) => (
              <div
                key={hw.homeworkId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--sp-2) var(--sp-3)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: hw.isOverdue ? 'rgba(239,68,68,0.04)' : 'transparent',
                }}
              >
                <div>
                  <div style={{ fontWeight: 'var(--fw-medium)' }}>{hw.title}</div>
                  <div className="text-muted text-xs">
                    {hw.subjectCode} • {hw.dueDate}
                  </div>
                </div>
                <span className={`badge ${hw.isOverdue ? 'badge-danger' : 'badge-warning'}`}>
                  {hw.isOverdue ? t('overdue') : hw.dueDate}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pinned announcements */}
      {pinnedAnnouncements.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
            <h3>📢 {t('announcements')}</h3>
            <Link to="/announcements" className="text-sm">{t('announcements')} →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {pinnedAnnouncements.map((ann) => (
              <div key={ann.announcementId} style={{ padding: 'var(--sp-2) var(--sp-3)', borderLeft: '3px solid var(--primary)' }}>
                <div style={{ fontWeight: 'var(--fw-medium)' }}>
                  {ann.isPinned && '📌 '}{ann.title}
                </div>
                {ann.body && <div className="text-muted text-sm">{ann.body.slice(0, 100)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
