import React, { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import { Topbar } from '../../../components/index.js';
import SidebarAnalytics from '../../../components/SidebarAnalytics.jsx';
import { useAuth } from '../../../hooks/useAuth.jsx';
import 'leaflet/dist/leaflet.css';
import {
  RecenterMap, FitRoute, GpsBadge, HistoryTab, RouteReplay,
  RunAnalysisOverlay, RunControls, RunSummaryOverlay, StatsPanel, StatsTab,
} from '../components/index.js';

import { useToast }       from './../hooks/useToast.js';
import { useGeolocation } from "./../hooks/useGeoLocation.js";
import { useRunTimer }    from './../hooks/useRunTimer.js';
import { useRunControls } from './../hooks/useRunControl.js';
import { useActivityApi } from './../hooks/useActivityApi.js';
import { useWindowWidth } from './../hooks/useWindowWidth.js';
import { useTheme } from '../../../hooks/useTheme.js';
import { apiPost } from '../../../lib/apiClient.js';
import { safeGetJSON, safeSetJSON, safeRemove } from '../../../lib/storage.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const FALLBACK_COORDS   = [14.6760, 121.0437];
// Keyless providers: Esri Light Gray Canvas for light (the pale twin of the
// dark canvas — minimal gray streets), Esri Dark Gray Canvas
// for dark.
const TILE_URL_DARK     = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILE_URL_LIGHT    = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILE_ATTRIBUTION_DARK  = 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ';
const TILE_ATTRIBUTION_LIGHT = 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ';
// Vitalis identity for the activity section: green route + blue location dot.
// Route green (#43C85F) reads on both light and dark map tiles.
const ROUTE_GREEN = '#43C85F';
const STRAVA_BLUE = '#007AFF';
const OFFLINE_QUEUE_KEY = 'vitalis_offline_queue';

// ─── Offline queue helpers ────────────────────────────────────────────────────

const getOfflineQueue = () => safeGetJSON(OFFLINE_QUEUE_KEY, []);

const pushToOfflineQueue = (payload) => {
  const queue = getOfflineQueue();
  queue.push({ payload, queuedAt: Date.now() });
  safeSetJSON(OFFLINE_QUEUE_KEY, queue);
};

const clearOfflineQueue = () => safeRemove(OFFLINE_QUEUE_KEY);

// ─── Stable helpers (defined outside component to avoid re-creation) ──────────

const createUserIcon = () =>
  L.divIcon({
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `
      <div style="width:20px;height:20px;border-radius:50%;background:${STRAVA_BLUE};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,0.4);position:relative;">
        <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(0,122,255,0.2);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
      </div>
      <style>@keyframes ping{0%{transform:scale(1);opacity:1}75%{transform:scale(2);opacity:0}100%{transform:scale(2.5);opacity:0}}</style>
    `,
  });

const formatTime = (seconds) => {
  const s  = parseInt(seconds) || 0;
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`;
};

// ─── Component ────────────────────────────────────────────────────────────────

const ActivityMap = () => {
  const { user } = useAuth();
  const USER_ID  = user?.id ?? null;

  const [activeTab,       setActiveTab]       = useState('run');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [runAnalysis,     setRunAnalysis]     = useState(null);
  const [isOnline,        setIsOnline]        = useState(navigator.onLine);
  const [pendingCount,    setPendingCount]    = useState(() => getOfflineQueue().length);
  const [isRecordingState, setIsRecordingState] = useState(false);

  // Snapshot of finished-run data — populated from refs once run completes,
  // so JSX never reads .current during render (fixes eslint react-hooks/refs).
  const [finishedRun, setFinishedRun] = useState(null);

  const { isLargeScreen }    = useWindowWidth();
  const { showToast } = useToast();
  const { isDark } = useTheme();

  // Theme-aware map: Esri street map in light mode, Esri dark canvas in dark.
  // `key` on TileLayer forces Leaflet to swap the tile set on theme toggle.
  const tileUrl = isDark ? TILE_URL_DARK : TILE_URL_LIGHT;
  const tileAttribution = isDark ? TILE_ATTRIBUTION_DARK : TILE_ATTRIBUTION_LIGHT;
  const routeColor = ROUTE_GREEN;

  const { userLocation, startCoords, locationStatus, gpsLive, mapCenter, path, setPath, fixesRef, resetFixes } =
    useGeolocation(isRecordingState);

  const { metrics, splits, resetMetrics } =
    useRunTimer(isRecordingState, locationStatus, path, fixesRef);

  const {
    isRecording:      rc_isRecording,
    hasPaused:        rc_hasPaused,
    runFinished:      rc_runFinished,
    finishedPathRef:    rc_finishedPathRef,
    finishedMetricsRef: rc_finishedMetricsRef,
    finishedSplitsRef:  rc_finishedSplitsRef,
    handleStartRun:   rc_handleStartRun,
    handlePauseResume: rc_handlePauseResume,
    handleFinish:     rc_handleFinish,
    handleDiscard:    rc_handleDiscard,
  } = useRunControls({ userLocation, startCoords, metrics, path, splits, resetMetrics, setPath, resetFixes });

  // GPS-gated start: recording without location would fabricate distance,
  // so we refuse to start and explain why instead of simulating movement.
  const handleStartGated = useCallback(() => {
    if (locationStatus !== 'granted') {
      showToast(
        locationStatus === 'pending'
          ? '⏳ Waiting for GPS signal — try starting again in a few seconds.'
          : '📍 Location unavailable — enable location in browser settings to record a run.',
        'warn'
      );
      return;
    }
    rc_handleStartRun();
  }, [locationStatus, rc_handleStartRun, showToast]);

  // Sync recording state into geolocation / timer hooks
  useEffect(() => { setIsRecordingState(rc_isRecording); }, [rc_isRecording]);

  // When the run finishes, snapshot the ref values into state so JSX can read
  // them safely without accessing .current during render.
  useEffect(() => {
    if (rc_runFinished) {
      setFinishedRun({
        path:    rc_finishedPathRef.current,
        metrics: rc_finishedMetricsRef.current,
        splits:  rc_finishedSplitsRef.current,
      });
    } else {
      setFinishedRun(null);
    }
  }, [rc_runFinished, rc_finishedPathRef, rc_finishedMetricsRef, rc_finishedSplitsRef]);


  const {
    isSaving, history, historyLoading, historyError,
    stats, statsLoading, statsError,
    fetchHistory, handleSaveActivity, handleDelete, toggleKudos,
  } = useActivityApi({
    userId: USER_ID,
    activeTab,
    showToast,
    setRunAnalysis,
    onSaveSuccess: () => { rc_handleDiscard(FALLBACK_COORDS); setActiveTab('run'); },
  });

  // ─── Offline queue flush ────────────────────────────────────────────────────

  const flushOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue();
    if (!queue.length || !USER_ID) return;

    const remaining = [];

    for (const item of queue) {
      try {
        // Same auth/timeout/401 handling as online save (was raw fetch before).
        const data = await apiPost('/api/activity/save', item.payload, { timeoutMs: 15000 });
        // Only treat a successful response as flushed
        if (!data?.success) remaining.push(item);
      } catch {
        // Network error — keep this item and all subsequent ones
        remaining.push(item);
      }
    }

    if (remaining.length === 0) {
      clearOfflineQueue();
      setPendingCount(0);
      const synced = queue.length;
      showToast(`✓ ${synced} offline run${synced > 1 ? 's' : ''} synced!`);
    } else {
      safeSetJSON(OFFLINE_QUEUE_KEY, remaining);
      setPendingCount(remaining.length);
    }
  }, [USER_ID, showToast]);

  // ─── Online / offline listeners ────────────────────────────────────────────

  useEffect(() => {
    const goOnline  = async () => { setIsOnline(true); await flushOfflineQueue(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [flushOfflineQueue]);

  // ─── Save handler ───────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!finishedRun) return;
    const { metrics: m, path: route } = finishedRun;
    const distance = parseFloat((m.distance ?? 0).toFixed(2));
    // Honesty guard: with the GPS mock removed, a zero-distance run means no
    // real movement was recorded — refuse to persist it as a workout.
    if (!(distance > 0)) {
      showToast('No GPS movement recorded — move with location enabled to log a run.', 'error');
      return;
    }
    const isGps = locationStatus === 'granted';
    const payload = {
      duration: m.time,
      distance,
      pace:     m.pace,
      calories: m.calories,
      route,
      is_gps: isGps,
    };

    if (!isOnline) {
      pushToOfflineQueue(payload);
      setPendingCount(getOfflineQueue().length);
      showToast('📶 Offline — run saved locally, will sync when reconnected', 'warn');
      rc_handleDiscard(FALLBACK_COORDS);
      return;
    }

    await handleSaveActivity({
      finishedMetricsRef: rc_finishedMetricsRef,
      finishedPathRef:    rc_finishedPathRef,
      finishedSplitsRef:  rc_finishedSplitsRef,
      isGps: locationStatus === 'granted',
    });
  }, [
    finishedRun, isOnline, showToast, locationStatus,
    rc_finishedMetricsRef, rc_finishedPathRef, rc_finishedSplitsRef,
    rc_handleDiscard, handleSaveActivity,
  ]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-row bg-(--bg-primary) text-(--text-primary) overflow-hidden relative font-sans h-[100dvh]"
    >
      <div className="glass-content flex flex-1 min-w-0 min-h-0">
      <SidebarAnalytics onExpandChange={setSidebarExpanded} />

      {/* Right column: topbar + content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden pt-14 sm:pt-15 md:ml-[72px]">

        <Topbar sidebarExpanded={sidebarExpanded} userId={USER_ID} />

        {/* Offline banner */}
        {!isOnline && (
          <div className="z-50 flex items-center justify-center gap-2 bg-(--warning-bg) border-b border-(--warning) px-4 py-2 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-(--warning)" />
            <span className="text-[11px] font-black uppercase tracking-widest text-(--warning)">
              Offline — runs will sync when reconnected
              {pendingCount > 0 && ` · ${pendingCount} pending`}
            </span>
          </div>
        )}

        {/* Location banner — the map centers a default view until GPS is
            granted; say so explicitly instead of silently showing it. */}
        {locationStatus === 'denied' && (
          <div className="z-50 flex items-center justify-center gap-2 bg-(--warning-bg) border-b border-(--warning) px-4 py-2 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-(--warning)" />
            <span className="text-[11px] font-black uppercase tracking-widest text-(--warning)">
              Location blocked — enable GPS to map runs · showing default view
            </span>
          </div>
        )}

        {/* Syncing banner */}
        {isOnline && pendingCount > 0 && (
          <div className="z-50 flex items-center justify-center gap-2 bg-(--accent-bg) border-b border-(--accent-border) px-4 py-2 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-(--accent) animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest text-(--accent)">
              Syncing {pendingCount} offline run{pendingCount > 1 ? 's' : ''}…
            </span>
          </div>
        )}

        {/* Tab bar (hidden while viewing run summary) */}
        {!rc_runFinished && (
          <div className="flex border-b border-(--border-light) bg-(--bg-secondary) z-50 shrink-0">
            {['run', 'history', 'stats'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3.5 sm:py-3 text-[11px] sm:text-[12px] font-black uppercase tracking-[0.15em] border-b-2 transition-all min-h-[44px]
                  ${activeTab === tab
                    ? 'text-[var(--accent-dark)] border-[var(--accent-dark)] dark:text-[var(--accent)] dark:border-[var(--accent)]'
                    : 'text-(--text-disabled) border-transparent hover:text-(--text-muted)'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        <main className="flex-1 overflow-hidden relative min-h-0">

          {/* ── Replay / summary mode ── */}
          {rc_runFinished && finishedRun && (
            <div className="relative h-full w-full">
              <MapContainer
                center={finishedRun.path[0] ?? FALLBACK_COORDS}
                zoom={15}
                zoomControl={false}
                className="h-full w-full z-0 bg-[var(--bg-secondary)]"
              >
                <TileLayer key={isDark ? 'dark' : 'light'} url={tileUrl} attribution={tileAttribution} />
                <FitRoute path={finishedRun.path} />
                <RouteReplay fullPath={finishedRun.path} />
              </MapContainer>

              <RunSummaryOverlay
                metrics={finishedRun.metrics}
                splits={finishedRun.splits}
                formatTime={formatTime}
                route={finishedRun.path}
                onSave={handleSave}
                onDiscard={() => rc_handleDiscard(FALLBACK_COORDS)}
                isSaving={isSaving}
                isOnline={isOnline}
              />
            </div>
          )}

          {/* ── Run tab ── */}
          {!rc_runFinished && activeTab === 'run' && (
            <div className="flex h-full">
              <div className="flex-1 relative min-w-0 overflow-hidden">
                <MapContainer
                  center={mapCenter}
                  zoom={16}
                  zoomControl={false}
                  className="absolute inset-0 z-0 bg-[var(--bg-secondary)]"
                >
                  <TileLayer key={isDark ? 'dark' : 'light'} url={tileUrl} attribution={tileAttribution} />
                  {path.length > 1 && (
                    <>
                      {/* White casing under the route for pop */}
                      <Polyline
                        positions={path}
                        pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }}
                      />
                      <Polyline
                        positions={path}
                        pathOptions={{ color: routeColor, weight: 5, opacity: 1 }}
                      />
                    </>
                  )}
                  {userLocation && <Marker position={userLocation} icon={createUserIcon()} />}
                  <RecenterMap
                    coords={path}
                    isRecording={rc_isRecording}
                    userLocation={userLocation}
                  />
                </MapContainer>

                <GpsBadge locationStatus={locationStatus} gpsLive={gpsLive} />

                {isLargeScreen ? (
                  <RunControls
                    isRecording={rc_isRecording}
                    hasPaused={rc_hasPaused}
                    metricsTime={metrics.time}
                    onStart={handleStartGated}
                    onPauseResume={rc_handlePauseResume}
                    onFinish={rc_handleFinish}
                    gpsReady={locationStatus === 'granted'}
                  />
                ) : (
                  /* Single bottom stack: stats card above Start with a real
                     gap — the two can never overlap regardless of heights. */
                  <div
                    className="fixed left-0 right-0 z-[1000] px-3 flex flex-col items-stretch gap-2.5"
                    style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
                  >
                    <StatsPanel
                      metrics={metrics}
                      splits={splits}
                      formatTime={formatTime}
                      isDesktop={false}
                      bare
                    />
                    <div className="flex flex-col items-center gap-2">
                      <RunControls
                        isRecording={rc_isRecording}
                        hasPaused={rc_hasPaused}
                        metricsTime={metrics.time}
                        onStart={handleStartGated}
                        onPauseResume={rc_handlePauseResume}
                        onFinish={rc_handleFinish}
                        gpsReady={locationStatus === 'granted'}
                        bare
                      />
                    </div>
                  </div>
                )}
              </div>

              {isLargeScreen && (
                <StatsPanel
                  metrics={metrics}
                  splits={splits}
                  formatTime={formatTime}
                  isDesktop={true}
                />
              )}
            </div>
          )}

          {/* ── History tab ── */}
          {!rc_runFinished && activeTab === 'history' && (
            <HistoryTab
              history={history}
              historyLoading={historyLoading}
              historyError={historyError}
              formatTime={formatTime}
              onRefresh={fetchHistory}
              onDelete={handleDelete}
              onToggleKudos={toggleKudos}
              userName={user?.name}
            />
          )}

          {/* ── Stats tab ── */}
          {!rc_runFinished && activeTab === 'stats' && (
            <StatsTab
              stats={stats}
              statsLoading={statsLoading}
              statsError={statsError}
              formatTime={formatTime}
            />
          )}
        </main>
      </div>

      <RunAnalysisOverlay analysis={runAnalysis} onClose={() => setRunAnalysis(null)} />
      </div>
    </div>
  );
};

export default ActivityMap;