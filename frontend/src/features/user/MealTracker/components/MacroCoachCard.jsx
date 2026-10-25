import { useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import { apiGet, apiPost } from '../../../../lib/apiClient.js';
import { useActiveGoal } from '../../Onboarding/hooks/useActiveGoal.js';
import { useTodayMeals } from '../../Dashboard/hooks/useTodayMeals.js';
import { macroCoachMessage } from '../../Dashboard/utils/macroCoach.js';
import { goalLabel } from '../../Onboarding/constants/goals.js';

// Macro Coach — lives inside Nutrition, powered by actual logged data vs goal targets.
// "View Suggestions" calls the AI suggest-plan endpoint for the latest meal and
// shows the recommended training plan + reasoning (master plan §5 Macro Coach).
const MacroCoachCard = ({ userId, lastMeal }) => {
  const { goal } = useActiveGoal(userId);
  const { meals } = useTodayMeals(userId);
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const viewSuggestions = async () => {
    if (loading) return;
    setLoading(true); setError('');
    try {
      // Prefer the just-logged meal; fall back to the latest history entry.
      let meal = lastMeal && lastMeal.food_name
        ? { food_name: lastMeal.food_name, calories: lastMeal.calories || 0, protein: lastMeal.protein || 0, carbs: lastMeal.carbs || 0, fat: lastMeal.fat || 0 }
        : null;
      if (!meal) {
        const data = await apiGet(`/api/food-logs/${userId}?limit=1`);
        const latest = (data.records || [])[0];
        if (!latest) throw new Error('Log a meal first to get suggestions.');
        meal = { food_name: latest.food_name, calories: latest.calories || 0, protein: latest.protein || 0, carbs: latest.carbs || 0, fat: latest.fat || 0 };
      }
      const data = await apiPost(`/api/food-logs/${userId}/suggest-plan`, {
        ...meal,
        // Same day-basis as the tracker's own totals (browser-local today),
        // so the coach reasons about the numbers the user actually sees.
        caloriesSoFar: meals.kcal || 0,
      }, { timeoutMs: 60000 });
      setSuggestion(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-coach mt-panel" aria-labelledby="mt-coach-title">
      <div className="mt-coach-head">
        <span className="mt-coach-icon" aria-hidden="true">
          <Icon name="auto_awesome" className="mt-coach-icon-symbol" />
        </span>
        <div className="mt-coach-heading">
          <p className="mt-kicker">Nutrition insight</p>
          <h2 className="mt-coach-title" id="mt-coach-title">Macro Coach</h2>
          <p className="mt-coach-goal">
            {goal
              ? `${goalLabel(goal.goalType)} · ${goal.dailyKcal?.toLocaleString() ?? '—'} kcal target`
              : 'Set a goal to unlock targets'}
          </p>
        </div>
      </div>

      <p className="mt-coach-message">{macroCoachMessage(meals, goal || {})}</p>

      <button
        type="button"
        onClick={viewSuggestions}
        disabled={loading}
        className="mt-coach-action"
      >
        <span>{loading ? 'Getting suggestions…' : 'View suggestions'}</span>
        {!loading && <Icon name="arrow_forward" className="mt-coach-action-icon" />}
      </button>

      {error && <p className="mt-coach-error" role="alert">{error}</p>}

      {suggestion && (
        <div className="mt-coach-result">
          <p className="mt-coach-result-message">{suggestion.message}</p>
          {suggestion.reasoning && (
            <p className="mt-coach-result-reasoning">{suggestion.reasoning}</p>
          )}
          {suggestion.recommended_plan ? (
            <div className="mt-coach-plan">
              <p className="mt-coach-plan-title">
                Recommended: {suggestion.recommended_plan.title || suggestion.recommended_plan.name}
              </p>
              {suggestion.estimated_minutes != null && (
                <p className="mt-coach-plan-note">
                  ~{suggestion.estimated_minutes} min to balance this meal
                </p>
              )}
            </div>
          ) : (
            <p className="mt-coach-plan-note">
              No training plan fits yet — enroll in a plan to get picks.
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default MacroCoachCard;
