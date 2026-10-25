// Module 5 — "fit to minutes": trims a plan day to a time budget while keeping
// warm-up-first order. Deterministic, user-triggered (never automatic).

/** Rough per-exercise minutes: sets × (work seconds + rest). Work seconds are
 *  reps × 4s for rep exercises or the hold duration; conservative (~30s/set
 *  work meme) — better to slightly under-trim than over-trim. */
export function estimateExerciseSeconds(ex) {
  if (!ex) return 0;
  const sets = Math.max(1, Number(ex.sets) || 1);
  const rest = Number(ex.restSeconds) || 45;
  let work;
  if (ex.durationSeconds) work = Number(ex.durationSeconds) || 30;
  else {
    const reps = parseInt(String(ex.reps ?? ''), 10); // '12', '10 each side', '8-12' → first int
    work = Number.isFinite(reps) && reps > 0 ? reps * 4 : 30;
  }
  return sets * (work + rest);
}

export function estimateDayMinutes(exercises) {
  const secs = (exercises || []).reduce((s, ex) => s + estimateExerciseSeconds(ex), 0);
  return Math.round(secs / 60);
}

/**
 * Returns { exercises, durationMins, trimmed, dropped, reduced } — a trimmed
 * copy of the day's exercise list fitting `budgetMins`. Order preserved;
 * trailing exercises drop first, then set-counts cap at 2. Never mutates input.
 */
export function fitDayToMinutes(day, budgetMins) {
  const exercises = (day?.exercises || []).map((ex) => ({ ...ex }));
  const budget = Number(budgetMins) || 0;
  if (budget <= 0 || exercises.length === 0) {
    return { exercises, durationMins: day?.duration_mins ?? null, trimmed: false };
  }
  let totalSecs = () => exercises.reduce((s, ex) => s + estimateExerciseSeconds(ex), 0);

  if (totalSecs() / 60 <= budget) {
    return { exercises, durationMins: day?.duration_mins ?? null, trimmed: false };
  }

  let dropped = 0;
  let reduced = false;

  // Pass 1 — cap set counts at 2 (keeps every movement in).
  for (const ex of exercises) {
    if (totalSecs() / 60 <= budget) break;
    if ((Number(ex.sets) || 1) > 2) {
      ex.sets = 2;
      reduced = true;
    }
  }

  // Pass 2 — drop trailing exercises (keep the first: warm-ups/order).
  while (exercises.length > 1 && totalSecs() / 60 > budget) {
    exercises.pop();
    dropped += 1;
  }

  return {
    exercises,
    durationMins: Math.max(5, Math.round(totalSecs() / 60)),
    trimmed: true,
    dropped,
    reduced,
  };
}
