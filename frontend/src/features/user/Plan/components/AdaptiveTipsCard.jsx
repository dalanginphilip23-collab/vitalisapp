import Icon from '../../../../components/Icon.jsx';

// ── Module 5 — Adaptive tips card ───────────────────────────────────────────
// Renders rule-based suggestions from GET /api/training-insights. Each tip
// with an action gets a one-click Apply (POST /api/plans/adjust-from-goal);
// the engine never modifies plans on its own. Hidden entirely when silent.

const TIP_ICONS = {
  no_progression: 'lock_clock',
  recovery: 'self_improvement',
  suggest_shorter: 'hourglass_bottom',
  suggest_gentle: 'arrow_upward',
  info: 'info',
};

const TIP_STYLES = {
  no_progression: { bg: 'var(--error-bg)', border: 'var(--error)' }, // soften below via opacity classes
  recovery: { bg: 'var(--accent-bg)', border: 'var(--accent-border)' },
  suggest_shorter: { bg: 'var(--accent-bg)', border: 'var(--accent-border)' },
  suggest_gentle: { bg: 'var(--accent-bg)', border: 'var(--accent-border)' },
  info: { bg: 'var(--bg-hover)', border: 'var(--border-light)' },
};

export default function AdaptiveTipsCard({ tips, loading, applying, onApply }) {
  if (loading && (!tips || tips.length === 0)) return null;
  if (!tips || tips.length === 0) return null;

  const actionable = tips.filter((t) => t.action);

  return (
    <div
      className="mb-4 sm:mb-6 rounded-2xl border p-4 sm:p-5"
      style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-light)' }}
      role="region"
      aria-label="Adaptive training suggestions"
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon name="insights" className="text-[length:var(--fs-18)]" style={{ color: 'var(--accent)' }} fill={1} />
        <p className="text-[length:var(--fs-10)] sm:text-[length:var(--fs-11)] font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
          Adaptive suggestions
        </p>
        <span className="text-[length:var(--fs-9)] font-bold uppercase tracking-widest ml-auto" style={{ color: 'var(--text-muted)' }}>
          from your sessions
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {tips.map((tip, i) => {
          const s = TIP_STYLES[tip.type] ?? TIP_STYLES.info;
          return (
            <div
              key={`${tip.type}-${i}`}
              className="rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center gap-2.5"
              style={{ background: s.bg, borderColor: s.border, opacity: tip.type === 'no_progression' ? 0.95 : 1 }}
            >
              <Icon name={TIP_ICONS[tip.type] ?? 'tips_and_updates'} className="text-[length:var(--fs-18)] shrink-0" style={{ color: 'var(--accent)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-[length:var(--fs-12)] font-black" style={{ color: 'var(--text-primary)' }}>{tip.title}</p>
                <p className="text-[length:var(--fs-11)] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{tip.message}</p>
              </div>
              {tip.action && (
                <button
                  onClick={() => onApply?.(tip.action)}
                  disabled={applying}
                  className="h-10 px-4 shrink-0 sm:w-auto w-full rounded-xl bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-10)] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                >
                  {applying ? 'Applying…' : tip.action === 'shorter' ? 'Fit to ≤30 min' : 'Add a set'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {actionable.length > 0 && (
        <p className="text-[length:var(--fs-9)] mt-2.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Applying is always your call — Vitalis never adjusts intensity automatically.
        </p>
      )}
    </div>
  );
}
