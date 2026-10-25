import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountPageShell from '../../../../components/app/AccountPageShell.jsx';
import { useAccountBasePath } from '../../../../hooks/useAccountBasePath.js';
import PageHeader from '../../../../components/app/PageHeader.jsx';
import ThemeToggle from '../../../../components/ThemeToggle.jsx';
import Icon from '../../../../components/Icon.jsx';
import LoadingState from '../../../../components/feedback/LoadingState.jsx';
import ErrorState from '../../../../components/feedback/ErrorState.jsx';
import { useAuth } from '../../../../hooks/useAuth.jsx';
import { useTheme } from '../../../../hooks/useTheme.js';
import { apiGet, apiFetch } from '../../../../lib/apiClient.js';
import { safeGet, safeSet } from '../../../../lib/storage.js';
import { useToastStore } from '../../../../stores/toastStore.js';
import '../preferences.css';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: 'light_mode', preview: 'light', radioLabel: 'Light theme' },
  { value: 'system', label: 'System', icon: 'brightness_auto', preview: 'system', radioLabel: 'Match system theme' },
  { value: 'dark', label: 'Dark', icon: 'dark_mode', preview: 'dark', radioLabel: 'Dark theme' },
];

const UNIT_OPTIONS = [
  { value: 'metric', label: 'Metric', meta: 'kg · cm · km', icon: 'straighten', radioLabel: 'Metric units' },
  { value: 'imperial', label: 'Imperial', meta: 'lb · ft · mi', icon: 'monitor_weight', radioLabel: 'Imperial units' },
];

const GOAL_PRESETS = [5000, 8000, 10000, 12000];
const clampStepGoal = (value) => Math.min(30000, Math.max(1000, Number(value) || 8000));

function ThemePreview({ variant }) {
  return (
    <span className={`pref-theme-preview pref-theme-preview--${variant}`} aria-hidden="true">
      <span className="pref-preview-rail" />
      <span className="pref-preview-main">
        <span className="pref-preview-top" />
        <span className="pref-preview-hero" />
        <span className="pref-preview-line" />
        <span className="pref-preview-line pref-preview-line--short" />
      </span>
    </span>
  );
}

const Preferences = ({ embedded = false }) => {
  const navigate = useNavigate();
  const accountBase = useAccountBasePath();
  const { user, loading, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const addToast = useToastStore((s) => s.addToast);
  const [units, setUnits] = useState('metric');
  const [stepGoal, setStepGoal] = useState(8000);
  const [stepGoalDraft, setStepGoalDraft] = useState('8000');
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setPageLoading(true);
    setPageError('');
    setSaveError(false);
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

  useEffect(() => {
    setStepGoalDraft(String(stepGoal));
  }, [stepGoal]);

  const persist = async (next) => {
    if (!user?.id || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const data = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(next),
      });
      const s = data.settings || next;
      setUnits(s.units);
      setStepGoal(Number(s.step_goal));
      // A successful write proves the session/network is healthy again.
      setPageError('');
      safeSet('vitalis:units', s.units);
      safeSet('vitalis:stepGoal', String(s.step_goal));
    } catch (err) {
      setSaveError(true);
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

  const handleUnitChange = (nextUnits) => {
    setUnits(nextUnits);
    persist({ units: nextUnits, step_goal: stepGoal });
  };

  const handleGoalPreset = (value) => {
    setStepGoal(value);
    setStepGoalDraft(String(value));
    persist({ units, step_goal: value });
  };

  const commitStepGoal = () => {
    const nextGoal = clampStepGoal(stepGoalDraft);
    setStepGoal(nextGoal);
    setStepGoalDraft(String(nextGoal));
    persist({ units, step_goal: nextGoal });
  };

  const handleReset = () => {
    setUnits('metric');
    setStepGoal(8000);
    setStepGoalDraft('8000');
    setPreference('system');
    persist({ units: 'metric', step_goal: 8000, theme: 'system' });
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  if (loading || (pageLoading && !pageError)) {
    return (
      <AccountPageShell embedded={embedded} userId={user?.id} onLogout={handleLogout} contentClassName="app-container app-container--reading">
        <div className="pref-page">
          <div className="pt-2 pb-6"><LoadingState message="Loading preferences…" /></div>
        </div>
      </AccountPageShell>
    );
  }

  const saveStatus = saving
    ? { label: 'Saving changes', icon: 'sync', tone: 'saving' }
    : saveError
      ? { label: 'Could not save', icon: 'cloud_off', tone: 'error' }
      : pageError
        ? { label: 'Offline copy', icon: 'cloud_off', tone: 'warning' }
        : { label: 'Auto-saved', icon: 'cloud_done', tone: 'ok' };

  return (
    <AccountPageShell embedded={embedded} userId={user?.id} onLogout={handleLogout} contentClassName="app-container app-container--reading">
      <div className="pref-page">
        <PageHeader
          className="pref-page-head"
          eyebrow="Settings"
          title="Preferences"
          description="Choose how Vitalis looks, measures your activity and tracks your daily target."
          actions={(
            <span className={`pref-sync pref-sync--${saveStatus.tone}`} role="status" aria-live="polite">
              <Icon name={saveStatus.icon} className={`pref-sync-icon${saving ? ' is-spinning' : ''}`} />
              <span>{saveStatus.label}</span>
            </span>
          )}
        />

        {pageError && <div className="pref-alert"><ErrorState message={pageError} onRetry={load} /></div>}

        <div className="pref-panel" aria-busy={saving}>
          <section className="pref-section" aria-labelledby="pref-appearance-title">
            <div className="pref-section-head">
              <span className="pref-section-icon" aria-hidden="true">
                <Icon name="palette" />
              </span>
              <div className="pref-section-copy">
                <h2 id="pref-appearance-title">Appearance</h2>
                <p>Choose how Vitalis looks. System follows your device automatically.</p>
              </div>
            </div>

            <div className="pref-section-body">
              <fieldset className="pref-fieldset">
                <legend className="pref-visually-hidden">Theme</legend>
                <div className="pref-theme-grid">
                  {THEME_OPTIONS.map((option) => {
                    const selected = preference === option.value;
                    return (
                      <label
                        key={option.value}
                        className="pref-choice"
                        data-selected={selected ? 'true' : 'false'}
                      >
                        <input
                          type="radio"
                          name="pref-theme"
                          value={option.value}
                          checked={selected}
                          onChange={() => setPreference(option.value)}
                          className="pref-choice-input"
                          aria-label={option.radioLabel}
                        />
                        <span className="pref-choice-card">
                          <span className="pref-theme-preview-wrap">
                            <ThemePreview variant={option.preview} />
                            <span className="pref-choice-check" aria-hidden="true">
                              <Icon name="check" />
                            </span>
                          </span>
                          <span className="pref-theme-label">
                            <Icon name={option.icon} />
                            <span>{option.label}</span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="pref-inline-row">
                <div className="pref-inline-copy">
                  <span className="pref-inline-title">Quick switch</span>
                  <span className="pref-inline-desc">Flip straight between light and dark.</span>
                </div>
                <div className="pref-quick-toggle">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </section>

          <section className="pref-section" aria-labelledby="pref-units-title">
            <div className="pref-section-head">
              <span className="pref-section-icon" aria-hidden="true">
                <Icon name="straighten" />
              </span>
              <div className="pref-section-copy">
                <h2 id="pref-units-title">Units &amp; step goal</h2>
                <p>Choose your measurements and the target that drives your dashboard progress.</p>
              </div>
            </div>

            <div className="pref-section-body">
              <fieldset className="pref-fieldset">
                <legend className="pref-visually-hidden">Units</legend>
                <div className="pref-unit-grid">
                  {UNIT_OPTIONS.map((option) => {
                    const selected = units === option.value;
                    return (
                      <label
                        key={option.value}
                        className="pref-choice"
                        data-selected={selected ? 'true' : 'false'}
                      >
                        <input
                          type="radio"
                          name="pref-units"
                          value={option.value}
                          checked={selected}
                          onChange={() => handleUnitChange(option.value)}
                          className="pref-choice-input"
                          aria-label={option.radioLabel}
                        />
                        <span className="pref-unit-card">
                          <span className="pref-unit-top">
                            <span className="pref-unit-icon" aria-hidden="true">
                              <Icon name={option.icon} />
                            </span>
                            <span className="pref-choice-check pref-choice-check--inline" aria-hidden="true">
                              <Icon name="check" />
                            </span>
                          </span>
                          <span className="pref-unit-label">{option.label}</span>
                          <span className="pref-unit-meta">{option.meta}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="pref-subblock">
                <div className="pref-subhead">
                  <h3 className="pref-subtitle" id="pref-step-goal-title">Daily step goal</h3>
                  <span className="pref-goal-readout" aria-live="polite">
                    <span className="pref-visually-hidden">Current daily target: </span>
                    <strong>{Number(stepGoal).toLocaleString()}</strong>
                    <span>steps/day</span>
                  </span>
                </div>

                <div className="pref-goal-controls" role="group" aria-labelledby="pref-step-goal-title">
                  <div className="pref-preset-grid">
                    {GOAL_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="pref-preset"
                        aria-pressed={stepGoal === preset}
                        aria-label={`Set daily goal to ${preset.toLocaleString()} steps`}
                        onClick={() => handleGoalPreset(preset)}
                      >
                        {preset / 1000}k
                      </button>
                    ))}
                  </div>

                  <div className="pref-field">
                    <label className="pref-field-label" htmlFor="pref-step-goal">Custom goal</label>
                    <div className="pref-input-wrap">
                      <input
                        id="pref-step-goal"
                        className="pref-number-input"
                        type="number"
                        min="1000"
                        max="30000"
                        step="500"
                        inputMode="numeric"
                        value={stepGoalDraft}
                        aria-describedby="pref-step-goal-help"
                        onChange={(event) => setStepGoalDraft(event.target.value)}
                        onFocus={(event) => event.currentTarget.select()}
                        onBlur={commitStepGoal}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }
                        }}
                      />
                      <span className="pref-input-suffix" aria-hidden="true">steps</span>
                    </div>
                  </div>
                </div>

                <p className="pref-field-help" id="pref-step-goal-help">
                  1,000–30,000 steps. Saves when you leave the field.
                </p>
              </div>
            </div>
          </section>

          <section className="pref-section" aria-labelledby="pref-goal-setup-title">
            <div className="pref-section-head">
              <span className="pref-section-icon" aria-hidden="true">
                <Icon name="flag" />
              </span>
              <div className="pref-section-copy">
                <h2 id="pref-goal-setup-title">Goal setup</h2>
                <p>Your plan and target are managed from your Profile.</p>
              </div>
            </div>

            <div className="pref-section-body">
              <div className="pref-action-row">
                <div className="pref-action-copy">
                  <span className="pref-action-title">Goal and plan</span>
                  <span className="pref-action-desc">Review or edit the setup created during onboarding.</span>
                </div>
                <button type="button" className="pref-secondary" onClick={() => navigate(`${accountBase}/profile`)}>
                  Open Profile
                  <Icon name="arrow_forward" />
                </button>
              </div>
            </div>
          </section>

          <section className="pref-section" aria-labelledby="pref-reset-title">
            <div className="pref-section-head">
              <span className="pref-section-icon" aria-hidden="true">
                <Icon name="restart_alt" />
              </span>
              <div className="pref-section-copy">
                <h2 id="pref-reset-title">Reset preferences</h2>
                <p>Restore defaults without touching your activity, meals, or plans.</p>
              </div>
            </div>

            <div className="pref-section-body">
              <div className="pref-action-row">
                <div className="pref-action-copy">
                  <span className="pref-action-title">Restore defaults</span>
                  <span className="pref-action-desc">Metric units, 8,000 steps per day and the system theme.</span>
                </div>
                <button type="button" className="pref-reset" onClick={handleReset} disabled={saving}>
                  <Icon name="restart_alt" />
                  Reset to defaults
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AccountPageShell>
  );
};

export default Preferences;
