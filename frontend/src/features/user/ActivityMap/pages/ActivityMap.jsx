import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import { BottomNav } from '../../../../components/index.js';
import AppShell from '../../../../components/AppShell.jsx';
import Icon from '../../../../components/Icon.jsx';
import { useAuth } from '../../../../hooks/useAuth.jsx';
import 'leaflet/dist/leaflet.css';
import '../activity-map.css';
import {
  RecenterMap, FitRoute, GpsBadge, HistoryTab, RouteReplay,
  RunAnalysisOverlay, RunControls, RunSummaryOverlay, StatsPanel, StatsTab,
  MapResizer, RecenterButton, LocationNotice,
} from '../components/index.js';

import { useToast }       from './../hooks/useToast.js';
import { useGeolocation, DEFAULT_MAP_CENTER } from "./../hooks/useGeoLocation.js";
import { useRunTimer }    from './../hooks/useRunTimer.js';
import { useRunControls } from './../hooks/useRunControl.js';
import { useActivityApi } from './../hooks/useActivityApi.js';
import { useWindowWidth } from './../hooks/useWindowWidth.js';
import { useTheme } from '../../../../hooks/useTheme.js';
import { apiPost } from '../../../../lib/apiClient.js';
import { safeGetJSON, safeSetJSON, safeRemove } from '../../../../lib/storage.js';

// ─── Constants ───────────────────────────────────────────────────────────────

// Esri World_*_Gray_Base only serves native tiles up to zoom 16. Beyond that
// Leaflet upscales (maxNativeZoom) instead of requesting 404s → no grey tiles.
const TILE_MAX_NATIVE_ZOOM = 16;
const TILE_MAX_ZOOM        = 19;
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

const ACTIVITY_TABS = [
  { id: 'run', label: 'Run', icon: 'route' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'stats', label: 'Progress', icon: 'insights' },
];

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

  const [activeTab,       setActiveTabState]   = useState(() => {
    const s = new URLSearchParams(window.location.search).get('section');
    return ['run', 'history', 'stats'].includes(s) ? s : 'run';
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === 'run') next.delete('section');
    else next.set('section', tab);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
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

  const {
    userLocation, startCoords, locationStatus, locationAccuracy, locationError,
    mapCenter, path, setPath, retry: retryLocation,
  } = useGeolocation(isRecordingState);

  const { metrics, splits, resetMetrics } =
    useRunTimer(isRecordingState, locationStatus, path);

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
  } = useRunControls({ userLocation, startCoords, metrics, path, splits, resetMetrics, setPath });

  // Auto-follow the camera during a run; a manual pan turns it off.
  const [follow, setFollow] = useState(true);
  const handleMapInteract = useCallback(() => setFollow(false), []);

  // User location marker icon is stable — build it once.
  const userIcon = useMemo(() => createUserIcon(), []);

  // GPS-gated start: recording without location would fabricate distance,
  // so we refuse to start and explain why instead of simulating movement.
  const handleStartGated = useCallback(() => {
    if (locationStatus !== 'granted') {
      showToast(
        locationStatus === 'pending'
          ? '⏳ Waiting for GPS signal — try starting again in a few seconds.'
          : '📍 Location unavailable — enable location in your browser settings to record a run.',
        'warn'
      );
      return;
    }
    setFollow(true);
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
    onSaveSuccess: () => { rc_handleDiscard(DEFAULT_MAP_CENTER); setActiveTab('run'); },
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
      rc_handleDiscard(DEFAULT_MAP_CENTER);
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

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const runControls = (
    <RunControls
      isRecording={rc_isRecording}
      hasPaused={rc_hasPaused}
      metricsTime={metrics.time}
      onStart={handleStartGated}
      onPauseResume={rc_handlePauseResume}
      onFinish={rc_handleFinish}
      gpsReady={locationStatus === 'granted'}
    />
  );

  return (
    <AppShell
      userId={USER_ID}
      mobileTitle="Activity Map"
      mainClassName="app-main--workbench"
      contentClassName="app-workbench"
      bottomNav={<BottomNav />}
    >
      <div className="am-page">

        {/* Offline banner */}
        {!isOnline && (
          <div className="am-banner am-banner--warn">
            <Icon name="wifi_off" className="text-[14px]" />
            <span>
              Offline — runs will sync when reconnected
              {pendingCount > 0 && ` · ${pendingCount} pending`}
            </span>
          </div>
        )}

        {/* Syncing banner */}
        {isOnline && pendingCount > 0 && (
          <div className="am-banner am-banner--sync">
            <Icon name="sync" className="animate-spin text-[14px]" />
            <span>
              Syncing {pendingCount} offline run{pendingCount > 1 ? 's' : ''}…
            </span>
          </div>
        )}

        {/* Workspace header — hidden while the post-run summary is open */}
        {!rc_runFinished && (
          <header className="am-header">
            <div className="am-header__identity">
              <span className="am-header__icon">
                <Icon name="route" />
              </span>
              <div className="min-w-0">
                <p className="am-eyebrow">Movement</p>
                <h1 className="am-title">Activity <em>map</em></h1>
                <p className="am-header__sub">Record routes. Watch the progress add up.</p>
              </div>
            </div>

            <div className="am-tabs" role="tablist" aria-label="Activity views">
              {ACTIVITY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="am-tab"
                >
                  <Icon name={tab.icon} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="am-header__aside">
              <Icon name="calendar_today" />
              {todayLabel}
            </div>
          </header>
        )}

        <main className="am-main">

          {/* ── Replay / summary mode ── */}
          {rc_runFinished && finishedRun && (
            <div className="relative h-full w-full">
              <MapContainer
                center={finishedRun.path[0] ?? DEFAULT_MAP_CENTER}
                zoom={15}
                zoomControl={false}
                className="h-full w-full z-0"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <TileLayer
                  key={isDark ? 'dark' : 'light'}
                  url={tileUrl}
                  attribution={tileAttribution}
                  maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
                  maxZoom={TILE_MAX_ZOOM}
                />
                <MapResizer />
                <FitRoute path={finishedRun.path} />
                <RouteReplay fullPath={finishedRun.path} />
              </MapContainer>

              <RunSummaryOverlay
                metrics={finishedRun.metrics}
                splits={finishedRun.splits}
                formatTime={formatTime}
                route={finishedRun.path}
                onSave={handleSave}
                onDiscard={() => rc_handleDiscard(DEFAULT_MAP_CENTER)}
                isSaving={isSaving}
              />
            </div>
          )}

          {/* ── Run tab ── */}
          {!rc_runFinished && activeTab === 'run' && (
            <div className="am-workspace">
              <div className="am-map-card">
                <MapContainer
                  center={/** @type {any} */ (mapCenter)}
                  zoom={userLocation ? 16 : 3}
                  zoomControl={false}
                  className="z-0"
                  style={{ background: 'var(--bg-secondary)' }}
                >
                  <TileLayer
                    key={isDark ? 'dark' : 'light'}
                    url={tileUrl}
                    attribution={tileAttribution}
                    maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
                    maxZoom={TILE_MAX_ZOOM}
                  />
                  <MapResizer />
                  {path.length > 1 && (
                    <>
                      {/* Soft glow beneath the line makes the route feel alive. */}
                      <Polyline
                        positions={path}
                        pathOptions={{ color: routeColor, weight: 16, opacity: 0.16, lineCap: 'round' }}
                      />
                      {/* White casing under the route for pop */}
                      <Polyline
                        positions={path}
                        pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9, lineCap: 'round' }}
                      />
                      <Polyline
                        positions={path}
                        pathOptions={{ color: routeColor, weight: 5, opacity: 1, lineCap: 'round' }}
                      />
                    </>
                  )}
                  {userLocation && <Marker position={userLocation} icon={userIcon} />}
                  <RecenterMap
                    lastPoint={userLocation}
                    isRecording={rc_isRecording}
                    follow={follow}
                    onUserInteract={handleMapInteract}
                  />
                  <RecenterButton
                    userLocation={userLocation}
                    onRecenter={() => setFollow(true)}
                  />
                </MapContainer>

                <div className="am-map-scrim am-map-scrim--top" aria-hidden="true" />
                <div className="am-map-scrim am-map-scrim--bottom" aria-hidden="true" />

                <GpsBadge
                  locationStatus={locationStatus}
                  accuracy={locationAccuracy}
                  coords={userLocation}
                />

                {rc_isRecording && (
                  <div className={`am-rec am-map-chip ${rc_hasPaused ? 'is-paused' : ''}`.trim()}>
                    <span className="am-rec__dot" />
                    {rc_hasPaused ? 'Paused' : `Rec ${formatTime(metrics.time)}`}
                  </div>
                )}

                <LocationNotice
                  status={locationStatus}
                  error={locationError}
                  onRetry={retryLocation}
                />
              </div>

              {isLargeScreen && (
                <StatsPanel
                  metrics={metrics}
                  splits={splits}
                  formatTime={formatTime}
                  isDesktop
                  controls={runControls}
                  isRecording={rc_isRecording}
                  paused={rc_hasPaused}
                  gpsReady={locationStatus === 'granted'}
                  accuracy={locationAccuracy}
                />
              )}

              {!isLargeScreen && (
                <div className="am-mobile-console">
                  <StatsPanel
                    metrics={metrics}
                    splits={splits}
                    formatTime={formatTime}
                    controls={runControls}
                    isRecording={rc_isRecording}
                    paused={rc_hasPaused}
                    gpsReady={locationStatus === 'granted'}
                    accuracy={locationAccuracy}
                  />
                </div>
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
    </AppShell>
  );
};

export default ActivityMap;