import { useEffect, useMemo, useState } from 'react';
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
import { fmtDay } from '../utils/format.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const FALLBACK = {
  accent: '#c7f464',
  accent2: '#67d66d',
  card: '#141a12',
  text: '#f1f5ea',
  muted: '#8e9a86',
  border: 'rgba(43, 56, 38, 0.7)',
};

const withAlpha = (color, alpha) => {
  const value = String(color || '').trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    let raw = hex[1];
    if (raw.length === 3) raw = raw.split('').map((char) => char + char).join('');
    return `rgba(${parseInt(raw.slice(0, 2), 16)}, ${parseInt(raw.slice(2, 4), 16)}, ${parseInt(raw.slice(4, 6), 16)}, ${alpha})`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  return value;
};

const readPalette = () => {
  if (typeof window === 'undefined') return FALLBACK;
  const css = getComputedStyle(document.documentElement);
  const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    accent: get('--accent', FALLBACK.accent),
    accent2: get('--accent-2', FALLBACK.accent2),
    card: get('--bg-card', FALLBACK.card),
    text: get('--text-primary', FALLBACK.text),
    muted: get('--text-muted', FALLBACK.muted),
    border: get('--border-light', FALLBACK.border),
  };
};

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

const compactNumber = (value) => {
  const number = Number(value || 0);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}m`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(number >= 10_000 ? 0 : 1)}k`;
  return number.toLocaleString('en-US');
};

/**
 * Admin usage trend — one real API series, rendered as a soft accent area with
 * a restrained secondary line for distinct members. All colours resolve from
 * the live theme tokens, so light / dark mode stay in sync without duplication.
 */
export default function AdminUsageChart({ series = [], height = 260, showMembers = true, label = 'AI activity' }) {
  const palette = usePalette();
  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const chartData = useMemo(() => {
    const datasets = [{
      label: 'AI calls',
      data: series.map((point) => Number(point.calls || 0)),
      borderColor: palette.accent,
      backgroundColor: (context) => {
        const { chart } = context;
        const { ctx, chartArea } = chart;
        if (!chartArea) return 'rgba(0, 0, 0, 0)';
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, withAlpha(palette.accent, 0.3));
        gradient.addColorStop(0.58, withAlpha(palette.accent, 0.08));
        gradient.addColorStop(1, withAlpha(palette.accent, 0));
        return gradient;
      },
      fill: true,
      tension: 0.4,
      borderWidth: 2.4,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHitRadius: 18,
      pointBackgroundColor: palette.accent,
      pointBorderColor: palette.card,
      pointBorderWidth: 2,
      spanGaps: true,
      yAxisID: 'y',
    }];

    if (showMembers) {
      datasets.push({
        label: 'Active members',
        data: series.map((point) => Number(point.users || 0)),
        borderColor: palette.accent2,
        backgroundColor: 'transparent',
        borderWidth: 1.7,
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHitRadius: 18,
        pointBackgroundColor: palette.accent2,
        pointBorderColor: palette.card,
        pointBorderWidth: 2,
        fill: false,
        yAxisID: 'y1',
      });
    }

    return { labels: series.map((point) => fmtDay(point.usage_day)), datasets };
  }, [series, palette, showMembers]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: reduceMotion ? false : { duration: 360, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 10, right: 2, bottom: 0, left: 0 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: palette.card,
        titleColor: palette.text,
        bodyColor: palette.text,
        borderColor: palette.border,
        borderWidth: 1,
        cornerRadius: 10,
        padding: 11,
        displayColors: true,
        boxWidth: 7,
        boxHeight: 7,
        usePointStyle: true,
        titleFont: { size: 10, weight: '700' },
        bodyFont: { size: 11.5, weight: '700' },
        callbacks: {
          title: (items) => {
            const index = items[0]?.dataIndex;
            const day = series[index]?.usage_day;
            return day
              ? new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              })
              : '';
          },
          label: (item) => `${item.dataset.label}: ${Number(item.raw || 0).toLocaleString('en-US')}`,
        },
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
          maxTicksLimit: 8,
          autoSkipPadding: 18,
          padding: 8,
        },
      },
      y: {
        beginAtZero: true,
        grace: '18%',
        grid: { color: withAlpha(palette.border, 0.55), drawTicks: false },
        border: { display: false },
        ticks: {
          color: palette.muted,
          font: { size: 9.5, weight: '600' },
          maxTicksLimit: 5,
          padding: 8,
          callback: (value) => compactNumber(value),
        },
      },
      y1: {
        display: false,
        beginAtZero: true,
        grace: '25%',
      },
    },
  }), [palette, series, reduceMotion]);

  return (
    <div className="adm-chart" style={{ height }}>
      <Line data={chartData} options={options} role="img" aria-label={`${label} trend chart`} />
    </div>
  );
}
