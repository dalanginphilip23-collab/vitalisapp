import { useMemo, useState } from 'react';
import { useAdminResource } from '../hooks/useAdminResource.js';
import Icon from '../../../components/Icon.jsx';
import {
  Badge, Kpi, PageHero, Panel, Pager, StateBlock, TableSkeleton,
} from '../components/AdminBits.jsx';
import AdminUsageChart from '../components/AdminUsageChart.jsx';
import { buildUsageSeries } from '../utils/usage.js';
import { fmtNum, fmtDay, initials } from '../utils/format.js';

const PAGE_SIZE = 10;
const WINDOWS = [7, 14, 30, 90];

export default function AdminAiUsage() {
  const [days, setDays] = useState(14);
  const [offset, setOffset] = useState(0);
  const { data, loading, error, reload } = useAdminResource(
    `/api/admin/ai-usage?days=${days}&limit=${PAGE_SIZE}&offset=${offset}`,
  );

  const series = useMemo(() => buildUsageSeries(data?.perDay || [], days), [data, days]);
  const windowCalls = series.reduce((sum, point) => sum + Number(point.calls || 0), 0);
  const peakCalls = series.reduce((peak, point) => Math.max(peak, Number(point.calls || 0)), 0);
  const activeDays = series.filter((point) => Number(point.calls) > 0).length;
  const todayRow = series[series.length - 1];
  const records = data?.topUsers?.records || [];
  const total = data?.topUsers?.total || 0;
  const topUser = records[0];

  return (
    <>
      <PageHero
        eyebrow="Cost & adoption"
        title="AI usage"
        accent="ledger."
        description="Daily call volume and the heaviest consumers across the selected window. Quota resets per UTC day in ai_daily_usage."
        actions={(
          <div className="adm-seg" role="group" aria-label="Usage window">
            {WINDOWS.map((value) => (
              <button
                key={value}
                type="button"
                className={`adm-seg__btn${days === value ? ' is-active' : ''}`}
                onClick={() => { setDays(value); setOffset(0); }}
                aria-pressed={days === value}
              >
                {value} days
              </button>
            ))}
          </div>
        )}
      />

      {loading && !data && <TableSkeleton rows={8} />}

      {error && !loading && (
        <Panel>
          <StateBlock kind="error" title="Could not load the AI ledger" note={error.message}
            action={<button type="button" className="adm-btn is-sm is-primary" onClick={reload}><Icon name="refresh" /> Retry</button>} />
        </Panel>
      )}

      {data && (
        <>
          <div className="adm-kpis">
            <Kpi label={`Calls in ${days}d`} value={fmtNum(windowCalls)} icon="neurology"
              hint={`${activeDays} active day${activeDays === 1 ? '' : 's'}`} />
            <Kpi label="Calls today" value={fmtNum(todayRow?.calls || 0)} icon="today" tone="green"
              hint={`${fmtNum(todayRow?.users || 0)} members today`} />
            <Kpi label="Heaviest member" value={topUser ? fmtNum(topUser.totalCalls) : '0'} icon="workspace_premium" tone="warn"
              hint={topUser ? topUser.name : 'No usage in this window'} />
            <Kpi label="Members active" value={fmtNum(total)} icon="group" tone="info"
              hint="Distinct users with at least one call" />
          </div>

          <Panel
            title="Daily call volume"
            subtitle={`${days} days, oldest → newest. Hover the chart for exact counts.`}
            icon="monitoring"
            actions={<Badge tone="info" icon="schedule">{days}d window</Badge>}
          >
            {windowCalls === 0 ? (
              <StateBlock icon="query_stats" title="No AI usage recorded" note={`Nothing in the last ${days} days.`} />
            ) : (
              <>
                <div className="adm-chart-head">
                  <div>
                    <h3>Daily activity</h3>
                    <p>Calls and distinct members per UTC day.</p>
                  </div>
                  <div className="adm-legend">
                    <span><i className="is-accent" aria-hidden="true" /> AI calls</span>
                    <span><i className="is-green" aria-hidden="true" /> Active members</span>
                  </div>
                </div>
                <AdminUsageChart
                  series={series}
                  height={250}
                  label={`AI calls per day for the last ${days} days`}
                />
                <div className="adm-chart-foot">
                  <span>{fmtDay(series[0]?.usage_day)} → {fmtDay(series[series.length - 1]?.usage_day)}</span>
                  <span>Peak <b>{fmtNum(peakCalls)}</b> calls in a day</span>
                  <span><b>{fmtNum(windowCalls)}</b> calls across {activeDays} active days</span>
                </div>
              </>
            )}
          </Panel>

          <Panel
            title="Top consumers"
            subtitle="Ranked by total calls inside the selected window."
            icon="leaderboard"
            actions={<button type="button" className="adm-btn is-sm is-ghost" onClick={reload}><Icon name="refresh" /> Refresh</button>}
            flush
          >
            {records.length === 0 ? (
              <StateBlock icon="leaderboard" title="No usage to rank" note="Once members start using AI features they appear here." />
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 56 }}>Rank</th>
                      <th>Member</th>
                      <th>Role</th>
                      <th style={{ textAlign: 'right' }}>Calls</th>
                      <th style={{ textAlign: 'right' }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row, index) => {
                      const rank = offset + index + 1;
                      const share = windowCalls > 0 ? Math.round((Number(row.totalCalls) / windowCalls) * 100) : 0;
                      return (
                        <tr key={row.id}>
                          <td>
                            <span className={`adm-badge ${rank <= 3 ? 'is-admin' : 'is-member'}`}>#{rank}</span>
                          </td>
                          <td>
                            <div className="adm-person">
                              <span className="adm-avatar">{initials(row.name)}</span>
                              <span className="adm-person__copy">
                                <span className="adm-person__name">{row.name}</span>
                                <span className="adm-person__mail">{row.email}</span>
                              </span>
                            </div>
                          </td>
                          <td><Badge tone={row.role === 'admin' ? 'admin' : 'member'}>{row.role}</Badge></td>
                          <td className="adm-cell-num" style={{ textAlign: 'right' }}>{fmtNum(row.totalCalls)}</td>
                          <td className="adm-cell-muted" style={{ textAlign: 'right' }}>{share}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <Pager total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
