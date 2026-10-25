import Icon from "../../../../components/Icon.jsx";

// Workout Complete summary sheet (reference screen 3).
// Score = client-side average of sampled alignment/symmetry/tempo —
// documented heuristic, no backend change. Done dismisses; the page
// handles any pending plan navigation.
function scoreChip(score) {
  if (score >= 85) return { label: 'Excellent', cls: 'bg-[var(--accent-bg)] text-[var(--accent)]' };
  if (score >= 65) return { label: 'Good', cls: 'bg-[var(--accent-bg)] text-[var(--accent)]' };
  return { label: 'Needs work', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' };
}

export default function WorkoutSummary({ summary, onDone }) {
  if (!summary) return null;
  const chip = scoreChip(summary.score);
  const r = 52;
  const c = 2 * Math.PI * r;

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--bg-overlay)] backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      role="dialog" aria-modal="true" aria-label="Workout complete">
      <div className="w-full sm:max-w-md bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 max-h-[90dvh] overflow-y-auto">
        <div className="flex flex-col items-center text-center">
          <span className="w-14 h-14 rounded-full bg-[var(--accent)] flex items-center justify-center mb-4">
            <Icon name="check" className="text-[length:var(--fs-28)] text-[var(--text-inverse)]" />
          </span>
          <h2 className="font-extrabold tracking-tight text-[var(--text-primary)]"
            style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', lineHeight: 1.2 }}>
            Workout Complete
          </h2>
          <p className="mt-1 text-[length:var(--fs-15)] font-bold text-[var(--text-primary)]">{summary.exercise}</p>
          <p className="text-[length:var(--fs-13)] text-[var(--text-muted)] tabular-nums">{summary.achieved}</p>
        </div>

        <div className="mt-6 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl p-5 flex items-center gap-5">
          <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r={r} fill="none" strokeWidth="11" stroke="var(--bg-hover)" />
              <circle cx="60" cy="60" r={r} fill="none" strokeWidth="11" strokeLinecap="round"
                stroke="var(--accent)" strokeDasharray={c} strokeDashoffset={c * (1 - summary.score / 100)} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-extrabold text-[length:var(--fs-22)] text-[var(--text-primary)] tabular-nums"
                style={{ fontFamily: 'var(--font-display)' }}>{summary.score}</span>
              <span className="text-[length:var(--fs-10)] text-[var(--text-muted)]">/100</span>
            </div>
          </div>
          <div>
            <p className="text-[length:var(--fs-13)] font-bold text-[var(--text-primary)]">Form Score</p>
            <span className={`mt-1.5 inline-block px-3 py-1 rounded-full text-[length:var(--fs-11)] font-bold uppercase tracking-widest ${chip.cls}`}>
              {chip.label}
            </span>
          </div>
        </div>

        <div className="mt-4 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl p-5">
          <p className="text-[length:var(--fs-13)] font-bold text-[var(--text-primary)] mb-3">Form Analysis</p>
          <div className="flex flex-col gap-3">
            {summary.rows.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[var(--bg-hover)] flex items-center justify-center shrink-0">
                  <Icon name={row.icon} className="text-[length:var(--fs-17)] text-[var(--text-muted)]" />
                </span>
                <span className="flex-1 text-[length:var(--fs-13)] text-[var(--text-secondary)]">{row.label}</span>
                <span className={`text-[length:var(--fs-13)] font-bold ${row.good ? 'text-[var(--accent)]' : 'text-amber-600 dark:text-amber-400'}`}>
                  {row.state}
                </span>
              </div>
            ))}
          </div>
        </div>

        {summary.coach && (
          <div className="mt-4 bg-[var(--accent-bg)] border border-[var(--accent-border)] rounded-2xl p-5">
            <p className="flex items-center gap-2 text-[length:var(--fs-13)] font-bold text-[var(--text-primary)] mb-1.5">
              <Icon name="record_voice_over" className="text-[length:var(--fs-17)] text-[var(--accent)]" />
              Coach Feedback
            </p>
            <p className="text-[length:var(--fs-13)] leading-relaxed text-[var(--text-secondary)]">{summary.coach}</p>
          </div>
        )}

        <button
          onClick={onDone}
          className="mt-6 w-full py-3.5 rounded-xl bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-15)] font-bold hover:bg-[var(--accent-hover)] active:scale-[0.99] transition-all min-h-[52px]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
