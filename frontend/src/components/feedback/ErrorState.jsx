export default function ErrorState({ message='Something went wrong.', onRetry=null }) {
  return (
    <div role="alert" className="p-6 rounded-2xl bg-[var(--error-bg)] border border-[var(--error)]/20 text-[var(--error)] text-sm flex flex-col gap-3 items-center text-center">
      <span className="flex items-center gap-2 min-w-0 break-words"><span className="material-symbols-outlined text-[18px] shrink-0">error</span><span className="min-w-0 break-words">{message}</span></span>
      {onRetry && <button onClick={onRetry} className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[var(--error)] text-white text-xs font-bold uppercase tracking-widest hover:brightness-110">Retry</button>}
    </div>
  );
}
