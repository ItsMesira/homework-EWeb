// pages/CalendarPage.tsx — Calendar page (month grid desktop, agenda mobile)

import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useI18n } from '../i18n/I18nProvider';
import { PageHeader, Icon } from '../components/ui';
import './CalendarPage.css';

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

  // Check today
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

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
  const resetToToday = () => setCurrentMonth(new Date());

  return (
    <div className="page-container">
      <PageHeader
        title={t('calendar')}
        actions={
          <div className="calendar-nav">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={resetToToday}
            >
              {t('today')}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm btn-icon"
              onClick={prevMonth}
              title="Previous Month"
              aria-label="Previous Month"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <div className="calendar-month-label">
              {months[month]} {lang === 'th' ? beYear : year}
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm btn-icon"
              onClick={nextMonth}
              title="Next Month"
              aria-label="Next Month"
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : (
        <>
          {/* Desktop month grid */}
          <div className="calendar-grid-wrapper calendar-card">
            <table className="calendar-table">
              <thead>
                <tr>
                  {dayLabels.map((d) => (
                    <th key={d} className="calendar-th">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((day, di) => (
                      <td
                        key={di}
                        className={`calendar-td ${day === null ? 'is-empty' : ''}`}
                      >
                        {day !== null && (
                          <>
                            <div className={`calendar-day-number ${isCurrentMonth && day === todayDate ? 'is-today' : ''}`}>
                              {day}
                            </div>
                            <div className="calendar-events-container">
                              {eventsForDay(day).map((e) => (
                                <div
                                  key={e.id}
                                  className={`calendar-event-pill ${e.type === 'homework' ? 'homework' : 'announcement'} ${e.isOverdue ? 'is-overdue' : ''}`}
                                  title={e.title}
                                >
                                  <Icon
                                    name={e.type === 'homework' ? 'homework' : 'announcements'}
                                    size={11}
                                  />
                                  <span>{e.title}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile agenda view */}
          <div className="calendar-agenda">
            {events.length === 0 ? (
              <div className="card state-container" style={{ padding: 'var(--sp-8)' }}>
                <Icon name="calendar" size={36} className="text-muted" />
                <p className="text-muted text-sm">{t('noEvents')}</p>
              </div>
            ) : (
              events.map((e) => (
                <div key={`${e.type}-${e.id}`} className="agenda-item">
                  <Icon
                    name={e.type === 'homework' ? 'homework' : 'announcements'}
                    size={20}
                    className={e.type === 'homework' ? 'text-primary' : 'text-muted'}
                  />
                  <div className="agenda-item-main">
                    <div className="agenda-item-title">{e.title}</div>
                    <div className="agenda-item-date">{e.date}</div>
                  </div>
                  {e.isOverdue && (
                    <span className="badge badge-danger">{t('overdue')}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
