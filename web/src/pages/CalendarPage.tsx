// pages/CalendarPage.tsx — Calendar page (month grid desktop, agenda mobile)

import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useI18n } from '../i18n/I18nProvider';

interface CalendarEvent {
  type: string;
  id: string;
  title: string;
  subjectCode?: string;
  date: string;
  datetime?: string;
  isOverdue?: boolean;
  completed?: boolean;
  isPinned?: boolean;
  priority?: string;
}

const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const DAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function CalendarPage() {
  const { t, lang } = useI18n();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01 00:00`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59`;

    apiClient.calendar.get(from, to)
      .then((res) => setEvents(res.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [currentMonth]);

  const months = lang === 'th' ? MONTHS_TH : MONTHS_EN;
  const dayLabels = lang === 'th' ? DAYS_TH : DAYS_EN;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const beYear = year + 543;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build calendar grid
  const weeks: (number | null)[][] = [];
  let dayCounter = 1;
  for (let w = 0; w < 6; w++) {
    const week: (number | null)[] = [];
    for (let d = 0; d < 7; d++) {
      if (w === 0 && d < firstDay) {
        week.push(null);
      } else if (dayCounter > daysInMonth) {
        week.push(null);
      } else {
        week.push(dayCounter);
        dayCounter++;
      }
    }
    weeks.push(week);
    if (dayCounter > daysInMonth) break;
  }

  const eventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.date === dateStr);
  };

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h1>{t('calendar')}</h1>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <button className="btn btn-outline" onClick={prevMonth} style={{ minHeight: '36px' }}>←</button>
          <div style={{ fontWeight: 'var(--fw-semibold)', minWidth: '180px', textAlign: 'center' }}>
            {months[month]} {lang === 'th' ? beYear : year}
          </div>
          <button className="btn btn-outline" onClick={nextMonth} style={{ minHeight: '36px' }}>→</button>
        </div>
      </div>

      {loading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : (
        <>
          {/* Desktop month grid */}
          <div className="calendar-grid card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {dayLabels.map((d) => (
                    <th key={d} style={{ padding: 'var(--sp-2)', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', color: 'var(--text-muted)', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((day, di) => (
                      <td key={di} style={{
                        padding: 'var(--sp-1)',
                        verticalAlign: 'top',
                        borderBottom: '1px solid var(--border)',
                        borderRight: di < 6 ? '1px solid var(--border)' : 'none',
                        height: '80px',
                        width: '14.28%',
                      }}>
                        {day && (
                          <>
                            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', color: 'var(--text-muted)', marginBottom: 'var(--sp-1)' }}>
                              {day}
                            </div>
                            {eventsForDay(day).map((e) => (
                              <div key={e.id} style={{
                                fontSize: 'var(--fs-xs)',
                                padding: '2px var(--sp-1)',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: e.type === 'homework'
                                  ? (e.isOverdue ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)')
                                  : 'rgba(255,177,16,0.08)',
                                color: e.type === 'homework'
                                  ? (e.isOverdue ? 'var(--danger)' : 'var(--info)')
                                  : 'var(--warning)',
                                marginBottom: '2px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {e.type === 'homework' ? '📝' : '📢'} {e.title}
                              </div>
                            ))}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile agenda */}
          <div className="calendar-agenda">
            {events.length === 0 ? (
              <div className="state-container">
                <div className="state-icon">📅</div>
                <p>{t('noEvents')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                {events.map((e) => (
                  <div key={`${e.type}-${e.id}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                    <div style={{ fontSize: '24px' }}>{e.type === 'homework' ? '📝' : '📢'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'var(--fw-medium)' }}>{e.title}</div>
                      <div className="text-muted text-xs">{e.date}</div>
                    </div>
                    {e.isOverdue && <span className="badge badge-danger">{t('overdue')}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <style>{`
            @media (max-width: 768px) {
              .calendar-grid { display: none !important; }
            }
            @media (min-width: 769px) {
              .calendar-agenda { display: none !important; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
