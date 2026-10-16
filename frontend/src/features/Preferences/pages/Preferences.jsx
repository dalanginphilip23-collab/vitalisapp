import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../../components/Sidebar.jsx';
import Topbar from '../../../components/Topbar.jsx';
import BottomNav from '../../../components/BottomNav.jsx';
import ThemeToggle from '../../../components/ThemeToggle.jsx';
import LoadingState from '../../../components/feedback/LoadingState.jsx';
import ErrorState from '../../../components/feedback/ErrorState.jsx';
import { useAuth } from '../../../hooks/useAuth.jsx';
import { useTheme } from '../../../hooks/useTheme.js';
import { apiGet, apiFetch } from '../../../lib/apiClient.js';
import { safeGet, safeSet } from '../../../lib/storage.js';
import { notifyUnitsChanged } from '../../../lib/units.js';
import { useToastStore } from '../../../stores/toastStore.js';

const Preferences = () => {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const addToast = useToastStore((s) => s.addToast);
  const [units, setUnits] = useState('metric');
  const [stepGoal, setStepGoal] = useState(8000);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setPageLoading(true);
    setPageError('');
    try {
      const data = await apiGet('/api/settings');
      const s = data.settings || {};
      setUnits(s.units || 'metric');
      setStepGoal(Number(s.step_goal) || 8000);
      // Offline cache only — safeSet already swallows private-mode errors.
      safeSet('vitalis:units', s.units || 'metric');
      safeSet('vitalis:stepGoal', String(s.step_goal ?? 8000));
    } catch (err) {
      // Same stale-session case as persist(): cached user, no valid cookie.
      // Offline errors (status 0/TIMEOUT) stay on the retry banner.
      if (err?.status === 401) {
        navigate('/login');
        return;
      }
      setUnits(safeGet('vitalis:units', 'metric') || 'metric');
      setStepGoal(Number(safeGet('vitalis:stepGoal', '8000')) || 8000);
      setPageError(err.message || 'Could not load your preferences.');
    } finally {
      setPageLoading(false);
    }
  }, [user?.id, navigate]);

  useEffect(() => {
    if (!loading && user?.id) load();
    if (!loading && !user?.id) setPageLoading(false);
  }, [loading, user?.id, load]);

  const persist = async (next) => {
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      const data = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(next),
      });
      const s = data.settings || next;
      setUnits(s.units);
      setStepGoal(Number(s.step_goal));
      safeSet('vitalis:units', s.units);
      safeSet('vitalis:stepGoal', String(s.step_goal));
      // Wake every useUnits() subscriber so lb/ft shows up immediately.
      notifyUnitsChanged();
    } catch (err) {
      // 401 = session cookie gone (expired/cleared) while a cached user was
      // still in memory. Route to login explicitly instead of a cryptic toast —
      // the global 401 funnel also logs out in the background.
      if (err?.status === 401) {
        addToast('Session expired — please sign in again.', 'error');
        navigate('/login');
        return;
      }
      addToast(err.message || 'Could not save preferences.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };
  if (loading || (pageLoading && !pageError)) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="hidden md:block"><Sidebar onClick={handleLogout} expanded={false} setExpanded={() => {}} /></div>
        <Topbar sidebarExpanded={false} userId={user?.id} />
        <main className="pt-[56px] pb-24 px-4 md:px-6 md:ml-[72px]">
          <div className="max-w-[720px] mx-auto pt-4 pb-6"><LoadingState message="Loading preferences…" /></div>
        </main>
        <div className="md:hidden"><BottomNav /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] relative">
      <div className="glass-content">
      <div className="hidden md:block"><Sidebar onClick={handleLogout} expanded={false} setExpanded={() => {}} /></div>
      <Topbar sidebarExpanded={false} userId={user?.id} />
      <main className="pt-[56px] pb-24 px-4 md:px-6 md:ml-[72px]">
        <div className="max-w-[720px] lg:max-w-3xl mx-auto pt-4 pb-6 space-y-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">Settings</p>
            <h1 className="text-[22px] font-bold">Preferences</h1>
            {saving && <p className="text-[11px] text-[var(--text-muted)] mt-1">Saving…</p>}
          </div>

          {pageError && <ErrorState message={pageError} onRetry={load} />}

          <section className="p-4 rounded-[14px] glass-card border border-[var(--border-light)]">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Appearance</p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[14px]">Quick toggle</span>
              <ThemeToggle />
            </div>
            <div className="grid grid-cols-3 gap-1.5 mt-3" role="radiogroup" aria-label="Theme">
              {[
                { key: 'light', label: 'Light', icon: 'light_mode' },
                { key: 'system', label: 'System', icon: 'smartphone' },
                { key: 'dark', label: 'Dark', icon: 'dark_mode' },
              ].map((o) => (
                <button key={o.key} onClick={() => setPreference(o.key)}
                  role="radio" aria-checked={preference === o.key}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-bold transition-colors ${preference === o.key ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]' : 'bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                  <span className="material-symbols-outlined text-[18px]">{o.icon}</span>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-2">System follows your device setting and switches automatically.</p>
          </section>

          <section className="p-4 rounded-[14px] glass-card border border-[var(--border-light)]">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Units</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {['metric', 'imperial'].map((u) => (
                <button key={u} onClick={() => { setUnits(u); persist({ units: u, step_goal: stepGoal }); }}
                  aria-pressed={units === u}
                  className={`min-h-[44px] h-auto py-2 px-2 rounded-[12px] text-[12px] font-bold capitalize whitespace-nowrap transition-colors ${units === u ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]' : 'border border-[var(--border-light)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                  {u === 'metric' ? 'Metric (kg, cm)' : 'Imperial (lb, ft)'}
                </button>
              ))}
            </div>
          </section>

          <section className="p-4 rounded-[14px] glass-card border border-[var(--border-light)]">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Daily step goal</p>
              <p className="text-[12px] font-black text-[var(--accent)] tabular-nums">{Number(stepGoal).toLocaleString()} steps</p>
            </div>
            <div className="grid grid-cols-4 gap-1.5 mt-3">
              {[5000, 8000, 10000, 12000].map((v) => (
                <button key={v} onClick={() => { setStepGoal(v); persist({ units, step_goal: v }); }}
                  aria-pressed={stepGoal === v}
                  className={`py-2 rounded-xl text-[11px] font-bold tabular-nums transition-colors ${stepGoal === v ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]' : 'bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                  {(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k
                </button>
              ))}
            </div>
            <input type="number" min={1000} max={30000} step={500} value={stepGoal}
              aria-label="Custom daily step goal"
              onChange={(e) => { setStepGoal(Number(e.target.value)); }}
              onBlur={(e) => {
                const v = Math.min(30000, Math.max(1000, Number(e.target.value) || 8000));
                setStepGoal(v);
                persist({ units, step_goal: v });
              }}
              className="mt-2.5 w-full h-11 rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 text-[14px] tabular-nums outline-none focus:border-[var(--accent)]" />
          </section>

          <section className="p-4 rounded-[14px] glass-card border border-[var(--border-light)]">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Your Goal Setup</p>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">Setup runs once. Review or edit your goal anytime in Profile.</p>
            <button onClick={() => navigate('/dashboard/profile')}
              className="mt-3 w-full h-11 px-4 rounded-[12px] border border-[var(--border-light)] text-[13px] font-bold hover:bg-[var(--bg-hover)] transition-colors">
              View my goal in Profile
            </button>
          </section>

          <section className="p-4 rounded-[14px] glass-card border border-[var(--border-light)]">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Reset</p>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">Restore metric units, 8,000 steps, and system theme.</p>
            <button
              onClick={() => {
                setUnits('metric');
                setStepGoal(8000);
                setPreference('system');
                persist({ units: 'metric', step_goal: 8000, theme: 'system' });
              }}
              className="mt-3 w-full h-11 px-4 rounded-[12px] border border-[var(--border-light)] text-[13px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
              Reset to defaults
            </button>
          </section>
        </div>
      </main>
      <div className="md:hidden"><BottomNav /></div>
      </div>
    </div>
  );
};

export default Preferences;
