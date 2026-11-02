// pages/DashboardPage.tsx — Overview page

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, Homework, Announcement, Analytics, ClassInfo } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { PageHeader, Icon } from '../components/ui';
import './DashboardPage.css';

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
      setHomework((hwRes.homework || []).filter((h: Homework) => !!h.homeworkId && !!h.title && h.title.trim() !== ''));
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

  const roleLabel =
    principal?.role === 'teacher' ? t('roleTeacher') :
    principal?.role === 'president' ? t('rolePresident') : t('roleStudent');

  // `todoCount` is the number of not-yet-completed items; `pendingCount` from
  // the API includes completed ones, so it would double-count with doneCount.
  const pendingCount = analytics?.todoCount ?? homework.filter((hw) => !hw.completed).length;
  const doneCount = analytics?.doneCount ?? 0;
  const completionRate = analytics?.completionRate ?? (
    (pendingCount + doneCount > 0)
      ? Math.round((doneCount / (pendingCount + doneCount)) * 100)
      : 0
  );

  return (
    <div className="page-container">
      {/* Notion-style Page Header */}
      <PageHeader
        title={`${t('welcome')}, ${principal?.user.firstName || ''}!`}
        description={
          classInfo ? (
            <span className="cluster gap-2">
              <span>{classInfo.className}</span>
              <span>•</span>
              <span className="badge badge-muted">{roleLabel}</span>
            </span>
          ) : undefined
        }
        actions={
          <div className="cluster gap-2">
            <Link to="/homework" className="btn btn-primary btn-sm">
              <Icon name="plus" size={14} />
              <span>{t('homework')}</span>
            </Link>
            <Link to="/calendar" className="btn btn-outline btn-sm">
              <Icon name="calendar" size={14} />
              <span>{t('calendar')}</span>
            </Link>
          </div>
        }
      />

      {/* Notion-style Stats Cards */}
      <div className="dashboard-grid">
        <div className="card stat-card">
          <div className="stat-label">{t('pendingCount')}</div>
          <div className="stat-value" style={{ color: pendingCount > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
            {pendingCount}
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">{t('completedCount')}</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {doneCount}
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">{t('completionRate')}</div>
          <div className="stat-value">
            {completionRate}%
          </div>
          <div className="stat-progress-bar">
            <div
              className="stat-progress-fill"
              style={{
                width: `${completionRate}%`,
                backgroundColor: completionRate >= 80 ? 'var(--success)' : completionRate >= 50 ? 'var(--primary)' : 'var(--warning)',
              }}
            />
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        {/* Upcoming Homework */}
        <section className="card">
          <div className="card-header">
            <div className="cluster gap-2">
              <Icon name="homework" size={18} className="text-muted" />
              <h2 className="card-title">{t('upcoming')}</h2>
            </div>
            <Link to="/homework" className="btn btn-ghost btn-sm">
              <span>{t('homework')}</span>
              <Icon name="arrowRight" size={14} />
            </Link>
          </div>

          <div className="card-content">
            {upcoming.length === 0 ? (
              <div className="state-container">
                <Icon name="check" size={28} className="text-muted" />
                <p className="text-muted text-sm">{t('noHomework')}</p>
              </div>
            ) : (
              <div className="task-list">
                {upcoming.map((hw) => (
                  <Link
                    key={hw.homeworkId}
                    to="/homework"
                    className={`task-item ${hw.isOverdue ? 'is-overdue' : ''}`}
                  >
                    <div className="task-item-main">
                      <div className="task-item-title-row">
                        <span className="badge badge-info">{hw.subjectCode}</span>
                        <span className="task-item-title">{hw.title}</span>
                      </div>
                      <div className="task-item-meta">
                        <Icon name="clock" size={12} />
                        <span>{hw.dueDate}</span>
                      </div>
                    </div>

                    <span className={`badge ${hw.isOverdue ? 'badge-danger' : 'badge-warning'}`}>
                      {hw.isOverdue ? t('overdue') : t('pending')}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Pinned Announcements */}
        {pinnedAnnouncements.length > 0 && (
          <section className="card">
            <div className="card-header">
              <div className="cluster gap-2">
                <Icon name="announcements" size={18} className="text-muted" />
                <h2 className="card-title">{t('announcements')}</h2>
              </div>
              <Link to="/announcements" className="btn btn-ghost btn-sm">
                <span>{t('announcements')}</span>
                <Icon name="arrowRight" size={14} />
              </Link>
            </div>

            <div className="card-content">
              <div className="task-list">
                {pinnedAnnouncements.map((ann) => (
                  <div key={ann.announcementId} className="announcement-item">
                    <div className="announcement-title-row">
                      <Icon name="pin" size={14} style={{ color: 'var(--accent-amber)' }} />
                      <span>{ann.title}</span>
                    </div>
                    {ann.body && (
                      <p className="announcement-body">
                        {ann.body.slice(0, 140)}{ann.body.length > 140 ? '…' : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
