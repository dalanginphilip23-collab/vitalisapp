import Icon from '../../../components/Icon.jsx';
import { fmtNum } from '../utils/format.js';

/* ── Hero / header ─────────────────────────────────────────────────────── */

export function PageHero({ eyebrow, title, accent, description, chips = [], actions = undefined }) {
  return (
    <header className="adm-hero">
      <div className="adm-hero__copy">
        {eyebrow && <span className="adm-eyebrow">{eyebrow}</span>}
        <h1 className="adm-hero__title">
          {title}
          {accent ? <> <em>{accent}</em></> : null}
        </h1>
        {description && <p className="adm-hero__sub">{description}</p>}
        {chips.length > 0 && (
          <div className="adm-hero__meta">
            {chips.map((chip) => (
              <span key={chip.label || chip} className="adm-chip">
                {chip.icon && <Icon name={chip.icon} />}
                {chip.label || chip}
              </span>
            ))}
          </div>
        )}
      </div>
      {actions && <div className="adm-hero__actions">{actions}</div>}
    </header>
  );
}

/* ── Primitives ────────────────────────────────────────────────────────── */

export function Badge({ tone = 'member', icon = undefined, children }) {
  return (
    <span className={`adm-badge is-${tone}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

export function Panel({ title, subtitle, icon, actions, flush = false, children, className = '' }) {
  return (
    <section className={`adm-panel ${className}`.trim()}>
      {(title || actions) && (
        <div className="adm-panel__head">
          <div>
            {title && <h2 className="adm-panel__title">{icon && <Icon name={icon} />}{title}</h2>}
            {subtitle && <p className="adm-panel__sub">{subtitle}</p>}
          </div>
          {actions && <div className="adm-actions">{actions}</div>}
        </div>
      )}
      <div className={`adm-panel__body${flush ? ' is-flush' : ''}`}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, hint, icon, tone = 'accent', suffix = undefined, featured = false }) {
  const styles = {
    accent: { '--kpi-color': 'var(--accent)', '--kpi-tile': 'var(--accent-bg)', '--kpi-glow': 'var(--accent)' },
    green: { '--kpi-color': 'var(--accent-2)', '--kpi-tile': 'var(--accent-2-bg)', '--kpi-glow': 'var(--accent-2)' },
    info: { '--kpi-color': 'var(--info)', '--kpi-tile': 'var(--info-bg)', '--kpi-glow': 'var(--info)' },
    warn: { '--kpi-color': 'var(--warning)', '--kpi-tile': 'var(--warning-bg)', '--kpi-glow': 'var(--warning)' },
  };
  return (
    <article className={`adm-kpi${featured ? ' is-featured' : ''}`} style={styles[tone] || styles.accent}>
      <div className="adm-kpi__head">
        <span className="adm-kpi__label">{label}</span>
        <span className="adm-kpi__icon"><Icon name={icon} /></span>
      </div>
      <div className="adm-kpi__value">
        {value}{suffix && <small>{suffix}</small>}
      </div>
      {hint && <p className="adm-kpi__hint">{typeof hint === 'string' ? hint : hint}</p>}
    </article>
  );
}

export function MiniStat({ value, label }) {
  return (
    <div className="adm-mini">
      <b>{fmtNum(value)}</b>
      <span>{label}</span>
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = 'Search…' }) {
  return (
    <label className="adm-search">
      <Icon name="search" />
      <input
        type="search"
        className="adm-input"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
      />
    </label>
  );
}

export function Pager({ total, limit, offset, onChange }) {
  const pages = Math.max(Math.ceil(total / limit), 1);
  const current = Math.floor(offset / limit);
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, total);
  const windowStart = Math.max(Math.min(current - 2, pages - 5), 0);
  const visible = Array.from({ length: Math.min(5, pages) }, (_, i) => windowStart + i);

  return (
    <div className="adm-pager">
      <span>{start}–{end} of {fmtNum(total)}</span>
      <div className="adm-pager__pages">
        <button type="button" className="adm-pager__btn" disabled={current === 0}
          onClick={() => onChange(Math.max(offset - limit, 0))} aria-label="Previous page">
          <Icon name="chevron_left" />
        </button>
        {visible.map((page) => (
          <button
            type="button"
            key={page}
            className={`adm-pager__btn${page === current ? ' is-active' : ''}`}
            onClick={() => onChange(page * limit)}
            aria-current={page === current ? 'page' : undefined}
          >
            {page + 1}
          </button>
        ))}
        <button type="button" className="adm-pager__btn" disabled={current >= pages - 1}
          onClick={() => onChange(Math.min(offset + limit, (pages - 1) * limit))} aria-label="Next page">
          <Icon name="chevron_right" />
        </button>
      </div>
    </div>
  );
}

export function StateBlock({ kind = 'empty', icon = 'inbox', title, note, action = undefined }) {
  return (
    <div className={`adm-state${kind === 'error' ? ' is-error' : ''}`}>
      <span className="adm-state__icon"><Icon name={kind === 'error' ? 'error' : icon} /></span>
      <b>{title}</b>
      {note && <p>{note}</p>}
      {action}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="adm-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="adm-skel-line" style={{ width: `${[92, 78, 86, 68, 90, 74][i % 6]}%` }} />
      ))}
    </div>
  );
}

/* ── Confirm modal ─────────────────────────────────────────────────────── */

export function ConfirmDialog({
  title,
  message,
  children = undefined,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
  error = '',
  confirmDisabled = false,
  onCancel,
  onConfirm,
}) {
  return (
    <div className="adm-modal-scrim" onClick={busy ? undefined : onCancel}>
      <div className="adm-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {message && <p className="adm-modal__sub">{message}</p>}
        {children}
        {error && <p className="adm-inline-note is-danger" style={{ marginTop: 12 }}><Icon name="error" />{error}</p>}
        <div className="adm-modal__actions">
          <button type="button" className="adm-btn is-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={`adm-btn ${danger ? 'is-danger' : 'is-primary'}`}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
