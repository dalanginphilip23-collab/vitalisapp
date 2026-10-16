import { Scatter } from 'react-chartjs-2';
import Icon from '../../../components/Icon.jsx';
import { getPointColor } from '../utils/sleepScore.js';

const resolveCssVar = (name, fallback = '#000000') => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const resolveSleepPointColor = (hours, quality) =>
  getPointColor(hours, quality, resolveCssVar('--accent', '#57B26A'));

function ScatterLegend() {
  const items = [
    { dot: 'bg-(--accent)',                          label: 'Optimal' },
    { dot: 'bg-orange-400',                          label: 'Fair'    },
    { dot: 'bg-red-400',                             label: 'Low'     },
    { dot: 'border-2 border-(--accent) bg-white',    label: 'Current' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-x-4 gap-y-2 text-[9px] font-black uppercase tracking-widest shrink-0">
      {items.map(({ dot, label }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
          <span className="text-(--text-muted)">{label}</span>
        </span>
      ))}
    </div>
  );
}

function SleepScatterChart({ scatterData, sleepHours, sleepQuality }) {
  const accentColor  = resolveCssVar('--accent',        '#6B8E23');
  const textMuted    = resolveCssVar('--text-muted',    '#9ca3af');
  const borderLight  = resolveCssVar('--border-light',  'rgba(255,255,255,0.08)');
  const bgCard       = resolveCssVar('--bg-card',       '#1f1f1f');
  const textPrimary  = resolveCssVar('--text-primary',  '#ffffff');
  const borderMedium = resolveCssVar('--border-medium', 'rgba(255,255,255,0.16)');

  const chartDataset = {
    datasets: [
      {
        label:                'Sleep Sessions',
        data:                 scatterData.map((d) => ({ x: parseFloat(d.sleep_duration), y: parseInt(d.sleep_quality) })),
        pointBackgroundColor: scatterData.map((d) => resolveSleepPointColor(parseFloat(d.sleep_duration), parseInt(d.sleep_quality))),
        pointRadius:          6,
        pointHoverRadius:     8,
      },
      {
        label:                'Current',
        data:                 [{ x: sleepHours, y: sleepQuality }],
        pointBackgroundColor: '#ffffff',
        pointBorderColor:     accentColor,
        pointBorderWidth:     2,
        pointRadius:          7,
        pointHoverRadius:     9,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x}h · Quality ${ctx.parsed.y}/10` },
        backgroundColor: bgCard,
        titleColor:      accentColor,
        bodyColor:       textPrimary,
        borderColor:     borderMedium,
        borderWidth:     1,
        padding:         10,
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Sleep Duration (hours)', color: textMuted, font: { size: 10, weight: 'bold', family: 'Inter' } },
        min: 0, max: 13,
        ticks: { color: textMuted, stepSize: 2, callback: (v) => `${v}h`, font: { size: 9 } },
        grid:  { color: borderLight },
      },
      y: {
        title: { display: true, text: 'Quality (1–10)', color: textMuted, font: { size: 10, weight: 'bold', family: 'Inter' } },
        min: 0, max: 11,
        ticks: { color: textMuted, stepSize: 2, font: { size: 9 } },
        grid:  { color: borderLight },
      },
    },
  };

  return (
    <div className="col-span-1 lg:col-span-8 bg-(--bg-tertiary) rounded-2xl p-4 sm:p-6 md:p-8 border border-(--border-light) shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h3 className="text-(--text-muted) text-[10px] font-bold uppercase tracking-[0.2em] mb-1 sm:mb-2">
            Sleep Duration vs Quality
          </h3>
          <p className="text-2xl sm:text-3xl md:text-4xl font-black font-display text-(--text-primary) leading-none">
            {sleepHours}h{' '}
            <span className="text-(--accent) text-xs sm:text-sm font-bold ml-1 sm:ml-2">Q{sleepQuality}/10</span>
          </p>
        </div>
        <ScatterLegend />
      </div>
      <div className="h-[190px] sm:h-[250px] md:h-[280px] lg:h-[300px]">
        <Scatter data={chartDataset} options={chartOptions} />
      </div>
    </div>
  );
}

function SleepSlider({ label, valueLabel, labelColor, min, max, step, value, onChange, accent }) {
  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex justify-between text-[9px] text-[var(--text-disabled)] font-black uppercase tracking-widest">
        <span>{label}</span>
        <span className={labelColor}>{valueLabel}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={onChange}
        style={{ touchAction: 'pan-y' }}
        className={`w-full h-1 bg-(--bg-hover) rounded-full appearance-none cursor-pointer ${accent}`}
      />
    </div>
  );
}

export default function SleepSyncCard({ sleepHours, setSleepHours, sleepQuality, setSleepQuality, waterIntake, setWaterIntake, sleepStatus, saveStatus, onSave }) {
  const saveBadge = {
    saving: { text: 'Saving…', cls: 'text-(--text-muted)' },
    saved:  { text: '✓ Saved', cls: 'text-(--accent)'     },
    error:  { text: '✕ Error', cls: 'text-red-400'        },
  };

  return (
    <div className="col-span-1 lg:col-span-4">
      <div className="bg-(--bg-tertiary) rounded-2xl p-4 sm:p-6 md:p-8 border border-(--border-light) shadow-sm h-full">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="p-2 sm:p-2.5 bg-(--bg-hover) rounded-xl">
            <Icon name="bedtime" className="text-(--accent) text-xl sm:text-2xl" fill={1} />
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-2 sm:px-3 py-1 rounded-md border ${sleepStatus.color} ${sleepStatus.border} ${sleepStatus.bg}`}>
              {sleepStatus.level}
            </span>
            <span className="text-[10px] font-bold text-[var(--text-disabled)] uppercase">Score: {sleepStatus.score}%</span>
          </div>
        </div>

        <h4 className="text-lg sm:text-xl font-black font-display mb-1 text-(--text-primary)">
          Rest: <span className={sleepStatus.color}>{sleepHours}h</span>
        </h4>
        <p className="text-[var(--text-muted)] text-[11px] leading-relaxed mb-5 sm:mb-8 font-medium">{sleepStatus.label}</p>

        <div className="space-y-4 sm:space-y-6">
          <SleepSlider label="Duration"  valueLabel={`${sleepHours} Hours`} labelColor="text-(--accent)"  min={0} max={12}   step={0.5} value={sleepHours}   onChange={(e) => setSleepHours(parseFloat(e.target.value))}  accent="accent-(--accent)"  />
          <SleepSlider label="Quality"   valueLabel={`${sleepQuality}/10`}  labelColor="text-orange-400" min={1} max={10}   step={1}   value={sleepQuality}  onChange={(e) => setSleepQuality(parseInt(e.target.value))}  accent="accent-orange-400" />
          <SleepSlider label="Hydration" valueLabel={`${waterIntake} ml`}   labelColor="text-blue-400"   min={0} max={5000} step={250} value={waterIntake}   onChange={(e) => setWaterIntake(parseInt(e.target.value))}   accent="accent-blue-400"   />

          <button
            onClick={onSave}
            disabled={saveStatus === 'saving'}
            className="w-full py-3 bg-(--accent-solid) hover:bg-(--accent-solid-hover) active:bg-(--accent-solid-hover) disabled:opacity-50 text-[var(--accent-solid-fg)] text-[10px] font-black uppercase tracking-[0.15em] rounded-xl transition-all touch-manipulation"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Sleep Log'}
          </button>

          {saveStatus !== 'idle' && saveStatus !== 'saving' && (
            <p className={`text-center text-[9px] font-black uppercase ${saveBadge[saveStatus].cls}`}>
              {saveBadge[saveStatus].text}
            </p>
          )}
          <p className="text-center text-[9px] text-(--text-muted) mt-1">Manual logging — automatic wearable sync isn't available yet.</p>
        </div>
      </div>
    </div>
  );
}

export { SleepScatterChart, SleepSlider, ScatterLegend };
