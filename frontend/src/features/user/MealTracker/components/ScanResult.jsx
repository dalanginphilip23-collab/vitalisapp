import { useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import Button from '../../../../components/ui/Button.jsx';
import { MEAL_SLOTS, suggestMealSlot } from '../utils/mealSlots.js';

// Reference-style result sheet: dish title, kcal ring, macro bars,
// tappable ingredient chips (toggle include), custom add, Add meal.
// The photo lives in the quick-log card above; this panel is the nutrition readout.
const FOOD_ICON_MAP = [
  [/egg/, 'egg'], [/chicken|poultry|turkey/, 'kebab_dining'], [/rice/, 'rice_bowl'],
  [/bread|toast|bagel/, 'bakery_dining'], [/avocado/, 'nutrition'],
  [/spinach|greens|salad|lettuce|kale|cabbage/, 'eco'], [/tomato/, 'nutrition'],
  [/fish|salmon|tuna/, 'set_meal'], [/beef|steak|pork|meat|bacon/, 'kebab_dining'],
  [/shrimp|prawn/, 'set_meal'], [/milk/, 'local_drink'], [/cheese/, 'lunch_dining'],
  [/apple/, 'nutrition'], [/banana/, 'nutrition'], [/potato|fries/, 'fastfood'],
  [/pasta|noodle|spaghetti|ramen/, 'ramen_dining'], [/pizza/, 'local_pizza'],
  [/burger/, 'lunch_dining'], [/sushi/, 'set_meal'], [/broccoli/, 'eco'],
  [/carrot/, 'nutrition'], [/bean|nuts|peanut|almond/, 'grain'], [/coffee/, 'coffee'],
  [/cake|chocolate|ice cream|dessert|cookie/, 'cake'], [/yogurt/, 'icecream'],
  [/oat|cereal|granola/, 'breakfast_dining'], [/soup/, 'soup_kitchen'],
  [/sandwich/, 'lunch_dining'], [/berry|berries|strawberry|mango|orange|fruit/, 'nutrition'],
  [/onion/, 'nutrition'], [/mushroom/, 'eco'], [/corn/, 'agriculture'], [/tea/, 'local_cafe'],
];
const iconFor = (name) => {
  const normalized = String(name || '').toLowerCase();
  const match = FOOD_ICON_MAP.find(([pattern]) => pattern.test(normalized));
  return match ? match[1] : 'restaurant';
};
const cleanFoodName = (name) => String(name || '').replace(/^[\p{Emoji}\s]+/u, '');

function KcalRing({ value }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, Number(value || 0) / 1000));
  return (
    <div className="mt-result-ring">
      <svg viewBox="0 0 84 84" className="mt-result-ring-svg" aria-hidden="true">
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          strokeWidth="7"
          className="mt-result-ring-track"
        />
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className="mt-result-ring-fill"
        />
      </svg>
      <div className="mt-result-ring-copy">
        <span className="mt-result-ring-value">{value}</span>
        <span className="mt-result-ring-unit">kcal</span>
      </div>
    </div>
  );
}

function MacroBar({ label, grams, max }) {
  const pct = max > 0 ? Math.min(100, Math.round(((Number(grams) || 0) / max) * 100)) : 0;
  return (
    <div className="mt-result-macro">
      <div className="mt-result-macro-head">
        <span className="mt-result-macro-label">{label}</span>
        <span className="mt-result-macro-value">{grams} g</span>
      </div>
      <div className="mt-result-macro-track">
        <span className="mt-result-macro-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// One numeric input of the tap-to-correct editor.
function CorrectInput({ label, value, onChange, disabled }) {
  return (
    <label className="mt-result-correct-field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-result-correct-input"
      />
    </label>
  );
}

export default function ScanResult({
  result,
  isLogging,
  onToggle,
  onScale,
  onEditItem,
  onAddCustom,
  onSave,
  onRescan,
  onClear,
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ food_name: '', calories: '', serving: '' });
  const [editingKey, setEditingKey] = useState(null);
  const [draftEdit, setDraftEdit] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [mealSlot, setMealSlot] = useState(() => suggestMealSlot());

  const items = result?.items || [];
  const flagged = items.filter(
    (item) => Array.isArray(item.allergy_matches) && item.allergy_matches.length > 0,
  );
  const selected = items.filter((item) => item.selected);
  const sum = (key) =>
    selected.reduce((total, item) => total + (Number(item[key]) || 0), 0);
  const totals = {
    calories: Math.round(sum('calories')),
    protein: Math.round(sum('protein')),
    carbs: Math.round(sum('carbs')),
    fat: Math.round(sum('fat')),
  };
  const macroMax = Math.max(1, totals.protein, totals.carbs, totals.fat);
  const title =
    selected.length === 1
      ? selected[0].food_name
      : selected.length > 1
        ? `${selected.length} detected items`
        : items[0]?.food_name || 'No items';

  const submitCustom = () => {
    if (!draft.food_name.trim()) return;
    onAddCustom?.({
      food_name: draft.food_name,
      calories: draft.calories,
      serving: draft.serving,
    });
    setDraft({ food_name: '', calories: '', serving: '' });
    setAdding(false);
  };

  const openEditor = (item) => {
    setEditingKey(item.key);
    setDraftEdit({
      calories: String(item.calories ?? ''),
      protein: String(item.protein ?? ''),
      carbs: String(item.carbs ?? ''),
      fat: String(item.fat ?? ''),
    });
  };

  const applyEdit = (key) => {
    const number = (value) => (value === '' || value == null ? undefined : Number(value));
    onEditItem?.(key, {
      calories: number(draftEdit.calories),
      protein: number(draftEdit.protein),
      carbs: number(draftEdit.carbs),
      fat: number(draftEdit.fat),
    });
    setEditingKey(null);
  };
  const editedCount = items.filter((item) => item.corrected).length;

  return (
    <section className="mt-result mt-panel" aria-labelledby="mt-result-title">
      <div className="mt-result-head">
        <div className="mt-result-heading">
          <p className="mt-kicker">Photo analysis</p>
          <h2 className="mt-result-title" id="mt-result-title">{title}</h2>
          <div className="mt-result-badges">
            <span className="mt-result-badge">
              <Icon name="auto_awesome" className="mt-result-badge-icon" />
              AI estimate
            </span>
            {editedCount > 0 && (
              <span className="mt-result-badge mt-result-badge--corrected">
                <Icon name="check" className="mt-result-badge-icon" />
                {editedCount} corrected
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClear}
          aria-label="Dismiss result"
          className="mt-icon-button mt-result-close"
        >
          <Icon name="close" className="mt-icon-symbol" />
        </button>
      </div>

      {/* Allergy warning — matches the onboarding allergy list */}
      {flagged.length > 0 && (
        <div role="alert" className="mt-result-warning">
          <Icon name="warning" className="mt-result-warning-icon" fill={1} />
          <div>
            <p className="mt-result-warning-title">May contain your allergens</p>
            <ul className="mt-result-warning-list">
              {flagged.map((item) => (
                <li key={item.key}>
                  <strong>{item.food_name}</strong> may contain{' '}
                  <strong>{item.allergy_matches.join(', ')}</strong>
                </li>
              ))}
            </ul>
            <p className="mt-result-warning-note">
              Estimate from a photo — check the label before eating.
            </p>
          </div>
        </div>
      )}

      <p className="mt-result-section-label">Nutritional value</p>

      {selected.some((item) => item.low_confidence) && (
        <p role="status" className="mt-result-notice mt-result-notice--warning">
          Low confidence estimate — verify portion before saving.
        </p>
      )}
      {result?.retryable && (
        <p role="alert" className="mt-result-notice mt-result-notice--info">
          AI is busy right now (high demand). Wait a moment and tap Scan again — don&apos;t
          log this empty result.
        </p>
      )}

      <div className="mt-result-nutrition">
        <KcalRing value={totals.calories} />
        <div className="mt-result-macros">
          <MacroBar label="Protein" grams={totals.protein} max={macroMax} />
          <MacroBar label="Carbs" grams={totals.carbs} max={macroMax} />
          <MacroBar label="Fats" grams={totals.fat} max={macroMax} />
        </div>
      </div>

      <p className="mt-result-hint">
        Photo estimates only — tap the pencil on any item to correct it.
      </p>

      <div className="mt-result-portion" role="group" aria-label="Adjust portion size">
        <span className="mt-result-section-label mt-result-section-label--inline">Portion</span>
        {[0.5, 1, 1.5, 2].map((factor) => (
          <button
            key={factor}
            type="button"
            onClick={() => onScale?.(factor)}
            aria-label={`Scale portion to ${factor}x`}
            className="mt-result-portion-button"
          >
            {factor}x
          </button>
        ))}
      </div>

      <p className="mt-result-section-label">Ingredients</p>
      {items.length === 0 ? (
        <p className="mt-result-empty">No items detected.</p>
      ) : (
        <div className="mt-result-ingredients">
          {items.map((item) => (
            <div
              key={item.key}
              className={`mt-result-ingredient ${item.selected ? '' : 'is-excluded'}`}
            >
              <button
                type="button"
                onClick={() => onToggle?.(item.key)}
                title={
                  item.allergy_matches?.length
                    ? `${item.food_name} · ${item.calories} kcal — may contain ${item.allergy_matches.join(', ')}`
                    : `${item.food_name} · ${item.calories} kcal — tap to ${item.selected ? 'exclude' : 'include'}`
                }
                aria-pressed={item.selected}
                aria-label={`${item.selected ? 'Exclude' : 'Include'} ${item.food_name}`}
                className="mt-result-ingredient-main"
              >
                <span className="mt-result-ingredient-icon-wrap">
                  <Icon name={iconFor(item.food_name)} className="mt-result-ingredient-icon" />
                  {item.allergy_matches?.length ? (
                    <span
                      className="mt-result-allergen-badge"
                      title={`May contain ${item.allergy_matches.join(', ')}`}
                    >
                      <Icon name="warning" className="mt-result-allergen-icon" fill={1} />
                    </span>
                  ) : null}
                </span>
                <span className="mt-result-ingredient-name">
                  {cleanFoodName(item.food_name).slice(0, 18) || item.food_name.slice(0, 18)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => (editingKey === item.key ? setEditingKey(null) : openEditor(item))}
                title={`Correct estimate — ${item.food_name}`}
                aria-label={`Correct estimate for ${item.food_name}`}
                aria-expanded={editingKey === item.key}
                className={`mt-result-ingredient-kcal ${item.corrected ? 'is-corrected' : ''}`}
              >
                {item.corrected ? `${item.calories} kcal ✓` : `${item.calories} kcal ✎`}
              </button>
            </div>
          ))}
        </div>
      )}

      {editingKey && (() => {
        const item = items.find((entry) => entry.key === editingKey);
        if (!item) return null;
        return (
          <div
            className="mt-result-editor"
            role="form"
            aria-label={`Correct estimate for ${item.food_name}`}
          >
            <div className="mt-result-editor-head">
              <p className="mt-result-editor-title">
                Correct: {cleanFoodName(item.food_name)}
              </p>
              <button
                type="button"
                onClick={() => setEditingKey(null)}
                aria-label="Close correction editor"
                className="mt-result-editor-close"
              >
                <Icon name="close" className="mt-icon-symbol" />
              </button>
            </div>
            <p className="mt-result-editor-note">
              Your correction replaces the AI estimate. Leave kcal empty to re-derive it
              from macros.
            </p>
            <div className="mt-result-correct-grid">
              <CorrectInput
                label="kcal"
                value={draftEdit.calories}
                onChange={(value) => setDraftEdit((current) => ({ ...current, calories: value }))}
              />
              <CorrectInput
                label="P (g)"
                value={draftEdit.protein}
                onChange={(value) => setDraftEdit((current) => ({ ...current, protein: value }))}
              />
              <CorrectInput
                label="C (g)"
                value={draftEdit.carbs}
                onChange={(value) => setDraftEdit((current) => ({ ...current, carbs: value }))}
              />
              <CorrectInput
                label="F (g)"
                value={draftEdit.fat}
                onChange={(value) => setDraftEdit((current) => ({ ...current, fat: value }))}
              />
            </div>
            <div className="mt-result-editor-actions">
              <button
                type="button"
                onClick={() => setEditingKey(null)}
                className="mt-result-editor-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => applyEdit(item.key)}
                className="mt-result-editor-save"
              >
                Save correction
              </button>
            </div>
          </div>
        );
      })()}

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-result-search"
        >
          <Icon name="search" className="mt-result-search-icon" />
          Search for more
        </button>
      ) : (
        <div className="mt-result-custom">
          <input
            value={draft.food_name}
            onChange={(event) => setDraft({ ...draft, food_name: event.target.value })}
            placeholder="Food name (e.g. Banana)"
            aria-label="Custom food name"
            className="mt-result-custom-input"
          />
          <div className="mt-result-custom-grid">
            <input
              value={draft.calories}
              onChange={(event) => setDraft({ ...draft, calories: event.target.value })}
              placeholder="Calories"
              aria-label="Custom food calories"
              type="number"
              min="0"
              className="mt-result-custom-input"
            />
            <input
              value={draft.serving}
              onChange={(event) => setDraft({ ...draft, serving: event.target.value })}
              placeholder="Serving (e.g. 1 pc)"
              aria-label="Custom food serving"
              className="mt-result-custom-input"
            />
          </div>
          <div className="mt-result-custom-actions">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="mt-result-editor-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitCustom}
              className="mt-result-editor-save"
            >
              Add item
            </button>
          </div>
        </div>
      )}

      <div className="mt-result-slot-block" role="group" aria-label="Meal type">
        <p className="mt-result-section-label mt-result-section-label--inline">Saving as</p>
        <div className="mt-result-slots">
          {MEAL_SLOTS.map((slot) => {
            const active = mealSlot === slot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setMealSlot(slot)}
                aria-pressed={active}
                className={`mt-result-slot ${active ? 'is-active' : ''}`}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </div>

      <Button
        onClick={() => onSave?.({ mealType: mealSlot })}
        loading={isLogging}
        disabled={isLogging || selected.length === 0}
        fullWidth
        className="mt-result-save"
      >
        {isLogging ? 'Saving…' : `Add to ${mealSlot}`}
      </Button>

      <button type="button" onClick={onRescan} className="mt-result-rescan">
        <Icon name="photo_camera" className="mt-result-rescan-icon" />
        Scan again
      </button>

      {result?.suggestion && (
        <p className="mt-result-suggestion">
          <Icon name="lightbulb" className="mt-result-suggestion-icon" />
          {result.suggestion}
        </p>
      )}
    </section>
  );
}
