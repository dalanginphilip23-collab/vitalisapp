import { useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import Spinner from '../../../../components/ui/Spinner.jsx';
import ErrorState from '../../../../components/feedback/ErrorState.jsx';
import { resolveAssetUrl } from '../../../../app/config/env.js';

const MEAL_META = {
  Breakfast: { icon: 'free_breakfast', className: 'breakfast' },
  Lunch: { icon: 'lunch_dining', className: 'lunch' },
  Dinner: { icon: 'dinner_dining', className: 'dinner' },
  Snack: { icon: 'cookie', className: 'snack' },
  Other: { icon: 'restaurant', className: 'other' },
};

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString();
}

function loggedTime(value) {
  if (!value) return '';
  const parsed = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function MealThumbnail({ imageUrl, type }) {
  const [failed, setFailed] = useState(false);
  const meta = MEAL_META[type] || MEAL_META.Other;

  if (imageUrl && !failed) {
    return (
      <img
        className="mt-meal-thumb mt-meal-thumb--image"
        src={resolveAssetUrl(imageUrl)}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={`mt-meal-thumb mt-meal-thumb--${meta.className}`} aria-hidden="true">
      <Icon name={meta.icon} className="mt-meal-thumb-icon" />
    </span>
  );
}

function MealItem({ item, type, onDelete, deleting }) {
  const name = String(item.food_name || 'Meal').trim() || 'Meal';
  const time = loggedTime(item.logged_at);
  const serving = String(item.serving || '').trim();
  const showServing = serving && serving.toLowerCase() !== String(type).toLowerCase();
  const protein = Math.max(0, Math.round(Number(item.protein) || 0));
  const carbs = Math.max(0, Math.round(Number(item.carbs) || 0));
  const fat = Math.max(0, Math.round(Number(item.fat) || 0));

  return (
    <div className="mt-meal-item">
      <MealThumbnail imageUrl={item.image_url} type={type} />

      <div className="mt-meal-copy">
        <div className="mt-meal-topline">
          <h4 className="mt-meal-name">{name}</h4>
          <p className="mt-meal-energy">
            {formatNumber(item.calories)}
            <span>kcal</span>
          </p>
        </div>

        <div className="mt-meal-meta">
          {showServing && <span className="mt-meal-serving">{serving}</span>}
          {time && (
            <span className="mt-meal-time">
              <Icon name="schedule" className="mt-meal-meta-icon" />
              {time}
            </span>
          )}
          <span className="mt-meal-macros">
            <span>P {protein}g</span>
            <span>C {carbs}g</span>
            <span>F {fat}g</span>
          </span>
        </div>
      </div>

      <button
        type="button"
        className="mt-icon-button mt-delete-button"
        onClick={() => onDelete(item.id)}
        disabled={deleting}
        aria-label={`Delete ${name}`}
        title={`Delete ${name}`}
      >
        {deleting ? (
          <Spinner className="mt-delete-spinner" />
        ) : (
          <Icon name="delete" className="mt-delete-icon" />
        )}
      </button>
    </div>
  );
}

function DiarySkeleton() {
  return (
    <div className="mt-diary-skeleton" role="status" aria-label="Loading meal history">
      {[0, 1, 2].map((group) => (
        <div className="mt-meal-group mt-panel mt-skeleton-group" key={group}>
          <div className="mt-skeleton-head">
            <span className="mt-skeleton-block mt-skeleton-icon" />
            <span className="mt-skeleton-block mt-skeleton-title" />
            <span className="mt-skeleton-block mt-skeleton-add" />
          </div>
          <div className="mt-skeleton-row">
            <span className="mt-skeleton-block mt-skeleton-thumb" />
            <span className="mt-skeleton-lines">
              <span className="mt-skeleton-block mt-skeleton-line" />
              <span className="mt-skeleton-block mt-skeleton-line mt-skeleton-line--short" />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MealDiary({
  groups = [],
  loading = false,
  error = null,
  onRetry = undefined,
  onAdd = undefined,
  onDelete = undefined,
  deletingId = null,
  dateLabel = 'Today',
  caloriesToday = 0,
  calorieGoal = 0,
}) {
  const itemCount = groups.reduce((total, group) => total + group.items.length, 0);
  const hasItems = itemCount > 0;

  return (
    <section className="mt-diary" aria-labelledby="mt-diary-title">
      <div className="mt-section-head">
        <div>
          <p className="mt-section-kicker">{dateLabel} diary</p>
          <h2 className="mt-section-title" id="mt-diary-title">
            Daily meals
          </h2>
        </div>

        {!loading && !error && (
          <p className="mt-diary-count">
            <strong>{itemCount}</strong> {itemCount === 1 ? 'item' : 'items'}
            <span className="mt-diary-count-separator" aria-hidden="true" />
            {formatNumber(caloriesToday)} of {formatNumber(calorieGoal)} kcal
          </p>
        )}
      </div>

      {loading ? (
        <DiarySkeleton />
      ) : error ? (
        <div className="mt-diary-error">
          <ErrorState
            message={error.message || 'Could not load meal history.'}
            onRetry={onRetry}
          />
        </div>
      ) : (
        <>
          {!hasItems && (
            <p className="mt-diary-empty-note">
              No meals logged for this day yet. Choose a meal below to add your first entry.
            </p>
          )}

          <div className="mt-meal-groups">
            {groups.map((group) => {
              const meta = MEAL_META[group.type] || MEAL_META.Other;
              const count = group.items.length;
              const subtitle = count
                ? `${count} ${count === 1 ? 'item' : 'items'} · ${formatNumber(group.kcal)} kcal`
                : 'Nothing logged';

              return (
                <article
                  className={`mt-meal-group mt-panel mt-meal-group--${meta.className}`}
                  key={group.type}
                >
                  <header className="mt-meal-group-head">
                    <span className={`mt-meal-group-icon mt-meal-group-icon--${meta.className}`}>
                      <Icon name={meta.icon} className="mt-meal-group-icon-symbol" />
                    </span>

                    <div className="mt-meal-group-copy">
                      <h3 className="mt-meal-group-title">{group.type}</h3>
                      <p className="mt-meal-group-sub">{subtitle}</p>
                    </div>

                    <button
                      type="button"
                      className="mt-add-button"
                      onClick={() => onAdd?.(group.type)}
                      aria-label={`Add food to ${group.type}`}
                      title={`Add food to ${group.type}`}
                    >
                      <Icon name="add" className="mt-add-icon" />
                    </button>
                  </header>

                  {count > 0 && (
                    <div className="mt-meal-items">
                      {group.items.map((item) => (
                        <MealItem
                          key={item.id}
                          item={item}
                          type={group.type}
                          onDelete={onDelete}
                          deleting={deletingId === item.id}
                        />
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
