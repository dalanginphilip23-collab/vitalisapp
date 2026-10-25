import Icon from "../../../../components/Icon.jsx";
import SessionLogRow from "./SessionLogRow.jsx";

export default function SessionLog({ logs }) {
  if (logs.length === 0) return null;
  return (
    <div className="glass-card p-5 sm:p-6 rounded-2xl border border-[var(--border-light)]">
      <h4 className="text-[var(--text-primary)] font-black text-[length:var(--fs-10)] mb-4 uppercase tracking-[0.3em] flex items-center gap-2">
        <Icon name="history" className="text-[var(--accent)] text-sm" />
        Session Log
        <span className="ml-auto px-2 py-0.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent)] tabular-nums">{logs.length}</span>
      </h4>
      <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
        {logs.slice().reverse().map((log, i) => (
          <SessionLogRow key={i} log={log} />
        ))}
      </div>
    </div>
  );
}