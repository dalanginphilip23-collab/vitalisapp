import Icon from '../../../../components/Icon.jsx';
import Spinner from '../../../../components/ui/Spinner.jsx';
import CatalogNameField from './CatalogNameField.jsx';
import { normalizeGrams, toInputValue } from '../../../../lib/nutrition.js';

const MEAL_TYPES = [
  { label: 'Breakfast', icon: 'free_breakfast' },
  { label: 'Lunch', icon: 'lunch_dining' },
  { label: 'Dinner', icon: 'dinner_dining' },
  { label: 'Snack', icon: 'cookie' },
];

// One-tap portions for the common case; typing stays the precise path.
const WEIGHT_CHIPS = [50, 100, 150, 200, 250];

function MealInput({
  label,
  value,
  onChange,
  placeholder = '0',
  inputMode = 'numeric',
  suffix = undefined,
  disabled = false,
}) {
  return (
    <label className="mt-field">
      <span className="mt-field-label">
        {label}
        {suffix && <span className="mt-field-suffix">{suffix}</span>}
      </span>
      <input
        className="mt-input"
        type="number"
        min="0"
        step="any"
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </label>
  );
}

export function QuickLogCard({
  preview = null,
  isAnalyzing = false,
  manualOpen = false,
  onCamera = undefined,
  onUpload = undefined,
  onManual = undefined,
  onClear = undefined,
}) {
  const hasPreview = Boolean(preview) || isAnalyzing;

  return (
    <section className="mt-log mt-panel" aria-labelledby="mt-log-title">
      <div className="mt-card-head">
        <div className="mt-card-head-copy">
          <p className="mt-kicker">Quick add</p>
          <h2 className="mt-card-title" id="mt-log-title">
            Log a meal
          </h2>
        </div>
      </div>

      {hasPreview ? (
        <div className="mt-photo-preview">
          {preview ? (
            <img className="mt-photo-preview-image" src={preview} alt="Selected meal" />
          ) : (
            <span className="mt-photo-preview-placeholder">
              <Icon name="image" className="mt-photo-preview-icon" />
            </span>
          )}

          <div className="mt-photo-preview-copy">
            <p className="mt-photo-preview-title">
              {isAnalyzing ? 'Analyzing photo' : 'Photo ready'}
            </p>
            <p className="mt-photo-preview-note">
              {isAnalyzing
                ? 'Finding foods and estimating nutrition…'
                : 'Review the detected items below.'}
            </p>
          </div>

          {isAnalyzing ? (
            <Spinner className="mt-photo-preview-spinner" />
          ) : (
            <button
              type="button"
              className="mt-icon-button mt-photo-clear"
              onClick={onClear}
              aria-label="Clear selected photo"
            >
              <Icon name="close" className="mt-icon-symbol" />
            </button>
          )}
        </div>
      ) : (
        <div className="mt-log-actions">
          <button type="button" className="mt-log-primary" onClick={onCamera}>
            <span className="mt-log-primary-icon">
              <Icon name="photo_camera" className="mt-log-primary-symbol" />
            </span>
            <span className="mt-log-primary-copy">
              <strong>Scan a meal</strong>
              <small>Use your camera and AI</small>
            </span>
            <Icon name="arrow_forward" className="mt-log-arrow" />
          </button>

          <div className="mt-log-secondary">
            <button type="button" className="mt-log-alternative" onClick={onUpload}>
              <span className="mt-log-alt-icon">
                <Icon name="upload" className="mt-log-alt-symbol" />
              </span>
              <span>
                <strong>Upload</strong>
                <small>Gallery</small>
              </span>
            </button>

            <button
              type="button"
              className="mt-log-alternative"
              onClick={onManual}
              aria-expanded={manualOpen}
            >
              <span className="mt-log-alt-icon">
                <Icon name="edit_note" className="mt-log-alt-symbol" />
              </span>
              <span>
                <strong>Manual</strong>
                <small>Enter values</small>
              </span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function ManualMealForm({
  form,
  setForm,
  error = '',
  densityError = '',
  onClose = undefined,
  onSave = undefined,
  onCatalogPick = undefined,
  onNameChange = undefined,
  onWeightChange = undefined,
  onMacroChange = undefined,
  onEstimate = undefined,
  onRecalculate = undefined,
  isLogging = false,
  isAnalyzing = false,
  isEstimating = false,
  panelRef = undefined,
}) {
  const busy = isLogging || isAnalyzing || isEstimating;
  const hasDensity = Boolean(form.per100);
  const grams = normalizeGrams(form.grams);
  const basisLabel = form.servingLabel
    ? `${form.servingLabel}${form.servingGrams ? ` (${toInputValue(form.servingGrams)} g)` : ''} · `
    : '';
  const sourceLabel =
    form.densitySource === 'ai'
      ? ' · AI estimate'
      : form.densitySource === 'cache'
        ? ' · cached estimate'
        : '';

  return (
    <section className="mt-manual mt-panel" ref={panelRef} aria-labelledby="mt-manual-title">
      <div className="mt-card-head">
        <div className="mt-card-head-copy">
          <p className="mt-kicker">Manual entry</p>
          <h2 className="mt-card-title" id="mt-manual-title">
            Add a meal
          </h2>
        </div>
        <button
          type="button"
          className="mt-icon-button mt-manual-close"
          onClick={onClose}
          aria-label="Close manual meal form"
        >
          <Icon name="close" className="mt-icon-symbol" />
        </button>
      </div>

      <form
        className="mt-manual-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave?.();
        }}
      >
        <fieldset className="mt-fieldset">
          <legend className="mt-field-label">Meal</legend>
          <div className="mt-meal-type-grid">
            {MEAL_TYPES.map((meal) => {
              const active = form.mealType === meal.label;
              return (
                <button
                  key={meal.label}
                  type="button"
                  className={`mt-meal-type ${active ? 'is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => setForm((current) => ({ ...current, mealType: meal.label }))}
                >
                  <Icon name={meal.icon} className="mt-meal-type-icon" />
                  <span>{meal.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <CatalogNameField
          value={form.name}
          error={error}
          onChange={(value) => (onNameChange ? onNameChange(value) : setForm((current) => ({ ...current, name: value })))}
          onPick={(item) =>
            onCatalogPick
              ? onCatalogPick(item)
              : setForm((current) => ({
                  ...current,
                  name: item.name,
                  calories: Number(item.calories) || 0,
                  protein: Number(item.protein) || 0,
                  carbs: Number(item.carbs) || 0,
                  fat: Number(item.fat) || 0,
                }))
          }
        />

        <div className="mt-weight-block">
          <label className="mt-field mt-weight-field" htmlFor="meal-weight-input">
            <span className="mt-field-label">
              Weight <span className="mt-field-suffix">g</span>
            </span>
            <input
              id="meal-weight-input"
              className="mt-input"
              type="number"
              min="0"
              max="10000"
              step="any"
              inputMode="decimal"
              placeholder={hasDensity ? 'e.g. 150' : 'Pick or estimate a food first'}
              value={form.grams}
              disabled={!hasDensity || busy}
              aria-describedby="meal-density-hint"
              onChange={(event) => onWeightChange?.(event.target.value)}
            />
          </label>

          {hasDensity && (
            <div className="mt-weight-chips" role="group" aria-label="Quick weights">
              {WEIGHT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className={`mt-weight-chip ${grams === chip ? 'is-active' : ''}`}
                  aria-pressed={grams === chip}
                  aria-label={`Set weight to ${chip} grams`}
                  disabled={busy}
                  onClick={() => onWeightChange?.(String(chip))}
                >
                  {chip} g
                </button>
              ))}
            </div>
          )}

          <p className="mt-density-hint" id="meal-density-hint">
            {hasDensity
              ? `${basisLabel}${toInputValue(form.per100.calories)} kcal · P ${toInputValue(form.per100.protein)} · C ${toInputValue(form.per100.carbs)} · F ${toInputValue(form.per100.fat)} per 100 g${sourceLabel}${grams ? '' : ' — reference serving shown; add a weight to scale.'}`
              : 'Pick a suggestion or estimate nutrition to scale macros by weight.'}
          </p>

          {!hasDensity && (
            <button
              type="button"
              className="mt-density-action"
              onClick={onEstimate}
              disabled={busy}
            >
              {isEstimating ? (
                <Spinner className="mt-density-spinner" />
              ) : (
                <Icon name="auto_awesome" className="mt-density-icon" />
              )}
              <span>{isEstimating ? 'Estimating nutrition…' : 'Estimate nutrition'}</span>
            </button>
          )}

          {hasDensity && form.macroOverride && (
            <button
              type="button"
              className="mt-density-action"
              onClick={onRecalculate}
              disabled={busy || !grams}
            >
              <Icon name="restart_alt" className="mt-density-icon" />
              <span>Recalculate from weight</span>
            </button>
          )}

          {densityError && (
            <p className="mt-density-error" role="alert">
              {densityError}
            </p>
          )}
        </div>

        <div className="mt-field-grid">
          <MealInput
            label="Calories"
            suffix="kcal"
            value={form.calories}
            disabled={busy}
            onChange={(event) => (onMacroChange ? onMacroChange('calories', event.target.value) : setForm((current) => ({ ...current, calories: event.target.value })))}
          />
          <MealInput
            label="Protein"
            suffix="g"
            inputMode="decimal"
            value={form.protein}
            disabled={busy}
            onChange={(event) => (onMacroChange ? onMacroChange('protein', event.target.value) : setForm((current) => ({ ...current, protein: event.target.value })))}
          />
          <MealInput
            label="Carbs"
            suffix="g"
            inputMode="decimal"
            value={form.carbs}
            disabled={busy}
            onChange={(event) => (onMacroChange ? onMacroChange('carbs', event.target.value) : setForm((current) => ({ ...current, carbs: event.target.value })))}
          />
          <MealInput
            label="Fat"
            suffix="g"
            inputMode="decimal"
            value={form.fat}
            disabled={busy}
            onChange={(event) => (onMacroChange ? onMacroChange('fat', event.target.value) : setForm((current) => ({ ...current, fat: event.target.value })))}
          />
        </div>

        <button
          type="submit"
          className="mt-save-button"
          disabled={busy}
          aria-busy={isLogging || undefined}
        >
          {isLogging ? (
            <Spinner className="mt-save-spinner" />
          ) : (
            <Icon name="check" className="mt-save-icon" />
          )}
          <span>{isLogging ? 'Saving…' : `Save to ${form.mealType}`}</span>
        </button>

        <p className="mt-form-note">
          {hasDensity
            ? 'Macros scale from the weight. Edit a value to override, then recalculate if needed.'
            : 'Nutrition values are saved to your food log.'}
        </p>
      </form>
    </section>
  );
}
