// pages/TimetablePage.tsx — Weekly timetable grid (desktop) / day tabs (mobile)

import { useState, useEffect } from 'react';
import { apiClient, TimetableCell } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';

const DAYS = [1, 2, 3, 4, 5];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const DAY_KEYS = ['day1', 'day2', 'day3', 'day4', 'day5'] as const;

export function TimetablePage() {
  const { principal } = useAuth();
  const { t } = useI18n();
  const canManage = principal?.role === 'president' || principal?.role === 'teacher';

  const [grid, setGrid] = useState<Record<number, Record<number, TimetableCell>>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(1);

  useEffect(() => {
    apiClient.timetable.get()
      .then((res) => { setGrid(res.grid || {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="page-container"><div className="state-container"><div className="spinner" /></div></div>;
  }

  const getCellLabel = (cell: TimetableCell) => {
    if (!cell || cell.cellType === 'free') return t('free');
    if (cell.cellType === 'subject') return cell.subjectCode || '-';
    return cell.label || cell.cellType;
  };

  const getCellStyle = (cell: TimetableCell) => {
    if (!cell || cell.cellType === 'free') {
      return { color: 'var(--text-muted)', backgroundColor: 'transparent' };
    }
    if (cell.cellType === 'subject') {
      return { color: 'var(--primary)', backgroundColor: 'var(--ghost-bg)' };
    }
    return { color: 'var(--text-secondary)', backgroundColor: 'rgba(0,0,0,0.04)' };
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h1>{t('timetable')}</h1>
        {canManage && (
          <button className="btn btn-ghost" disabled>
            📷 {t('importFromImage')}
          </button>
        )}
      </div>

      {/* Desktop grid */}
      <div className="timetable-desktop card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
          <thead>
            <tr>
              <th style={{ padding: 'var(--sp-2)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', width: '60px' }}>
                {t('period')}
              </th>
              {DAYS.map((day) => (
                <th key={day} style={{ padding: 'var(--sp-2)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                  {t(DAY_KEYS[day - 1])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period}>
                <td style={{ padding: 'var(--sp-2)', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', textAlign: 'center', borderBottom: '1px solid var(--border)', fontWeight: 'var(--fw-medium)' }}>
                  {period}
                </td>
                {DAYS.map((day) => {
                  const cell = grid[day]?.[period];
                  return (
                    <td key={day} style={{
                      padding: 'var(--sp-2)',
                      borderBottom: '1px solid var(--border)',
                      borderRight: day < 5 ? '1px solid var(--border)' : 'none',
                      textAlign: 'center',
                      fontSize: 'var(--fs-sm)',
                      ...getCellStyle(cell),
                    }}>
                      {getCellLabel(cell)}
                      {cell?.instructor && (
                        <div className="text-xs" style={{ opacity: 0.7 }}>{cell.instructor}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile day tabs */}
      <div className="timetable-mobile">
        {/* Day selector */}
        <div style={{ display: 'flex', gap: 'var(--sp-1)', marginBottom: 'var(--sp-3)', overflowX: 'auto' }}>
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`btn ${selectedDay === day ? 'btn-primary' : 'btn-outline'}`}
              style={{ minHeight: '36px', fontSize: 'var(--fs-xs)', flex: 1 }}
            >
              {t(DAY_KEYS[day - 1])}
            </button>
          ))}
        </div>

        {/* Period cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {PERIODS.map((period) => {
            const cell = grid[selectedDay]?.[period];
            return (
              <div key={period} className="card" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                padding: 'var(--sp-3)',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'var(--ghost-bg)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'var(--fw-bold)',
                  fontSize: 'var(--fs-sm)',
                  flexShrink: 0,
                }}>
                  {period}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'var(--fw-medium)', ...getCellStyle(cell) }}>
                    {getCellLabel(cell)}
                  </div>
                  {cell?.instructor && (
                    <div className="text-muted text-xs">{cell.instructor}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .timetable-desktop { display: none !important; }
        }
        @media (min-width: 769px) {
          .timetable-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
