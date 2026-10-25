// ProgressOverviewChart — the Logs page's cross-metric progress line.
//
// Premium Chart.js card: metric switcher (activity / weight / calories /
// protein / waist), adaptive range chips (30D · 90D · 1Y · All) and a
// gradient line. Every point comes from real logs via
// GET /api/progress/overview?range=… — nutrition is average-per-logged-day,
// body metrics keep the last measurement, activity is summed active minutes.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import Icon from '../../../../components/Icon.jsx';
import { apiFetch } from '../../../../lib/apiClient.js';
import './progressOverview.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const RANGES = [
  { key: '30d', label: '30D', caption: 'Last 30 days' },
  { key: '90d', label: '90D', caption: 'Last 90 days' },
  { key: '1y', label: '1Y', caption: 'Last year' },
  { key: 'all', label: 'All', caption: 'All time' },
];

const METRICS = [
  { key: 'minutes', label: 'Active minutes', short: 'Minutes', icon: 'timer', unit: 'min' },
  { key: 'weight', label: 'Weight', short: 'Weight', icon: 'monitor_weight', unit: 'kg' },
  { key: 'calories', label: 'Calories', short: 'Calories', icon: 'local_fire_department', unit: 'kcal' },
  { key: 'protein', label: 'Protein', short: 'Protein', icon: 'restaurant', unit: 'g' },
  { key: 'waist', label: 'Waist', short: 'Waist', icon: 'straighten', unit: 'cm' },
];

const BUCKET_WORD = { day: 'day', week: 'week', month: 'month' };
const BUCKET_CAPTION = { day: 'Daily', week: 'Weekly', month: 'Monthly' };

const FALLBACK_PALETTE = {
  accent: '#c7f464',
  card: '#141a12',
  text: '#f1f5ea',
  muted: '#8e9a86',
  border: 'rgba(43, 56, 38, 0.7)',
};

const fmtNum = (value, decimals = 0) => Number(value).toLocaleString('en-US', {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
});

const fmtShortDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const fmtValue = (key, value) => {
  if (value == null) return '—';
  if (key === 'weight' || key === 'waist') return Number(value).toFixed(1);
  return Math.round(value).toLocaleString('en-US');
};

const fmtAxis = (key, value) => {
  if (key === 'weight' || key === 'waist') return Number(value).toFixed(1);
  if (key === 'calories' && Number(value) >= 1000) return `${(Number(value) / 1000).toFixed(1)}k`;
  return Math.round(Number(value)).toLocaleString('en-US');
};

const fmtChange = (change, unit) => {
  if (change == null) return null;
  if (change === 0) return 'No change';
  return `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(1)} ${unit}`;
};

// Chart.js needs concrete colors; CSS variables are resolved at runtime and
// refreshed when the theme attribute / OS color scheme changes.
function readPalette() {
  if (typeof window === 'undefined') return FALLBACK_PALETTE;
  const css = getComputedStyle(document.documentElement);
  const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    accent: get('--accent', FALLBACK_PALETTE.accent),
    card: get('--bg-card', FALLBACK_PALETTE.card),
    text: get('--text-primary', FALLBACK_PALETTE.text),
    muted: get('--text-muted', FALLBACK_PALETTE.muted),
    border: get('--border-light', FALLBACK_PALETTE.border),
  };
}

function usePalette() {
  const [palette, setPalette] = useState(readPalette);

  useEffect(() => {
    const update = () => setPalette(readPalette());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    if (media.addEventListener) media.addEventListener('change', update);
    return () => {
      observer.disconnect();
      if (media.removeEventListener) media.removeEventListener('change', update);
    };
  }, []);

  return palette;
}

function withAlpha(color, alpha) {
  const value = String(color || '').trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    let raw = hex[1];
    if (raw.length === 3) raw = raw.split('').map((c) => c + c).join('');
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  return value;
}

export default function ProgressOverviewChart({ userId }) {
  const [range, setRange] = useState('90d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metricKey, setMetricKey] = useState('minutes');
  const palette = usePalette();
  const cacheRef = useRef(new Map());
  const requestRef = useRef(0);
  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const load = useCallback(async (force = false) => {
    if (!userId) return;
    const requestId = ++requestRef.current;
    const cacheKey = `${userId}:${range}`;

    // Switching back to a range already loaded this visit is instant.
    if (!force) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setData(cached);
        setError(null);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/progress/overview?range=${range}`);
      if (requestId !== requestRef.current) return;
      cacheRef.current.set(cacheKey, res);
      setData(res);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err.message || 'Could not load your progress.');
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [userId, range]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  const reload = useCallback(() => {
    load(true);
  }, [load]);

  const metrics = data?.metrics || null;
  const metric = metrics?.[metricKey] || null;
  const series = useMemo(() => metric?.points || [], [metric]);
  const metricMeta = METRICS.find((m) => m.key === metricKey) || METRICS[0];
  const rangeMeta = RANGES.find((r) => r.key === range) || RANGES[1];

  const hasData = Boolean(metric) && (
    metricKey === 'minutes'
      ? Number(metric.total) > 0
      : metricKey === 'calories' || metricKey === 'protein'
        ? Number(metric.loggedDays) > 0
        : Number(metric.count) > 0
  );

  const chipValue = (key, value) => {
    if (!value) return '—';
    if (key === 'minutes') return Number(value.total) > 0 ? `${fmtNum(value.total)} min` : '—';
    if (key === 'calories' || key === 'protein') {
      return value.avg != null ? `${fmtNum(value.avg)} ${value.unit}` : '—';
    }
    return value.latest ? `${fmtNum(value.latest.value, 1)} ${value.unit}` : '—';
  };

  const headline = useMemo(() => {
    if (!metric) {
      return { value: '—', unit: metricMeta.unit, caption: 'Waiting for your logs', delta: null, badge: null };
    }
    if (metricKey === 'minutes') {
      return {
        value: fmtNum(metric.total),
        unit: 'min',
        caption: metric.sessions > 0
          ? `${metric.sessions} session${metric.sessions === 1 ? '' : 's'} in this range`
          : 'No sessions logged in this range',
        delta: null,
        badge: metric.best
          ? `Best ${BUCKET_WORD[data?.bucket] || 'day'}: ${fmtNum(metric.best.value)} min`
          : null,
      };
    }
    if (metricKey === 'calories' || metricKey === 'protein') {
      return {
        value: metric.avg != null ? fmtNum(metric.avg) : '—',
        unit: metric.unit,
        caption: metric.loggedDays > 0
          ? `avg per logged day · ${metric.loggedDays} day${metric.loggedDays === 1 ? '' : 's'} logged`
          : 'No meals logged in this range',
        delta: null,
        badge: metric.total > 0 ? `Total ${fmtNum(metric.total)} ${metric.unit}` : null,
      };
    }
    return {
      value: metric.latest ? fmtNum(metric.latest.value, 1) : '—',
      unit: metric.unit,
      caption: metric.latest && metric.first
        ? `${metric.count} measurement${metric.count === 1 ? '' : 's'} · since ${fmtShortDate(metric.first.date)}`
        : 'No measurements in this range',
      delta: fmtChange(metric.change, metric.unit),
      badge: metric.latest ? `Last logged ${fmtShortDate(metric.latest.date)}` : null,
    };
  }, [metric, metricKey, metricMeta.unit, data?.bucket]);

  const chartData = useMemo(() => {
    const valued = series.filter((p) => p.value != null).length;
    return {
      labels: series.map((p) => p.label),
      datasets: [{
        label: metricMeta.label,
        data: series.map((p) => p.value),
        borderColor: palette.accent,
        backgroundColor: (context) => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          if (!chartArea) return 'rgba(0, 0, 0, 0)';
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, withAlpha(palette.accent, 0.3));
          gradient.addColorStop(0.55, withAlpha(palette.accent, 0.1));
          gradient.addColorStop(1, withAlpha(palette.accent, 0));
          return gradient;
        },
        fill: true,
        tension: 0.38,
        borderWidth: 2.5,
        borderCapStyle: 'round',
        borderJoinStyle: 'round',
        pointRadius: valued <= 1 ? 4 : 0,
        pointHoverRadius: 5,
        pointHitRadius: 18,
        pointBackgroundColor: palette.accent,
        pointBorderColor: palette.card,
        pointBorderWidth: 2,
        spanGaps: true,
      }],
    };
  }, [series, palette, metricMeta.label]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: reduceMotion ? false : { duration: 340, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 6, right: 4, bottom: 0, left: 0 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: palette.card,
        titleColor: palette.text,
        bodyColor: palette.text,
        borderColor: palette.border,
        borderWidth: 1,
        cornerRadius: 10,
        padding: 10,
        displayColors: false,
        titleFont: { size: 10, weight: '700' },
        bodyFont: { size: 12, weight: '700' },
        callbacks: {
          title: (items) => series[items[0]?.dataIndex]?.fullLabel || '',
          label: (item) => {
            const point = series[item.dataIndex];
            return point?.value == null ? '' : `${fmtValue(metricKey, point.value)} ${metricMeta.unit}`;
          },
        },
        filter: (item) => series[item.dataIndex]?.value != null,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: palette.muted,
          font: { size: 9.5, weight: '600' },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 7,
          autoSkipPadding: 16,
          padding: 6,
        },
      },
      y: {
        beginAtZero: false,
        grace: '12%',
        grid: { color: withAlpha(palette.border, 0.55), drawTicks: false },
        border: { display: false },
        ticks: {
          color: palette.muted,
          font: { size: 9.5, weight: '600' },
          maxTicksLimit: 5,
          padding: 8,
          callback: (value) => fmtAxis(metricKey, value),
        },
      },
    },
  }), [palette, metricKey, metricMeta.unit, series, reduceMotion]);

  const emptyCopy = {
    minutes: 'Log a workout and this line starts moving.',
    weight: 'Add your weight in Body to see the trend.',
    calories: 'Log a meal in Nutrition to see your intake line.',
    protein: 'Log a meal in Nutrition to see protein over time.',
    waist: 'Add a waist measurement in Body to track it.',
  }[metricKey];

  if (!userId) return null;

  return (
    <section className="po-card" aria-labelledby="po-heading" aria-busy={loading}>
      <div className="po-top">
        <div className="po-heading">
          <span className="po-eyebrow">
            <Icon name="insights" />
            Progress overview
          </span>
          <h2 id="po-heading" className="po-title">
            All your progress, <em>one line.</em>
          </h2>
          <p className="po-sub">
            Weight, training, nutrition and waist — drawn from your real logs. No estimates.
          </p>
        </div>

        <div className="po-controls">
          <div className="po-ranges" role="group" aria-label="Chart range">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`po-range${range === r.key ? ' is-active' : ''}`}
                aria-pressed={range === r.key}
                aria-label={r.caption}
                onClick={() => {
                  if (r.key === range) return;
                  setRange(r.key);
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`po-refresh${loading ? ' is-spinning' : ''}`}
            aria-label="Refresh progress chart"
            onClick={reload}
          >
            <Icon name="refresh" />
          </button>
        </div>
      </div>

      <div className="po-metrics" role="tablist" aria-label="Choose a progress metric">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={metricKey === m.key}
            className={`po-metric${metricKey === m.key ? ' is-active' : ''}`}
            onClick={() => setMetricKey(m.key)}
          >
            <span className="po-metric-icon"><Icon name={m.icon} /></span>
            <span className="po-metric-copy">
              <span className="po-metric-label">{m.label}</span>
              <span className="po-metric-value">{chipValue(m.key, metrics?.[m.key])}</span>
            </span>
          </button>
        ))}
      </div>

      {error && data && (
        <div className="po-inline-error" role="alert">
          <Icon name="cloud_off" />
          <span>{error}</span>
          <button type="button" onClick={reload}>Retry</button>
        </div>
      )}

      <div className="po-chart-shell">
        <div className="po-chart-head">
          <div>
            <div className="po-headline">
              <span className="po-headline-value">
                {headline.value}
                <small>{headline.unit}</small>
              </span>
              {headline.delta && (
                <span className="po-delta">
                  <Icon name={String(headline.delta).startsWith('−')
                    ? 'trending_down'
                    : String(headline.delta).startsWith('+') ? 'trending_up' : 'remove'} />
                  {headline.delta}
                </span>
              )}
            </div>
            <p className="po-headline-caption">{headline.caption}</p>
          </div>
          {headline.badge && <span className="po-badge">{headline.badge}</span>}
        </div>

        <div className="po-chart-body">
          {loading && !data && (
            <div className="po-skeleton" aria-hidden="true">
              <span className="po-skel po-skel--value" />
              <span className="po-skel po-skel--chart" />
            </div>
          )}

          {!loading && error && !data && (
            <div className="po-error" role="alert">
              <span className="po-empty-icon"><Icon name="cloud_off" /></span>
              <strong>Couldn&apos;t load your progress</strong>
              <p>{error}</p>
              <button type="button" onClick={reload}>Try again</button>
            </div>
          )}

          {data && !hasData && (
            <div className="po-empty">
              <span className="po-empty-icon"><Icon name={metricMeta.icon} /></span>
              <strong>No {metricMeta.short.toLowerCase()} logged yet</strong>
              <p>{emptyCopy}</p>
            </div>
          )}

          {data && hasData && (
            <div className={`po-canvas${loading ? ' is-loading' : ''}`}>
              <Line
                data={chartData}
                options={options}
                role="img"
                aria-label={`${metricMeta.label} over ${rangeMeta.caption.toLowerCase()}`}
              />
              {loading && <span className="po-updating">Updating…</span>}
            </div>
          )}
        </div>
      </div>

      <div className="po-foot">
        <span><Icon name="database" /> Built from your real logs</span>
        <span>
          {BUCKET_CAPTION[data?.bucket] || 'Adaptive'} buckets · {rangeMeta.caption.toLowerCase()}
        </span>
      </div>
    </section>
  );
}
