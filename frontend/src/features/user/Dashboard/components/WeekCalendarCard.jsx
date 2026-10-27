// WeekCalendarCard — the dashboard's week date-switcher.
// Monday–Sunday of the CURRENT week. Clicking a past day (or today) switches
// the WHOLE dashboard to that day's logged data; future days are disabled.
// Markers show what was logged: workout (accent) / meals (warm) / check-in (cool).
// Data: GET /api/dashboard/week-calendar (req.user scoped).
import { useEffect, useRef, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import { apiGet } from '../../../../lib/apiClient.js';
import { localTodayIso } from '../lib/dashboardFormat.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const parseISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const monthShort = (iso) => parseISO(iso).toLocaleDateString('en-US', { month: 'short' });

const rangeLabel = (start, end) => (
  monthShort(start) === monthShort(end)
    ? `${monthShort(start)} ${Number(start.slice(8))} – ${Number(end.slice(8))}`
    : `${monthShort(start)} ${Number(start.slice(8))} – ${monthShort(end)} ${Number(end.slice(8))}`
);

const fullDateLabel = (iso) => parseISO(iso).toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
});

const dayNumber = (iso) => Number(iso.slice(8, 10));

export default function WeekCalendarCard({
  refreshKey = 0,
  selectedDate = null,
  onSelectDate = undefined,
}) {
  const [week, setWeek] = useState(null);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);

  const load = () => {
    apiGet(`/api/dashboard/week-calendar?today=${localTodayIso()}`)
      .then((d) => {
        if (!alive.current) return;
        setWeek(d);
        setFailed(false);
      })
      .catch(() => { if (alive.current) setFailed(true); });
  };

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [refreshKey]);

  const days = week?.days || [];
  const hasAny = days.some((d) => d.workouts.sessions > 0 || d.meals.count > 0 || d.checkin);
  const viewingPast = Boolean(selectedDate);

  return (
    <section className="vd-card vd-weekly-card vd-cal-card">
      <div className="vd-card-head">
        <div>
          <h2 className="vd-card-title">Your Week</h2>
          <p className="vd-card-sub">
            {week ? `${rangeLabel(week.weekStart, week.weekEnd)} · Mon–Sun` : 'This week at a glance'}
          </p>
        </div>
        {week && (
          <span className="vd-chip vd-chip--accent">
            {week.totals.minutes} min
          </span>
        )}
      </div>

      {failed && (
        <div className="vd-cal-error" role="status">
          <Icon name="cloud_off" />
          <span>Couldn&apos;t load this week.</span>
          <button type="button" onClick={load}>Retry</button>
        </div>
      )}

      {!failed && (
        <>
          <div className="vd-cal-strip" role="group" aria-label="This week">
            {week
              ? days.map((d, i) => {
                const markers = [];
                if (d.workouts.sessions > 0) markers.push('workout');
                if (d.meals.count > 0) markers.push('meals');
                if (d.checkin) markers.push('check-in');
                const selected = selectedDate ? d.date === selectedDate : d.isToday;
                return (
                  <button
                    key={d.date}
                    type="button"
                    className={`vd-cal-day${d.isToday ? ' is-today' : ''}${d.isFuture ? ' is-future' : ''}${selected ? ' is-selected' : ''}`}
                    disabled={d.isFuture}
                    aria-pressed={selected}
                    aria-label={`${fullDateLabel(d.date)} · ${d.isFuture
                      ? 'not available yet'
                      : `view dashboard${markers.length ? ` (${markers.join(', ')})` : ''}`}`}
                    onClick={() => onSelectDate?.(d.isToday ? null : d.date)}
                  >
                    <span className="vd-cal-dow">{WEEKDAYS[i]}</span>
                    <span className="vd-cal-num">{dayNumber(d.date)}</span>
                    <span className="vd-cal-dots" aria-hidden="true">
                      <span className={`vd-cal-dot${markers.includes('workout') ? ' is-workout' : ''}`} />
                      <span className={`vd-cal-dot${markers.includes('meals') ? ' is-meals' : ''}`} />
                      <span className={`vd-cal-dot${markers.includes('check-in') ? ' is-checkin' : ''}`} />
                    </span>
                  </button>
                );
              })
              : WEEKDAYS.map((label) => (
                <span key={label} className="vd-cal-day vd-cal-day--ghost" aria-hidden="true">
                  <span className="vd-cal-dow">{label}</span>
                  <span className="vd-cal-num">–</span>
                  <span className="vd-cal-dots" />
                </span>
              ))}
          </div>

          <div className="vd-cal-foot">
            <span className="vd-cal-hint">
              <Icon name={viewingPast ? 'history' : 'touch_app'} />
              {' '}
              {viewingPast
                ? 'Showing a past day'
                : hasAny ? 'Tap a day to review it' : 'Tap a day to review · future days locked'}
            </span>
            {viewingPast ? (
              <button type="button" className="vd-cal-reset" onClick={() => onSelectDate?.(null)}>
                Back to today
              </button>
            ) : (
              <span className="vd-cal-legend" aria-hidden="true">
                <span className="vd-cal-legend-item"><i className="vd-cal-dot is-workout" /> Workout</span>
                <span className="vd-cal-legend-item"><i className="vd-cal-dot is-meals" /> Meals</span>
                <span className="vd-cal-legend-item"><i className="vd-cal-dot is-checkin" /> Check-in</span>
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
