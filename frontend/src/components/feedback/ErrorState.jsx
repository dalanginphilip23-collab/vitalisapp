export default function ErrorState({ message='Something went wrong.', onRetry=null }) {
  return (
    <div role="alert" className="p-5 rounded-[var(--radius-lg)] bg-[var(--error-bg)] border border-[var(--error)]/25 text-[var(--error)] text-[length:var(--fs-14)] flex flex-col gap-3 items-start">
      <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[length:var(--fs-18)]">error</span>{message}</span>
      {onRetry && <button onClick={onRetry} className="px-4 py-2.5 min-h-[44px] rounded-[var(--radius-md)] bg-[var(--error)] text-white text-[length:var(--fs-13)] font-semibold hover:brightness-110 transition-[filter]">Retry</button>}
    </div>
  );
}
