export default function EmptyState({ message='No data yet.', action=null, icon='inbox' }) {
  return (
    <div role="status" className="p-8 text-center border border-dashed border-[var(--border-light)] rounded-2xl glass-card flex flex-col items-center gap-3">
      <span className="material-symbols-outlined text-[28px] text-[var(--text-muted)]" aria-hidden="true">{icon}</span>
      <p className="text-sm text-[var(--text-muted)] m-0 break-words min-w-0 max-w-full">{message}</p>
      {action && <div className="w-full flex justify-center">{action}</div>}
    </div>
  );
}
