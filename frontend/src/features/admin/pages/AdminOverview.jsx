import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../components/Icon.jsx';
import { useAuth } from '../../../hooks/useAuth.jsx';
import { useAdminResource } from '../hooks/useAdminResource.js';
import {
  Badge, Kpi, PageHero, Panel, StateBlock,
} from '../components/AdminBits.jsx';
import AdminUsageChart from '../components/AdminUsageChart.jsx';
import AdminCalendar from '../components/AdminCalendar.jsx';
import { buildUsageSeries } from '../utils/usage.js';
import { metaForAction } from '../utils/actionMeta.js';
import { fmtAgo, localDayKey } from '../utils/time.js';
import { fmtNum } from '../utils/format.js';

const OVERVIEW_PATH = '/api/admin/overview';
const WINDOWS = [7, 14, 30];
const EMPTY_RECORDS = [];

const percent = (part, whole) => (whole ? Math.round((Number(part) / Number(whole)) * 100) : 0);
const perMember = (part, whole) => (whole ? Math.round(Number(part) / Number(whole)) : 0);

const buildCategories = (data) => {
  const { users: u, workouts: w, meals: f, plans: p, content: c } = data;
  return [
    {
      key: 'members',
      label: 'Members',
      icon: 'group',
      metrics: [
        { label: 'Active accounts', value: u.active, icon: 'how_to_reg' },
        { label: 'Deactivated', value: u.deactivated, icon: 'person_off' },
        { label: 'Admin accounts', value: u.admins, icon: 'shield_person' },
        { label: 'New in 30 days', value: u.newLast30d, icon: 'person_add' },
      ],
    },
    {
      key: 'training',
      label: 'Training',
      icon: 'exercise',
      metrics: [
        { label: 'Workouts logged', value: w.total, icon: 'fitness_center' },
        { label: 'Last 7 days', value: w.last7d, icon: 'bolt' },
        { label: 'Completed', value: w.completed, icon: 'task_alt' },
        { label: 'Completion rate', value: percent(w.completed, w.total), suffix: '%', icon: 'donut_large' },
      ],
    },
    {
      key: 'nutrition',
      label: 'Nutrition',
      icon: 'restaurant',
      metrics: [
        { label: 'Meals logged', value: f.total, icon: 'restaurant_menu' },
        { label: 'Last 7 days', value: f.last7d, icon: 'calendar_today' },
        { label: 'Meals / member', value: perMember(f.total, u.active), icon: 'functions' },
        { label: 'Meals / member (7d)', value: perMember(f.last7d, u.active), icon: 'today' },
      ],
    },
    {
      key: 'content',
      label: 'Content',
      icon: 'auto_stories',
      metrics: [
        { label: 'Catalog plans', value: p.catalog, icon: 'menu_book' },
        { label: 'Plan enrollments', value: p.enrollments, icon: 'assignment_turned_in' },
        { label: 'Community posts', value: c.communityPosts, icon: 'forum' },
        { label: 'Progress photos', value: c.progressPhotos, icon: 'photo_library' },
      ],
    },
  ];
};

const OverviewSkeleton = () => (
  <div className="adm-dash" aria-busy="true" aria-label="Loading platform overview">
    <div className="adm-dash__main">
      <section className="adm-analytics">
        <div className="adm-analytics__head">
          <div className="adm-skeleton" style={{ flex: 1, padding: 0 }}>
            <div className="adm-skel-line" style={{ width: 160, height: 16 }} />
            <div className="adm-skel-line" style={{ width: 280 }} />
          </div>
        </div>
        <div className="adm-statrow">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="adm-kpi" key={index}>
              <div className="adm-skeleton" style={{ padding: 0 }}>
                <div className="adm-skel-line w-40" />
                <div className="adm-skel-line" style={{ height: 24, width: '65%' }} />
                <div className="adm-skel-line" style={{ width: '80%' }} />
              </div>
            </div>
          ))}
        </div>
        <div className="adm-chart-skeleton" />
      </section>

      <div className="adm-dash__lower">
        <Panel>
          <div className="adm-skeleton">
            <div className="adm-skel-line w-40" />
            <div className="adm-skel-line" />
            <div className="adm-skel-line" style={{ width: '72%' }} />
          </div>
        </Panel>
        <Panel>
          <div className="adm-skeleton">
            <div className="adm-skel-line w-40" />
            <div className="adm-skel-line" />
            <div className="adm-skel-line" style={{ width: '72%' }} />
          </div>
        </Panel>
      </div>
    </div>

    <aside className="adm-dash__rail">
      <Panel>
        <div className="adm-skeleton">
          <div className="adm-skel-line w-40" />
          <div className="adm-skel-line" style={{ height: 190 }} />
        </div>
      </Panel>
      <Panel>
        <div className="adm-skeleton">
          <div className="adm-skel-line w-40" />
          <div className="adm-skel-line" />
          <div className="adm-skel-line" />
        </div>
      </Panel>
    </aside>
  </div>
);

export default function AdminOverview() {
  const { user } = useAuth();
  const [windowDays, setWindowDays] = useState(14);
  const [category, setCategory] = useState('members');
  const [selectedDate, setSelectedDate] = useState(null);

  const overview = useAdminResource(OVERVIEW_PATH);
  const usage = useAdminResource(`/api/admin/ai-usage?days=${windowDays}`);
  const audit = useAdminResource('/api/admin/audit?limit=120&offset=0');

  const usageSeries = useMemo(
    () => buildUsageSeries(usage.data?.perDay || [], windowDays),
    [usage.data, windowDays],
  );
  const windowCalls = usageSeries.reduce((sum, point) => sum + Number(point.calls || 0), 0);
  const peakCalls = usageSeries.reduce((peak, point) => Math.max(peak, Number(point.calls || 0)), 0);

  const auditRecords = audit.data?.records || EMPTY_RECORDS;
  const eventsByDay = useMemo(() => {
    const counts = new Map();
    auditRecords.forEach((row) => {
      const key = localDayKey(row.created_at);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [auditRecords]);

  const selectedKey = selectedDate ? localDayKey(selectedDate) : '';
  const railRecords = (selectedDate
    ? auditRecords.filter((row) => localDayKey(row.created_at) === selectedKey)
    : auditRecords
  ).slice(0, 5);

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const refreshAll = () => {
    overview.reload();
    usage.reload();
    audit.reload();
  };

  const hero = (
    <PageHero
      eyebrow={`${todayLabel} · Administration`}
      title="Platform"
      accent="overview."
      description={`Welcome back, ${user?.name || 'Admin'}. Live platform health, access and content — the numbers below come straight from the database, and every admin action is audited.`}
      actions={(
        <div className="adm-page-actions">
          <span className="adm-live"><i aria-hidden="true" /> Live data</span>
          <button type="button" className="adm-btn is-sm" onClick={refreshAll} disabled={overview.loading}>
            <Icon name="refresh" /> Refresh
          </button>
        </div>
      )}
    />
  );

  if (overview.loading && !overview.data) {
    return (
      <>
        {hero}
        <OverviewSkeleton />
      </>
    );
  }

  if (overview.error && !overview.data) {
    return (
      <>
        {hero}
        <Panel>
          <StateBlock
            kind="error"
            title="Could not load platform stats"
            note={overview.error.message || 'The admin service did not respond.'}
            action={(
              <button type="button" className="adm-btn is-primary" onClick={overview.reload}>
                <Icon name="refresh" /> Retry
              </button>
            )}
          />
        </Panel>
      </>
    );
  }

  const data = overview.data;
  if (!data) return null;

  const u = data.users;
  const ai = data.ai;
  const c = data.content;

  const categories = buildCategories(data);
  const activeCategory = categories.find((item) => item.key === category) || categories[0];
  const reviewCount = Number(u.unverified) + Number(u.onboardingIncomplete) + Number(u.deactivated);

  const activityTitle = selectedDate
    ? `Activity · ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'Recent activity';
  const activitySubtitle = selectedDate
    ? 'Audited admin actions recorded on the selected day.'
    : 'The latest actions taken inside the console.';

  return (
    <>
      {hero}

      <div className="adm-dash">
        <div className="adm-dash__main">
          <section className="adm-analytics" aria-labelledby="adm-statistics-title">
            <div className="adm-analytics__head">
              <div>
                <h2 id="adm-statistics-title" className="adm-surface-title">Statistics</h2>
                <p className="adm-surface-sub">Member growth, sessions and AI activity across the platform.</p>
              </div>
              <div className="adm-seg" role="group" aria-label="Analytics window">
                {WINDOWS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={`adm-seg__btn${windowDays === days ? ' is-active' : ''}`}
                    onClick={() => setWindowDays(days)}
                    aria-pressed={windowDays === days}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>

            <div className="adm-statrow">
              <Kpi
                featured
                label="Total members"
                value={fmtNum(u.total)}
                icon="group"
                hint={<><Icon name="trending_up" />{fmtNum(u.newLast7d)} joined this week</>}
              />
              <Kpi
                label="Active sessions"
                value={fmtNum(ai.activeSessions)}
                icon="devices"
                tone="info"
                hint="Known devices in the last 30 days"
              />
              <Kpi
                label="AI calls today"
                value={fmtNum(ai.callsToday)}
                icon="neurology"
                tone="green"
                hint={`${fmtNum(ai.totalCalls)} lifetime calls`}
              />
              <Kpi
                label="Community posts"
                value={fmtNum(c.communityPosts)}
                icon="forum"
                tone="warn"
                hint="Public feed content"
              />
            </div>

            <div className="adm-analytics__chart">
              <div className="adm-chart-head">
                <div>
                  <h3>AI activity</h3>
                  <p>Daily calls versus distinct active members · last {windowDays} days</p>
                </div>
                <div className="adm-legend">
                  <span><i className="is-accent" aria-hidden="true" /> AI calls</span>
                  <span><i className="is-green" aria-hidden="true" /> Active members</span>
                </div>
              </div>

              {usage.loading && !usage.data && <div className="adm-chart-skeleton" aria-hidden="true" />}

              {usage.error && !usage.data && (
                <div className="adm-chart-empty">
                  <Icon name="query_stats" />
                  <b>AI activity unavailable</b>
                  <span>{usage.error.message || 'The usage ledger did not respond.'}</span>
                  <button type="button" className="adm-btn is-sm is-ghost" onClick={usage.reload}>
                    <Icon name="refresh" /> Retry
                  </button>
                </div>
              )}

              {usage.data && (
                <>
                  <AdminUsageChart
                    series={usageSeries}
                    height={244}
                    label={`AI calls versus active members over the last ${windowDays} days`}
                  />
                  <div className="adm-chart-foot">
                    <span><b>{fmtNum(windowCalls)}</b> calls in {windowDays} days</span>
                    <span>Peak <b>{fmtNum(peakCalls)}</b> calls in a day</span>
                    <span><b>{fmtNum(u.newLast30d)}</b> new members in 30 days</span>
                  </div>
                </>
              )}
            </div>
          </section>

          <div className="adm-dash__lower">
            <Panel
              className="adm-explorer"
              title="Platform breakdown"
              subtitle="Explore the live counters behind each workspace."
              icon="category"
            >
              <div className="adm-seg is-scroll" role="group" aria-label="Metric category">
                {categories.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`adm-seg__btn${activeCategory.key === item.key ? ' is-active' : ''}`}
                    onClick={() => setCategory(item.key)}
                    aria-pressed={activeCategory.key === item.key}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="adm-metric-grid">
                {activeCategory.metrics.map((metric) => (
                  <div className="adm-metric" key={metric.label}>
                    <span className="adm-metric__icon"><Icon name={metric.icon} /></span>
                    <div className="adm-metric__copy">
                      <b>{fmtNum(metric.value)}{metric.suffix || ''}</b>
                      <span>{metric.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              className="adm-attention"
              title="Needs attention"
              subtitle="Accounts that may need a nudge or a review."
              icon="notification_important"
              actions={<Badge tone="warn">{fmtNum(reviewCount)} to review</Badge>}
            >
              <div className="adm-attention__list">
                <div className="adm-attention__row">
                  <span className="adm-attention__icon is-warn"><Icon name="mark_email_unread" /></span>
                  <span className="adm-attention__copy">
                    <b>Unverified emails</b>
                    <span>Never confirmed their address</span>
                  </span>
                  <span className="adm-attention__value">{fmtNum(u.unverified)}</span>
                </div>
                <div className="adm-attention__row">
                  <span className="adm-attention__icon is-info"><Icon name="pending_actions" /></span>
                  <span className="adm-attention__copy">
                    <b>Onboarding incomplete</b>
                    <span>Profile setup not finished</span>
                  </span>
                  <span className="adm-attention__value">{fmtNum(u.onboardingIncomplete)}</span>
                </div>
                <div className="adm-attention__row">
                  <span className="adm-attention__icon is-off"><Icon name="person_off" /></span>
                  <span className="adm-attention__copy">
                    <b>Deactivated accounts</b>
                    <span>Access currently suspended</span>
                  </span>
                  <span className="adm-attention__value">{fmtNum(u.deactivated)}</span>
                </div>
                <div className="adm-attention__row">
                  <span className="adm-attention__icon is-green"><Icon name="person_add" /></span>
                  <span className="adm-attention__copy">
                    <b>New in 30 days</b>
                    <span>Recently joined members</span>
                  </span>
                  <span className="adm-attention__value">{fmtNum(u.newLast30d)}</span>
                </div>
              </div>
              <div className="adm-attention__foot">
                <Link to="/admin/users" className="adm-btn is-sm">
                  <Icon name="group" /> Review members
                </Link>
              </div>
            </Panel>
          </div>
        </div>

        <aside className="adm-dash__rail" aria-label="Calendar and admin activity">
          <Panel
            className="adm-calendar-panel"
            title="Calendar"
            subtitle="Pick a day to inspect the actions recorded on it."
            icon="calendar_month"
          >
            <AdminCalendar
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              eventsByDay={eventsByDay}
            />
          </Panel>

          <Panel
            className="adm-activity-panel"
            title={activityTitle}
            subtitle={activitySubtitle}
            icon="history"
            actions={selectedDate ? (
              <button type="button" className="adm-textlink" onClick={() => setSelectedDate(null)}>
                <Icon name="undo" /> Recent
              </button>
            ) : (
              <Link to="/admin/audit" className="adm-textlink">
                View trail <Icon name="arrow_forward" />
              </Link>
            )}
          >
            {audit.loading && !audit.data && (
              <div className="adm-skeleton" aria-hidden="true">
                <div className="adm-skel-line" />
                <div className="adm-skel-line" style={{ width: '78%' }} />
                <div className="adm-skel-line" />
                <div className="adm-skel-line" style={{ width: '64%' }} />
              </div>
            )}

            {audit.error && !audit.data && (
              <div className="adm-feed__empty">
                <Icon name="history_toggle_off" />
                <b>Audit feed unavailable</b>
                <span>{audit.error.message || 'The audit endpoint did not respond.'}</span>
                <Link to="/admin/audit" className="adm-textlink">Open audit trail <Icon name="arrow_forward" /></Link>
              </div>
            )}

            {audit.data && railRecords.length === 0 && (
              <div className="adm-feed__empty">
                <Icon name="event_available" />
                <b>{selectedDate ? 'Nothing recorded' : 'No admin actions yet'}</b>
                <span>
                  {selectedDate
                    ? 'No audited actions were recorded on this date.'
                    : 'Promote a member, deactivate an account or remove a post and it will appear here.'}
                </span>
              </div>
            )}

            {audit.data && railRecords.length > 0 && (
              <ul className="adm-feed">
                {railRecords.map((row) => {
                  const meta = metaForAction(row.action);
                  const target = row.target_name
                    || row.target_email
                    || (row.target_user_id ? `#${row.target_user_id}` : 'Platform');
                  return (
                    <li className="adm-feed__item" key={row.id}>
                      <span className={`adm-feed__icon is-${meta.tone}`}>
                        <Icon name={meta.icon} />
                      </span>
                      <div className="adm-feed__body">
                        <p><b>{row.admin_name || 'Admin'}</b> · {meta.label}</p>
                        <p className="adm-feed__meta" title={`${target} · ${fmtAgo(row.created_at)}`}>
                          {target} · {fmtAgo(row.created_at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
