import React, { useId } from 'react';
import Icon from '../../../../components/Icon.jsx';
import { useToastStore } from '../../../../stores/toastStore.js';
import {
  activityTitle,
  formatShareDate,
  parseRoutePoints,
  renderShareCanvas,
  shareActivityImage,
} from '../utils/activityShare.js';

// Activity feed: one clean card per run, with the route as the visual anchor.
// Distance / time / pace stay scannable; social actions stay quiet.

const formatActivityDate = (created_at) => {
  const d = created_at ? new Date(created_at) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
};

const KudosButton = ({ active, count, onToggle }) => (
  <button
    onClick={onToggle}
    aria-pressed={active}
    aria-label="Give kudos"
    className={`am-kudos ${active ? 'is-active' : ''}`.trim()}
  >
    <Icon name="thumb_up" fill={active ? 1 : 0} />
    Kudos
    {count > 0 && <span className="am-kudos__count">{count}</span>}
  </button>
);

// Static SVG route thumbnail — route shape with zero map cost
// (no extra Leaflet instances). Downsamples long GPS tracks to ≤120 points.
const MAX_THUMB_POINTS = 120;

const RouteThumbnail = ({ route }) => {
  const patternId = `am-grid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const glowId = `am-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const pts = parseRoutePoints(route);
  if (pts.length < 2) return null;
  const step = Math.max(1, Math.ceil(pts.length / MAX_THUMB_POINTS));
  const sampled = pts.filter((_, i) => i % step === 0);
  if (sampled[sampled.length - 1] !== pts[pts.length - 1]) sampled.push(pts[pts.length - 1]);

  const lats = sampled.map((p) => p[0]);
  const lngs = sampled.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const W = 400;
  const H = 170;
  const PAD = 28;
  const spanLat = maxLat - minLat || 1e-6;
  const spanLng = maxLng - minLng || 1e-6;
  const x = (lng) => PAD + ((lng - minLng) / spanLng) * (W - PAD * 2);
  const y = (lat) => PAD + (1 - (lat - minLat) / spanLat) * (H - PAD * 2);
  const d = sampled
    .map(([lat, lng], i) => `${i === 0 ? 'M' : 'L'}${x(lng).toFixed(1)},${y(lat).toFixed(1)}`)
    .join(' ');
  const [sLat, sLng] = sampled[0];
  const [eLat, eLng] = sampled[sampled.length - 1];

  return (
    <div className="am-route">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="am-route__art"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="Route map"
      >
        <defs>
          <pattern id={patternId} width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M25 0H0v25" fill="none" stroke="var(--border-light)" strokeWidth="1" />
          </pattern>
          <radialGradient id={glowId}>
            <stop offset="0%" stopColor="#43C85F" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#43C85F" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#${patternId})`} opacity="0.42" />
        <circle cx={x(sLng)} cy={y(sLat)} r="80" fill={`url(#${glowId})`} />
        <path
          d={d}
          fill="none"
          stroke="#43C85F"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.12"
        />
        <path
          d={d}
          fill="none"
          stroke="#43C85F"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={x(sLng)} cy={y(sLat)} r="6.5" fill="#67d66d" stroke="#fff" strokeWidth="3" />
        <circle cx={x(eLng)} cy={y(eLat)} r="6.5" fill="#f0a24d" stroke="#fff" strokeWidth="3" />
      </svg>
      <span className="am-route__badge">
        <Icon name="near_me" />
        GPS route
      </span>
      <span className="am-route__legend">
        <i />
        Start
        <i className="end" />
        Finish
      </span>
    </div>
  );
};

const ActivityCard = ({
  activity,
  formatTime,
  userName,
  kudosOn,
  kudosCount,
  onToggleKudos,
  onShare,
  onDelete,
}) => {
  const calories = Number(activity.calories) || 0;

  return (
    <article className="am-activity">
      <div className="am-activity__head">
        <div className="am-avatar">{(userName || 'Y').charAt(0).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-bold text-[var(--text-primary)]">
            {userName || 'You'}
          </p>
          <p className="truncate text-[10px] font-medium text-[var(--text-muted)]">
            {formatActivityDate(activity.created_at)}
            {activity.is_gps === 0 && <span className="ml-1.5 font-semibold">· Manual</span>}
          </p>
        </div>
        <span className="am-run-chip">
          <Icon name="directions_run" />
          Run
        </span>
      </div>

      <div className="am-activity__title-row">
        <h3 className="am-activity__title">{activityTitle(activity.created_at)}</h3>
        {calories > 0 && <span className="am-activity__kcal">{calories} kcal</span>}
      </div>

      <div className="am-activity__stats">
        <div className="am-activity__stat">
          <span className="am-activity__stat-label">Distance</span>
          <span className="am-activity__stat-value">
            {parseFloat(activity.distance || 0).toFixed(2)}
            <span className="am-activity__stat-unit">km</span>
          </span>
        </div>
        <div className="am-activity__stat">
          <span className="am-activity__stat-label">Moving time</span>
          <span className="am-activity__stat-value">{formatTime(activity.duration)}</span>
        </div>
        <div className="am-activity__stat">
          <span className="am-activity__stat-label">Pace</span>
          <span className="am-activity__stat-value">
            {activity.pace || '–'}
            <span className="am-activity__stat-unit">/km</span>
          </span>
        </div>
      </div>

      <RouteThumbnail route={activity.route} />

      <footer className="am-activity__foot">
        <KudosButton active={kudosOn} count={kudosCount} onToggle={onToggleKudos} />
        <button
          onClick={onShare}
          aria-label="Share activity"
          title="Share activity"
          className="am-icon-btn am-icon-btn--sm"
        >
          <Icon name="ios_share" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(activity.id)}
          aria-label="Delete activity"
          title="Delete activity"
          className="am-activity__delete"
        >
          <Icon name="delete" />
        </button>
      </footer>
    </article>
  );
};

const HistorySkeleton = () => (
  <div className="am-feed" aria-busy="true" aria-label="Loading activities">
    {[0, 1].map((i) => (
      <div className="am-skel-card" key={i}>
        <div className="flex items-center gap-3">
          <div className="am-skel-line" style={{ width: 40, height: 40, borderRadius: 999, margin: 0 }} />
          <div className="flex-1">
            <div className="am-skel-line" style={{ width: '38%' }} />
            <div className="am-skel-line am-skel-line--sm" style={{ marginBottom: 0 }} />
          </div>
        </div>
        <div className="am-skel-line am-skel-line--lg" style={{ marginTop: 20 }} />
        <div className="am-skel-line" style={{ width: '100%', height: 54, marginTop: 14, borderRadius: 16 }} />
        <div className="am-skel-line am-skel-line--route" />
      </div>
    ))}
  </div>
);

const HistoryTab = ({
  history,
  historyLoading,
  historyError,
  formatTime,
  onRefresh,
  onDelete,
  onToggleKudos,
  userName,
}) => {
  const handleShare = async (activity) => {
    try {
      const canvas = renderShareCanvas({
        title: activityTitle(activity.created_at),
        dateStr: formatShareDate(activity.created_at),
        distanceKm: activity.distance,
        durationSec: activity.duration,
        pace: activity.pace,
        route: activity.route,
      });
      const slug = activityTitle(activity.created_at).toLowerCase().replace(/\s+/g, '-');
      const result = await shareActivityImage(canvas, {
        filename: `vitalis-${slug}.png`,
        title: activityTitle(activity.created_at),
        text: `${activityTitle(activity.created_at)} — ${parseFloat(activity.distance || 0).toFixed(2)} km on Vitalis`,
      });
      useToastStore
        .getState()
        .addToast(
          result === 'shared' ? 'Shared!' : 'Image downloaded — share it anywhere.',
          'success'
        );
    } catch (err) {
      if (err?.name === 'AbortError') return; // user dismissed the sheet
      useToastStore.getState().addToast('Could not create share image.', 'error');
    }
  };

  const refreshButton = (
    <button
      type="button"
      onClick={onRefresh}
      disabled={historyLoading}
      aria-label="Refresh activity history"
      title="Refresh activity history"
      className="am-icon-btn disabled:opacity-50"
    >
      <Icon name="refresh" className={historyLoading ? 'animate-spin' : ''} />
    </button>
  );

  return (
    <div className="am-scroll">
      <div className="am-tabpage am-tabpage--feed">
        <header className="am-tabpage__head">
          <div>
            <p className="am-eyebrow">Activity feed</p>
            <h2 className="am-tabpage__title">Recent runs</h2>
            <p className="am-tabpage__sub">
              Your latest routes, mileage and the kudos that came with them.
            </p>
          </div>
          <div className="am-tabpage__actions">
            {history.length > 0 && (
              <span className="am-chip hidden sm:inline-flex">
                {history.length} {history.length === 1 ? 'activity' : 'activities'}
              </span>
            )}
            {refreshButton}
          </div>
        </header>

        {historyLoading && history.length === 0 && <HistorySkeleton />}

        {historyError && (
          <div className="am-empty">
            <span
              className="am-empty__icon"
              style={{
                borderColor: 'color-mix(in srgb, var(--error) 30%, transparent)',
                background: 'var(--error-bg)',
                color: 'var(--error)',
              }}
            >
              <Icon name="cloud_off" />
            </span>
            <p className="am-empty__title">Could not load your activities</p>
            <p className="am-empty__text">⚠ {historyError}. Check your connection and refresh.</p>
          </div>
        )}

        {!historyLoading && !historyError && history.length === 0 && (
          <div className="am-empty">
            <span className="am-empty__icon">
              <Icon name="directions_run" />
            </span>
            <p className="am-empty__title">No activities yet</p>
            <p className="am-empty__text">
              Record your first run from the map. Your route, pace and splits will show up here.
            </p>
          </div>
        )}

        {!historyError && history.length > 0 && (
          <div className="am-feed">
            {history.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                formatTime={formatTime}
                userName={userName}
                kudosOn={!!activity.kudos_given}
                kudosCount={Number(activity.kudos_count) || 0}
                onToggleKudos={() => onToggleKudos?.(activity.id)}
                onShare={() => handleShare(activity)}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryTab;
