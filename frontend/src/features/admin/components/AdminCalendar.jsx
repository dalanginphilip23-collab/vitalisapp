import { useState } from 'react';
import Icon from '../../../components/Icon.jsx';
import { localDayKey } from '../utils/time.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const sameDay = (a, b) => (
  a && b
  && a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate()
);

const monthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

/**
 * Month calendar for the dashboard rail. Selection is controlled by the page
 * so the adjacent activity feed can show the real audit rows for that day.
 * `eventsByDay` is a Map of local YYYY-MM-DD → admin action count.
 */
export default function AdminCalendar({ selectedDate = null, onSelectDate, eventsByDay = new Map() }) {
  const today = new Date();
  const [view, setView] = useState(() => monthStart(selectedDate || today));

  const monthLabel = `${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
  const firstWeekday = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;

  const cells = Array.from({ length: 42 }, (_, index) => {
    const offset = index - firstWeekday;
    const date = new Date(view.getFullYear(), view.getMonth(), 1 + offset);
    date.setHours(0, 0, 0, 0);
    return date;
  });

  const monthActivityDays = cells.reduce((count, date) => {
    if (date.getMonth() !== view.getMonth()) return count;
    return count + (eventsByDay.has(localDayKey(date)) ? 1 : 0);
  }, 0);

  const goToday = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setView(monthStart(now));
    onSelectDate?.(now);
  };

  const shiftMonth = (amount) => {
    setView((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const footerDate = selectedDate || today;
  const selectedCount = selectedDate ? (eventsByDay.get(localDayKey(selectedDate)) || 0) : 0;

  return (
    <div className="adm-cal">
      <div className="adm-cal__head">
        <span className="adm-cal__month">{monthLabel}</span>
        <div className="adm-cal__nav">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <Icon name="chevron_left" />
          </button>
          <button type="button" className="is-today" onClick={goToday}>Today</button>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
            <Icon name="chevron_right" />
          </button>
        </div>
      </div>

      <div className="adm-cal__grid" role="group" aria-label={`${monthLabel} calendar`}>
        {DOW.map((label, index) => (
          <span key={`${label}-${index}`} className="adm-cal__dow" aria-hidden="true">{label}</span>
        ))}
        {cells.map((date) => {
          const key = localDayKey(date);
          const isOut = date.getMonth() !== view.getMonth();
          const isToday = sameDay(date, today);
          const isSelected = sameDay(date, selectedDate);
          const count = eventsByDay.get(key) || 0;
          const label = date.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          });

          return (
            <button
              key={key}
              type="button"
              className={[
                'adm-cal__day',
                isOut ? 'is-out' : '',
                isToday ? 'is-today' : '',
                isSelected ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                const next = new Date(date);
                next.setHours(0, 0, 0, 0);
                onSelectDate?.(next);
                if (isOut) setView(monthStart(next));
              }}
              aria-label={`${label}${count ? `, ${count} admin action${count === 1 ? '' : 's'}` : ''}`}
              aria-pressed={isSelected}
            >
              {date.getDate()}
              {count > 0 && <span className="adm-cal__dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="adm-cal__foot">
        <span>
          <b>{footerDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</b>
          {selectedDate ? ` · ${selectedCount} action${selectedCount === 1 ? '' : 's'}` : ' · today'}
        </span>
        <span>{monthActivityDays} active day{monthActivityDays === 1 ? '' : 's'}</span>
      </div>
    </div>
  );
}
