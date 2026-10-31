// pages/AnalyticsPage.tsx — Personal + class analytics

import { useState, useEffect } from 'react';
import { apiClient, Analytics, ClassAnalytics } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h1>{t('analytics')}</h1>
        {canViewClass && (
          <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
            <button className={`btn ${tab === 'personal' ? 'btn-primary' : 'btn-outline'}`} style={{ minHeight: '36px', fontSize: 'var(--fs-xs)' }} onClick={() => setTab('personal')}>
              {t('account')}
            </button>
            <button className={`btn ${tab === 'class' ? 'btn-primary' : 'btn-outline'}`} style={{ minHeight: '36px', fontSize: 'var(--fs-xs)' }} onClick={() => setTab('class')}>
              {t('classAnalytics')}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : tab === 'personal' && personal ? (
        <PersonalAnalytics data={personal} />
      ) : tab === 'class' && classData && canViewClass ? (
        <ClassAnalyticsView data={classData} />
      ) : (
        <div className="state-container">
          <div className="state-icon">📊</div>
          <p>{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}

function PersonalAnalytics({ data }: { data: Analytics }) {
  const { t } = useI18n();

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
        <div className="card">
          <div className="card-title">{t('completionRate')}</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', color: data.completionRate === 100 ? 'var(--success)' : data.completionRate >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
            {data.completionRate}%
          </div>
        </div>
        <div className="card">
          <div className="card-title">{t('completedCount')}</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--success)' }}>{data.doneCount}</div>
        </div>
        <div className="card">
          <div className="card-title">{t('pendingCount')}</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)' }}>{data.todoCount}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="card-title">{t('completionRate')}</div>
        <div style={{
          height: '12px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: 'rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${data.completionRate}%`,
            borderRadius: 'var(--radius-pill)',
            backgroundColor: data.completionRate === 100 ? 'var(--success)' : data.completionRate >= 50 ? 'var(--warning)' : 'var(--danger)',
            transition: 'width var(--transition)',
          }} />
        </div>
      </div>

      {/* Upcoming */}
      {data.upcoming.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <h3>{t('upcoming')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
            {data.upcoming.map((hw) => (
              <div key={hw.homeworkId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'var(--fw-medium)' }}>{hw.title}</div>
                  <div className="text-muted text-xs">{hw.subjectCode}</div>
                </div>
                <span className="badge badge-warning">{hw.dueDate}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subject stats */}
      {data.subjectStats.length > 0 && (
        <div className="card">
          <h3>{t('perSubject')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
            {data.subjectStats.map((s) => (
              <div key={s.subjectCode} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <div style={{ width: '80px', fontWeight: 'var(--fw-medium)' }}>{s.subjectCode}</div>
                <div style={{ flex: 1, height: '8px', borderRadius: 'var(--radius-pill)', backgroundColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.rate}%`, backgroundColor: 'var(--primary)' }} />
                </div>
                <div className="text-sm" style={{ minWidth: '60px', textAlign: 'right' }}>
                  {s.completed}/{s.total}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClassAnalyticsView({ data }: { data: ClassAnalytics }) {
  const { t } = useI18n();

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
        <div className="card">
          <div className="card-title">{t('homework')}</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)' }}>{data.totalHomework}</div>
        </div>
        <div className="card">
          <div className="card-title">{t('pending')}</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)' }}>{data.totalPending}</div>
        </div>
        <div className="card">
          <div className="card-title">{t('overdue')}</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--danger)' }}>{data.overdueCount}</div>
        </div>
        <div className="card">
          <div className="card-title">{t('roleStudent')}</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)' }}>{data.totalStudents}</div>
        </div>
      </div>

      {/* Export */}
      <div style={{ marginBottom: 'var(--sp-4)', display: 'flex', gap: 'var(--sp-2)' }}>
        <a href={apiClient.analytics.exportUrl('homework')} className="btn btn-ghost">{t('exportCSV')} — {t('homework')}</a>
        <a href={apiClient.analytics.exportUrl('students')} className="btn btn-ghost">{t('exportCSV')} — {t('perStudent')}</a>
      </div>

      {/* Per-student table */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 'var(--sp-3)' }}>{t('perStudent')}</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 'var(--sp-2)', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)' }}>{t('roleStudent')}</th>
              <th style={{ textAlign: 'right', padding: 'var(--sp-2)', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)' }}>{t('completedCount')}</th>
              <th style={{ textAlign: 'right', padding: 'var(--sp-2)', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)' }}>{t('completionRate')}</th>
            </tr>
          </thead>
          <tbody>
            {data.studentStats.map((s) => (
              <tr key={s.studentId}>
                <td style={{ padding: 'var(--sp-2)', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)' }}>{s.name}</td>
                <td style={{ padding: 'var(--sp-2)', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)', textAlign: 'right' }}>{s.completed}/{s.pending}</td>
                <td style={{ padding: 'var(--sp-2)', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)', textAlign: 'right' }}>
                  <span className={`badge ${s.rate === 100 ? 'badge-success' : s.rate >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                    {s.rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-subject */}
      <div className="card">
        <h3 style={{ marginBottom: 'var(--sp-3)' }}>{t('perSubject')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {data.subjectStats.map((s) => (
            <div key={s.subjectCode} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <div style={{ width: '80px', fontWeight: 'var(--fw-medium)' }}>{s.subjectCode}</div>
              <div style={{ flex: 1, height: '8px', borderRadius: 'var(--radius-pill)', backgroundColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${s.total > 0 ? (s.completed / s.total) * 100 : 0}%`, backgroundColor: 'var(--primary)' }} />
              </div>
              <div className="text-sm" style={{ minWidth: '60px', textAlign: 'right' }}>
                {s.completed}/{s.total}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
