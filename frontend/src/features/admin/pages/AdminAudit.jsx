import { useState } from 'react';
import { useAdminResource } from '../hooks/useAdminResource.js';
import Icon from '../../../components/Icon.jsx';
import {
  Badge, Kpi, PageHero, Panel, Pager, StateBlock, TableSkeleton,
} from '../components/AdminBits.jsx';
import { useAdminToast } from '../hooks/useAdminToast.jsx';
import { fmtNum, fmtWhen } from '../utils/format.js';
import { metaForAction } from '../utils/actionMeta.js';

const PAGE_SIZE = 20;

export default function AdminAudit() {
  const { node: toast } = useAdminToast();
  const [offset, setOffset] = useState(0);
  const { data, loading, error, reload } = useAdminResource(
    `/api/admin/audit?limit=${PAGE_SIZE}&offset=${offset}`,
  );

  const records = data?.records || [];
  const total = data?.total || 0;
  // The API intentionally does not leak database error codes: a missing
  // admin_actions table surfaces as a plain 500. Treat 500 as "audit store
  // not ready" and point at the migration instead of showing a dead end.
  const missingTable = error && (
    error.status === 500
    || error.code === 'ER_NO_SUCH_TABLE'
    || /admin_actions|doesn't exist|does not exist/i.test(error.message || '')
  );

  return (
    <>
      <PageHero
        eyebrow="Accountability"
        title="Audit"
        accent="trail."
        description="Chronological record of every mutating admin action. Written fail-soft by the backend so a missing audit table never blocks moderation — but the trail is the source of truth."
        chips={[
          { label: `${fmtNum(total)} recorded actions`, icon: 'history_edu' },
          { label: 'Immutable append-only', icon: 'lock' },
        ]}
      />

      <div className="adm-kpis">
        <Kpi label="Total actions" value={fmtNum(total)} icon="history_edu" hint="Every admin mutation ever recorded" />
        <Kpi label="This page" value={fmtNum(records.length)} icon="receipt_long" tone="info" hint={`Rows ${offset + 1}–${Math.min(offset + PAGE_SIZE, total)}`} />
        <Kpi label="Retention" value="∞" icon="all_inclusive" tone="green" hint="Rows survive user deletion (FK SET NULL)" />
        <Kpi label="Failure mode" value="Fail-soft" icon="health_and_safety" tone="warn" hint="Missing table logs to console, never blocks" />
      </div>

      <Panel
        title="Recent actions"
        subtitle="Newest first. Admin identity is snapshotted at write time."
        icon="history_edu"
        actions={<button type="button" className="adm-btn is-sm is-ghost" onClick={reload}><Icon name="refresh" /> Refresh</button>}
        flush
      >
        {loading && <TableSkeleton rows={10} />}

        {error && !loading && (
          missingTable ? (
            <StateBlock
              kind="error"
              icon="storage"
              title="Audit table not installed"
              note="Migration 039_admin_audit.sql has not been applied on this database yet. Run `npm run db:migrate` in the backend, then refresh."
              action={<button type="button" className="adm-btn is-sm is-primary" onClick={reload}><Icon name="refresh" /> Re-check</button>}
            />
          ) : (
            <StateBlock kind="error" title="Could not load the audit trail" note={error.message}
              action={<button type="button" className="adm-btn is-sm is-primary" onClick={reload}><Icon name="refresh" /> Retry</button>} />
          )
        )}

        {!loading && !error && records.length === 0 && (
          <StateBlock icon="history_toggle_off" title="No admin actions yet"
            note="Promote a member, deactivate an account or remove a post and it will appear here instantly." />
        )}

        {!loading && !error && records.length > 0 && (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Admin</th>
                  <th>Target</th>
                  <th>Details</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => {
                  const meta = metaForAction(row.action);
                  return (
                    <tr key={row.id}>
                      <td><Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge></td>
                      <td>
                        <span className="adm-person__name">{row.admin_name || 'Unknown admin'}</span>
                        <span className="adm-person__mail" style={{ display: 'block' }}>{row.admin_email}</span>
                      </td>
                      <td>
                        {row.target_name ? (
                          <>
                            <span className="adm-person__name">{row.target_name}</span>
                            <span className="adm-person__mail" style={{ display: 'block' }}>
                              {row.target_email || `#${row.target_user_id}`}
                            </span>
                          </>
                        ) : (
                          <span className="adm-cell-muted">
                            {row.target_user_id ? `#${row.target_user_id} (deleted)` : '—'}
                          </span>
                        )}
                      </td>
                      <td className="adm-cell-muted" style={{ maxWidth: 380, whiteSpace: 'normal' }}>
                        {row.details || '—'}
                      </td>
                      <td className="adm-cell-muted">{fmtWhen(row.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pager total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
          </div>
        )}
      </Panel>
      {toast}
    </>
  );
}
