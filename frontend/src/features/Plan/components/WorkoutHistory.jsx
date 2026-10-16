import { useState, useEffect } from 'react';
import { apiGet } from '../../../lib/apiClient.js';

// Completed camera sessions.
const WorkoutHistory = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet('/api/workout-logs');
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      } catch { /* empty state */ }
      finally { setLoading(false); }
    })();
  }, []);
  if (loading) {
    return <p className="py-10 text-center text-xs uppercase tracking-widest animate-pulse text-[var(--text-muted)]">Loading history...</p>;
  }
  if (logs.length === 0) {
    return (
      <div className="py-14 text-center">
        <p className="text-sm font-bold text-[var(--text-primary)]">No workouts yet</p>
        <p className="text-xs mt-1 text-[var(--text-muted)]">Start a camera workout or pick an exercise from the Library.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)] mb-1">
        Workout History <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent)] tabular-nums">{logs.length}</span>
      </p>
      {logs.map(log => (
        <div key={log.id} className="flex items-center justify-between gap-2 rounded-xl p-3 border border-[var(--border-light)] glass-card">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold capitalize text-[var(--text-primary)] truncate">{String(log.workout_type || '').replace(/_/g, ' ')}</p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {log.start_time ? new Date(log.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
              {log.duration_seconds ? ` · ${Math.round(log.duration_seconds / 60)} min` : ''}
              {' · '}{log.status}
            </p>
          </div>
          <span className="text-sm font-black text-[var(--accent)] shrink-0 whitespace-nowrap tabular-nums">{log.rep_count ?? 0} reps</span>
        </div>
      ))}
    </div>
  );
};

export default WorkoutHistory;
