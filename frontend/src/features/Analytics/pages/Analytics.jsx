import React from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.jsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import ErrorState from '../../../components/feedback/ErrorState.jsx';
import { useAnalyticsState } from '../hooks/useAnalyticsState.js';
import { useAnalyticsData } from '../hooks/useAnalyticsData.js';
import { useSleepActions } from '../hooks/useSleepActions.js';
import { getSleepStatusReal } from '../utils/sleepScore.js';
import { SidebarAnalytics, BottomNav, Topbar } from '../../../components/index.js';
import Icon from '../../../components/Icon.jsx';
import CheckInModal from '../../Dashboard/components/CheckInModal.jsx';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);


import { PageHeader } from '../components/PageHeader.jsx';
import RecoveryPanel from '../components/RecoveryPanel.jsx';
import { ProgressHeader, ProgressPanel } from '../components/ProgressPanels.jsx';
import SleepSyncCard, { SleepScatterChart } from '../components/SleepPanels.jsx';
import DistributionZones from '../components/DistributionZones.jsx';

// INNER PAGE — hooks called unconditionally
function AnalyticsInner({ USER_ID }) {
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = React.useState(false);
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = React.useState(
    ['training', 'recovery', 'progress'].includes(initialTab) ? initialTab : 'training'
  );
  const focusTarget = searchParams.get('focus');

  // Deep-link from Quick Log (?tab=training&focus=sleep): jump to the sleep form.
  React.useEffect(() => {
    if (focusTarget !== 'sleep') return;
    const t = setTimeout(() => {
      document.getElementById('sleep-log-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    return () => clearTimeout(t);
  }, [focusTarget, activeTab]);

  const {
    timeframe, setTimeframe,
    sleepHours, setSleepHours,
    sleepQuality, setSleepQuality,
    waterIntake, setWaterIntake,
    scatterData, setScatterData,
    zones, setZones,
    zonesLoading, setZonesLoading,
    saveStatus, setSaveStatus,
    saveTimerRef,
  } = useAnalyticsState();

  
  const { loadSleepAndScatter } = useAnalyticsData({
    USER_ID, timeframe,
    setZones, setZonesLoading,
    setScatterData, setSleepHours,
    setSleepQuality, setWaterIntake,
  });

  const sleepStatus = getSleepStatusReal(sleepHours, sleepQuality);

  const { handleSaveSleep } = useSleepActions({
    USER_ID, sleepHours, sleepQuality,
    waterIntake, sleepStatus, setSaveStatus,
    loadSleepAndScatter, // FIX: was () => {} — now actually refreshes chart + score after save
    saveTimerRef,
  });

  return (
    <div className="flex flex-col md:flex-row min-h-dvh bg-(--bg-primary) text-(--text-primary) font-sans selection:bg-(--accent) selection:text-[var(--text-inverse)] relative">
      <div className="glass-content flex-1 min-w-0">
      <SidebarAnalytics onExpandChange={setSidebarExpanded} />
      <div className="md:hidden">
        <BottomNav variant="biometrics" />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0 md:ml-[72px]">
        <Topbar sidebarExpanded={sidebarExpanded} userId={USER_ID} />

        <main className="pt-14 md:pt-16 p-4 sm:p-6 md:p-8 lg:p-12 w-full max-w-[1400px] 2xl:max-w-[1536px] mx-auto">
          {activeTab === 'progress' ? (
            <ProgressHeader timeframe={timeframe} setTimeframe={setTimeframe} onBack={() => setActiveTab('training')} />
          ) : (
            <PageHeader timeframe={timeframe} setTimeframe={setTimeframe} activeTab={activeTab} setActiveTab={setActiveTab} />
          )}

          {activeTab === 'training' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
              <SleepScatterChart scatterData={scatterData} sleepHours={sleepHours} sleepQuality={sleepQuality} />
              <div id="sleep-log-form" className="contents">
              <SleepSyncCard
                sleepHours={sleepHours}       setSleepHours={setSleepHours}
                sleepQuality={sleepQuality}   setSleepQuality={setSleepQuality}
                waterIntake={waterIntake}     setWaterIntake={setWaterIntake}
                sleepStatus={sleepStatus}     saveStatus={saveStatus}
                onSave={handleSaveSleep}
              />
              </div>
              <DistributionZones zones={zones} zonesLoading={zonesLoading} />
            </div>
          )}
          {activeTab === 'recovery' && <RecoveryPanel userId={USER_ID} />}
          {activeTab === 'progress' && <ProgressPanel userId={USER_ID} navigate={navigate} />}
        </main>
      </div>
      </div>
    </div>
  );
}


// MAIN PAGE — guards only, no hooks


const Analytics = () => {
  const { user, loading } = useAuth();
  const USER_ID = user?.id;

  if (loading) {
    return (
      <div className="flex min-h-dvh bg-(--bg-primary) items-center justify-center">
        <span className="text-(--accent) text-[11px] font-black uppercase tracking-widest animate-pulse">
          Loading...
        </span>
      </div>
    );
  }

  if (!USER_ID) return <Navigate to="/login" replace />;

  return <AnalyticsInner USER_ID={USER_ID} />;
};

export default Analytics;