export default function EmptyState({ message='No data yet.', action=null, icon='inbox' }) {
  return (
    <div role="status" className="p-8 text-center border border-dashed border-[var(--border-medium)] rounded-[var(--radius-lg)] glass-card flex flex-col items-center gap-3">
      <span className="material-symbols-outlined text-[length:var(--fs-28)] text-[var(--text-muted)]" aria-hidden="true">{icon}</span>
      <p className="text-[length:var(--fs-14)] text-[var(--text-secondary)] m-0">{message}</p>
      {action}
    </div>
  );
}
