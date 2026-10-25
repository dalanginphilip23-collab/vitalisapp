import Icon from '../../../../components/Icon.jsx';

const MACROS = [
  {
    key: 'protein',
    label: 'Protein',
    icon: 'fitness_center',
  },
  {
    key: 'carbs',
    label: 'Carbs',
    icon: 'bakery_dining',
  },
  {
    key: 'fat',
    label: 'Fat',
    icon: 'water_drop',
  },
];

function pctOf(actual, target) {
  const value = Number(actual) || 0;
  const goal = Number(target) || 0;
  return goal > 0 ? Math.round((value / goal) * 100) : 0;
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString();
}

export function DailySummaryCard({
  calories = 0,
  goal = 0,
  protein = 0,
  proteinGoal = 0,
  carbs = 0,
  carbsGoal = 0,
  fat = 0,
  fatGoal = 0,
  dateLabel = 'Today',
}) {
  const safeGoal = Math.max(1, Math.round(Number(goal) || 0));
  const consumed = Math.max(0, Math.round(Number(calories) || 0));
  const kcalPct = Math.min(100, Math.round((consumed / safeGoal) * 100));
  const rawKcalPct = Math.round((consumed / safeGoal) * 100);
  const remaining = Math.max(0, safeGoal - consumed);
  const overBy = Math.max(0, consumed - safeGoal);
  const macroPcts = [
    pctOf(protein, proteinGoal),
    pctOf(carbs, carbsGoal),
    pctOf(fat, fatGoal),
  ];
  const macroPct = Math.round(
    macroPcts.reduce((total, value) => total + Math.min(100, value), 0) / macroPcts.length,
  );

  const outerRadius = 103;
  const innerRadius = 80;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;

  const gaugeLabel = `${formatNumber(consumed)} of ${formatNumber(safeGoal)} calories consumed, ${rawKcalPct}% of daily goal. Macros at ${macroPct}% of target.`;

  return (
    <section className="mt-summary mt-panel" aria-labelledby="mt-summary-title">
      <div className="mt-card-head">
        <div className="mt-card-head-copy">
          <p className="mt-kicker">Today&apos;s energy</p>
          <h2 className="mt-card-title" id="mt-summary-title">
            Calorie tracker
          </h2>
        </div>
        <span className="mt-soft-pill">
          <Icon name="calendar_today" className="mt-pill-icon" />
          {dateLabel}
        </span>
      </div>

      <div className="mt-summary-body">
        <div className="mt-summary-visual">
          <div className="mt-gauge" role="img" aria-label={gaugeLabel}>
            <svg viewBox="0 0 240 240" aria-hidden="true">
              <g transform="rotate(-90 120 120)">
                <circle
                  className="mt-gauge-track"
                  cx="120"
                  cy="120"
                  r={outerRadius}
                  fill="none"
                  strokeWidth="13"
                />
                <circle
                  className="mt-gauge-arc mt-gauge-arc--calories"
                  cx="120"
                  cy="120"
                  r={outerRadius}
                  fill="none"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeDasharray={outerCircumference}
                  strokeDashoffset={outerCircumference * (1 - kcalPct / 100)}
                />
                <circle
                  className="mt-gauge-track mt-gauge-track--inner"
                  cx="120"
                  cy="120"
                  r={innerRadius}
                  fill="none"
                  strokeWidth="8"
                />
                <circle
                  className="mt-gauge-arc mt-gauge-arc--macros"
                  cx="120"
                  cy="120"
                  r={innerRadius}
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={innerCircumference}
                  strokeDashoffset={innerCircumference * (1 - Math.min(100, macroPct) / 100)}
                />
              </g>
            </svg>

            <div className="mt-gauge-center" aria-hidden="true">
              <span className="mt-gauge-icon">
                <Icon name="local_fire_department" className="mt-gauge-icon-symbol" fill={1} />
              </span>
              <span className="mt-gauge-of">of {formatNumber(safeGoal)} kcal</span>
              <strong className="mt-gauge-value">{formatNumber(consumed)}</strong>
            </div>
          </div>

          <div className="mt-gauge-legend" aria-hidden="true">
            <span className="mt-legend-item">
              <span className="mt-legend-dot mt-legend-dot--calories" />
              Calories <strong>{rawKcalPct}%</strong>
            </span>
            <span className="mt-legend-item">
              <span className="mt-legend-dot mt-legend-dot--macros" />
              Macros <strong>{macroPct}%</strong>
            </span>
          </div>
        </div>

        <div className="mt-summary-side">
          <div className={`mt-remaining ${overBy > 0 ? 'is-over' : ''}`}>
            <span className="mt-remaining-label">
              {overBy > 0 ? 'Over daily goal' : 'Remaining today'}
            </span>
            <p className="mt-remaining-value">
              {formatNumber(overBy > 0 ? overBy : remaining)}
              <span>kcal</span>
            </p>
            <p className="mt-remaining-note">
              {overBy > 0
                ? 'A lighter next meal can bring the day back in balance.'
                : `${formatNumber(safeGoal)} kcal daily target`}
            </p>
          </div>

          <div className="mt-mini-stats">
            <div className="mt-mini-stat">
              <span>Consumed</span>
              <strong>{formatNumber(consumed)}</strong>
              <small>kcal</small>
            </div>
            <div className="mt-mini-stat">
              <span>Daily goal</span>
              <strong>{formatNumber(safeGoal)}</strong>
              <small>kcal</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MacroCards({
  protein = 0,
  proteinGoal = 0,
  carbs = 0,
  carbsGoal = 0,
  fat = 0,
  fatGoal = 0,
}) {
  const values = {
    protein: { actual: protein, target: proteinGoal },
    carbs: { actual: carbs, target: carbsGoal },
    fat: { actual: fat, target: fatGoal },
  };

  return (
    <section className="mt-macros" aria-labelledby="mt-macros-title">
      <div className="mt-section-head mt-section-head--compact">
        <div>
          <h2 className="mt-section-title" id="mt-macros-title">
            Macronutrients
          </h2>
          <p className="mt-section-sub">Your daily split at a glance.</p>
        </div>
      </div>

      <div className="mt-macro-grid">
        {MACROS.map((macro) => {
          const { actual, target } = values[macro.key];
          const grams = Math.max(0, Math.round(Number(actual) || 0));
          const targetGrams = Math.max(0, Math.round(Number(target) || 0));
          const pct = pctOf(grams, targetGrams);
          const barPct = Math.min(100, pct);

          return (
            <article
              className={`mt-macro-tile mt-macro-tile--${macro.key}`}
              key={macro.key}
              aria-label={`${macro.label}: ${grams} of ${targetGrams} grams, ${pct}% of goal`}
            >
              <div className="mt-macro-head">
                <span className="mt-macro-icon">
                  <Icon name={macro.icon} className="mt-macro-icon-symbol" />
                </span>
                <span className="mt-macro-label">{macro.label}</span>
                <span className="mt-macro-pct">{pct}%</span>
              </div>

              <p className="mt-macro-value">
                {formatNumber(grams)}
                <span>g</span>
              </p>
              <p className="mt-macro-target">of {formatNumber(targetGrams)} g</p>

              <div
                className="mt-macro-track"
                role="progressbar"
                aria-label={`${macro.label} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={barPct}
                aria-valuetext={`${grams} of ${targetGrams} grams, ${pct}%`}
              >
                <span className="mt-macro-fill" style={{ width: `${barPct}%` }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default DailySummaryCard;
