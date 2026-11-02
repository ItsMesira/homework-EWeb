// pages/AnalyticsPage.tsx — Personal + class analytics

import { useState, useEffect } from 'react';
import { apiClient, Analytics, ClassAnalytics } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { PageHeader, Icon } from '../components/ui';
import './AnalyticsPage.css';

export function AnalyticsPage() {
  const { principal } = useAuth();
  const { t } = useI18n();
  const canViewClass = principal?.role === 'president' || principal?.role === 'teacher';

  const [tab, setTab] = useState<'personal' | 'class'>(canViewClass ? 'class' : 'personal');
  const [personal, setPersonal] = useState<Analytics | null>(null);
  const [classData, setClassData] = useState<ClassAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === 'personal') {
      apiClient.analytics.me()
        .then(setPersonal)
        .catch(() => setPersonal(null))
        .finally(() => setLoading(false));
    } else if (canViewClass) {
      apiClient.analytics.class()
        .then(setClassData)
        .catch(() => setClassData(null))
        .finally(() => setLoading(false));
    }
  }, [tab, canViewClass]);

  return (
    <div className="page-container">
      <PageHeader
        title={t('analytics')}
        actions={
          canViewClass ? (
            <div className="tabs analytics-tabs">
              <button
                type="button"
                className={`tab ${tab === 'personal' ? 'active' : ''}`}
                onClick={() => setTab('personal')}
              >
                <Icon name="user" size={14} />
                <span>{t('account')}</span>
              </button>
              <button
                type="button"
                className={`tab ${tab === 'class' ? 'active' : ''}`}
                onClick={() => setTab('class')}
              >
                <Icon name="users" size={14} />
                <span>{t('classAnalytics')}</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {loading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : tab === 'personal' && personal ? (
        <PersonalAnalytics data={personal} />
      ) : tab === 'class' && classData && canViewClass ? (
        <ClassAnalyticsView data={classData} />
      ) : (
        <div className="card state-container" style={{ padding: 'var(--sp-8)' }}>
          <Icon name="analytics" size={36} className="text-muted" />
          <p className="text-muted text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}

function PersonalAnalytics({ data }: { data: Analytics }) {
  const { t } = useI18n();

  const rateColor =
    data.completionRate === 100 ? 'var(--success)' :
    data.completionRate >= 50 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="stack gap-6">
      {/* Summary cards */}
      <div className="analytics-grid">
        <div className="card stat-card">
          <div className="stat-label">{t('completionRate')}</div>
          <div className="stat-value" style={{ color: rateColor }}>
            {data.completionRate}%
          </div>
          <div className="analytics-progress-wrapper">
            <div
              className="analytics-progress-fill"
              style={{
                width: `${data.completionRate}%`,
                backgroundColor: rateColor,
              }}
            />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">{t('completedCount')}</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {data.doneCount}
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">{t('pendingCount')}</div>
          <div className="stat-value" style={{ color: data.todoCount > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
            {data.todoCount}
          </div>
        </div>
      </div>

      {/* Upcoming deadlines */}
      {data.upcoming.length > 0 && (
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">{t('upcoming')}</h2>
          </div>
          <div className="card-content">
            <div className="stack gap-2">
              {data.upcoming.map((hw) => (
                <div key={hw.homeworkId} className="cluster justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-sm)' }}>{hw.title}</div>
                    <div className="text-muted text-xs">{hw.subjectCode}</div>
                  </div>
                  <span className="badge badge-warning">{hw.dueDate}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Subject stats */}
      {data.subjectStats.length > 0 && (
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">{t('perSubject')}</h2>
          </div>
          <div className="card-content">
            <div className="stack gap-1">
              {data.subjectStats.map((s) => (
                <div key={s.subjectCode} className="subject-rate-row">
                  <span className="subject-rate-code">{s.subjectCode}</span>
                  <div className="subject-rate-bar">
                    <div
                      className="subject-rate-fill"
                      style={{ width: `${s.rate}%` }}
                    />
                  </div>
                  <span className="subject-rate-count">
                    {s.completed}/{s.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ClassAnalyticsView({ data }: { data: ClassAnalytics }) {
  const { t } = useI18n();

  return (
    <div className="stack gap-6">
      {/* Summary */}
      <div className="analytics-grid">
        <div className="card stat-card">
          <div className="stat-label">{t('homework')}</div>
          <div className="stat-value">{data.totalHomework}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">{t('pending')}</div>
          <div className="stat-value">{data.totalPending}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">{t('overdue')}</div>
          <div className="stat-value" style={{ color: data.overdueCount > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
            {data.overdueCount}
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">{t('roleStudent')}</div>
          <div className="stat-value">{data.totalStudents}</div>
        </div>
      </div>

      {/* CSV Export Bar */}
      <div className="analytics-export-bar">
        <a
          href={apiClient.analytics.exportUrl('homework')}
          className="btn btn-outline btn-sm"
        >
          <Icon name="download" size={14} />
          <span>{t('exportCSV')} — {t('homework')}</span>
        </a>
        <a
          href={apiClient.analytics.exportUrl('students')}
          className="btn btn-outline btn-sm"
        >
          <Icon name="download" size={14} />
          <span>{t('exportCSV')} — {t('perStudent')}</span>
        </a>
      </div>

      {/* Per-student table */}
      <section className="card analytics-table-wrapper">
        <div style={{ padding: 'var(--sp-4) var(--sp-4) var(--sp-2)' }}>
          <h2 className="card-title">{t('perStudent')}</h2>
        </div>
        <table className="analytics-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>{t('roleStudent')}</th>
              <th style={{ textAlign: 'right' }}>{t('completedCount')}</th>
              <th style={{ textAlign: 'right' }}>{t('completionRate')}</th>
            </tr>
          </thead>
          <tbody>
            {data.studentStats.map((s) => (
              <tr key={s.studentId}>
                <td>
                  <span style={{ fontWeight: 'var(--fw-medium)' }}>{s.name}</span>
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {s.completed}/{s.pending}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className={`badge ${s.rate === 100 ? 'badge-success' : s.rate >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                    {s.rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Per-subject breakdown */}
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">{t('perSubject')}</h2>
        </div>
        <div className="card-content">
          <div className="stack gap-1">
            {data.subjectStats.map((s) => {
              const rate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
              return (
                <div key={s.subjectCode} className="subject-rate-row">
                  <span className="subject-rate-code">{s.subjectCode}</span>
                  <div className="subject-rate-bar">
                    <div
                      className="subject-rate-fill"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <span className="subject-rate-count">
                    {s.completed}/{s.total} ({rate}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
