import Icon from '../../../../components/Icon.jsx';
import Spinner from '../../../../components/ui/Spinner.jsx';
import CatalogNameField from './CatalogNameField.jsx';

const MEAL_TYPES = [
  { label: 'Breakfast', icon: 'free_breakfast' },
  { label: 'Lunch', icon: 'lunch_dining' },
  { label: 'Dinner', icon: 'dinner_dining' },
  { label: 'Snack', icon: 'cookie' },
];

function MealInput({
  label,
  value,
  onChange,
  placeholder = '0',
  inputMode = 'numeric',
  suffix = undefined,
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
  onClose = undefined,
  onSave = undefined,
  isLogging = false,
  isAnalyzing = false,
  panelRef = undefined,
}) {
  const busy = isLogging || isAnalyzing;

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
          onChange={(value) => setForm((current) => ({ ...current, name: value }))}
          onPick={(item) =>
            setForm((current) => ({
              ...current,
              name: item.name,
              calories: Number(item.calories) || 0,
              protein: Number(item.protein) || 0,
              carbs: Number(item.carbs) || 0,
              fat: Number(item.fat) || 0,
            }))
          }
        />

        <div className="mt-field-grid">
          <MealInput
            label="Calories"
            suffix="kcal"
            value={form.calories}
            onChange={(event) => setForm((current) => ({ ...current, calories: event.target.value }))}
          />
          <MealInput
            label="Protein"
            suffix="g"
            value={form.protein}
            onChange={(event) => setForm((current) => ({ ...current, protein: event.target.value }))}
          />
          <MealInput
            label="Carbs"
            suffix="g"
            value={form.carbs}
            onChange={(event) => setForm((current) => ({ ...current, carbs: event.target.value }))}
          />
          <MealInput
            label="Fat"
            suffix="g"
            value={form.fat}
            onChange={(event) => setForm((current) => ({ ...current, fat: event.target.value }))}
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

        <p className="mt-form-note">Nutrition values are saved to your food log.</p>
      </form>
    </section>
  );
}
