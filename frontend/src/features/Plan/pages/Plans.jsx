import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { BottomNav, Sidebar, Topbar } from '../../../components/index.js';
import Icon from '../../../components/Icon.jsx';
import usePlans from '../hooks/usePlan.js';
import Dropdown from '../../../components/ui/Dropdown.jsx';
import {
  REST_ACTIVITY_TYPES,
  INTENSITY_OPTIONS,
  FOCUS_OPTIONS,
  DURATION_OPTIONS,
  CATEGORIES,
  TABS,
} from '../utils/planFormat.js';
import { PlanCover, FilterPill, PlanCard, TabBar } from '../components/PlanWidgets.jsx';
import PersonalPlanSheet from '../components/PersonalPlanSheet.jsx';
import ExerciseLibrary from '../components/ExerciseLibrary.jsx';
import WorkoutHistory from '../components/WorkoutHistory.jsx';
import PlanDetailOverlay from '../components/PlanDetailOverlay.jsx';
import DayTracker from '../components/DayTracker.jsx';
import { GoalLinkBanner, MyPlans, FindPlan, Explore } from '../components/PlansSections.jsx';

// MAIN PLANS PAGE COMPONENT
const Plans = () => {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') || 'explore'
  );

  const {
    loading, authError, actionError, actionOk, acting, reload, trainingPlans, enrolledCount, goalStatus,
    detailPlan, trackerPlan, trackerContent, trackerProgress,
    setDetailPlan, setActionError, setActionOk, handleEnroll, createPersonal, updatePersonal, autoFromGoal, removePersonal, startTracker, handleCompleteDay, closeTracker,
  } = usePlans();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  const openCreate = () => { setActionError(null); setActionOk(null); setEditingPlan(null); setSheetOpen(true); };
  const openEdit = (plan) => {
    if (!plan || plan.is_owner !== 1) return;
    setActionError(null); setActionOk(null); setEditingPlan(plan); setSheetOpen(true);
  };
  const closeSheet = () => { setSheetOpen(false); setEditingPlan(null); };
  const handleSaveEdit = async (planId, patch) => {
    const saved = await updatePersonal(planId, patch);
    if (saved) closeSheet();
    return saved;
  };

  // Mount-only URL cleanup; reacting to searchParams identity would re-run on every navigation.
  useEffect(() => {
    if (searchParams.get('tab')) {
      setSearchParams({}, { replace: true });
    }
    if (searchParams.get('mine') === '1') {
      setActiveTab('my-plans');
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-shot deep-link: openTracker navigation opens the tracker once. startTracker
  // is intentionally excluded — it is re-created per render and would re-trigger this.
  useEffect(() => {
    const openTrackerId = location.state?.openTracker;
    if (!openTrackerId || loading || trainingPlans.length === 0) return;
    const plan = trainingPlans.find(p => String(p.id) === String(openTrackerId));
    if (plan) {
      setActiveTab('my-plans');
      startTracker(plan);
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.openTracker, trainingPlans, loading]);

  const requestedPlanId = searchParams.get('planId');
  const autoOpenedRef   = useRef(false);
  useEffect(() => {
    if (!requestedPlanId || autoOpenedRef.current || loading) return;
    const match = trainingPlans.find(p => String(p.id) === String(requestedPlanId));
    if (match) {
      setDetailPlan(match);
      autoOpenedRef.current = true;
      setSearchParams({}, { replace: true });
    }
  }, [requestedPlanId, trainingPlans, loading, setDetailPlan, setSearchParams]);

  const handleEnrollAndSwitch = async (planId) => {
    await handleEnroll(planId);
    setActiveTab('my-plans');
  };

  const handleGenerateAndSwitch = async () => {
    const data = await autoFromGoal();
    if (data?.planId) setActiveTab('my-plans');
  };

  const handleDelete = async (plan) => {
    if (!plan || plan.is_owner !== 1) return;
    if (!window.confirm(`Delete "${plan.title}"? This removes its days and progress.`)) return;
    await removePersonal(plan.id);
  };

  return (
    <div className="min-h-screen relative bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
      <div className="glass-content">
      <div className="hidden md:block">
        <Sidebar expanded={sidebarExpanded} setExpanded={setSidebarExpanded} />
      </div>
      <Topbar sidebarExpanded={sidebarExpanded} onMenu={() => setSidebarExpanded(v => !v)} />
      <main
        className={`pt-[56px] pb-24 md:pb-12 px-4 sm:px-6 md:px-8 lg:px-10 min-h-screen transition-all duration-[400ms] ${sidebarExpanded ? 'md:ml-60' : 'md:ml-18'}`}
      >
        <div className="max-w-7xl mx-auto pt-4 min-w-0">
          <header className="mb-6 sm:mb-8 flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1 sm:space-y-1.5 min-w-0">
              <span className="text-[10px] sm:text-xs font-bold tracking-[0.3em] uppercase" style={{ color: 'var(--accent)' }}>
                Training Store
              </span>
              <h1 className="text-[28px] leading-[1.05] sm:text-4xl md:text-5xl font-extrabold tracking-tight text-balance" style={{ color: 'var(--text-primary)' }}>
                Performance{' '}
                <span style={{ color: 'var(--text-muted)' }}>Blueprints</span>
              </h1>
            </div>
            <div className="flex flex-col min-[480px]:flex-row min-[480px]:items-center gap-2 sm:gap-3 lg:self-auto">
              {enrolledCount > 0 && (
                <div
                  className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2.5 border self-start min-[480px]:self-auto"
                  style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' }}
                >
                  <Icon name="trophy" className="text-[18px] shrink-0" style={{ color: 'var(--accent)' }} fill={1} />
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                    {enrolledCount} plan{enrolledCount !== 1 ? 's' : ''} active
                  </span>
                </div>
              )}
              <button
                onClick={openCreate}
                className="h-11 min-h-[44px] px-5 rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[12px] font-bold w-full min-[480px]:w-auto hover:brightness-110 active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                + New plan
              </button>
            </div>
          </header>

          <TabBar active={activeTab} onChange={setActiveTab} enrolledCount={enrolledCount} />

          {actionError ? (
            <p role="alert" className="mb-4 rounded-xl border border-[var(--border-medium)] bg-[var(--error-bg)] px-4 py-2.5 text-[12px] font-semibold text-[var(--error)]">{actionError}</p>
          ) : null}
          {actionOk ? (
            <p role="status" className="mb-4 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-bg)] px-4 py-2.5 text-[12px] font-semibold" style={{ color: 'var(--accent)' }}>{actionOk}</p>
          ) : null}

          {loading ? (
            <div className="py-16 sm:py-20 text-center animate-pulse text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Synchronizing Blueprints...
            </div>
          ) : authError ? (
            <div className="flex flex-col items-center py-16 sm:py-20 gap-3 text-center" role="alert">
              <Icon name="error" className="text-[36px] sm:text-[40px]" style={{ color: 'var(--error)' }} />
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Couldn't load your blueprints</p>
              <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>{authError}</p>
              <button onClick={reload} className="mt-1 h-10 px-5 rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[12px] font-bold hover:brightness-110 active:scale-95 transition-all">
                Try again
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'my-plans' && (
                <MyPlans
                  plans={trainingPlans}
                  goalStatus={goalStatus}
                  onOpen={setDetailPlan}
                  onContinue={startTracker}
                  onCreateClick={openCreate}
                  onGenerate={handleGenerateAndSwitch}
                  onDelete={handleDelete}
                  onEdit={openEdit}
                  generating={acting}
                />
              )}
              {activeTab === 'find'     && <FindPlan plans={trainingPlans} onOpen={setDetailPlan} onEnroll={handleEnrollAndSwitch} onContinue={startTracker} />}
              {activeTab === 'explore'  && <Explore  plans={trainingPlans} onOpen={setDetailPlan} onEnroll={handleEnrollAndSwitch} onContinue={startTracker} />}
              {activeTab === 'library'  && <ExerciseLibrary />}
              {activeTab === 'history'  && <WorkoutHistory />}
            </>
          )}
        </div>
      </main>

      {detailPlan && (
        <PlanDetailOverlay
          plan={detailPlan}
          onClose={() => setDetailPlan(null)}
          onStart={() => {
            if (detailPlan.is_enrolled === 1) {
              startTracker(detailPlan);
            } else {
              handleEnrollAndSwitch(detailPlan.id);
              setDetailPlan(null);
            }
          }}
        />
      )}

      {trackerPlan && (
        <DayTracker
          plan={trackerPlan}
          content={trackerContent}
          progress={trackerProgress}
          onClose={closeTracker}
          onCompleteDay={handleCompleteDay}
        />
      )}

      <PersonalPlanSheet
        key={editingPlan ? `edit-${editingPlan.id}` : (sheetOpen ? 'open' : 'closed')}
        open={sheetOpen}
        onClose={closeSheet}
        acting={acting}
        error={actionError}
        onCreate={createPersonal}
        onGenerate={autoFromGoal}
        initial={editingPlan}
        onSave={handleSaveEdit}
        activeGoalKey={goalStatus?.goal?.goalType}
      />

      <div className="md:hidden"><BottomNav variant="biometrics" /></div>

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        input::placeholder { color: var(--text-muted); opacity: 1; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      </div>
    </div>
  );
};

export default Plans;