export const formatSeconds = (totalSeconds) => {
  if (!totalSeconds) return '';
  if (totalSeconds >= 60) {
    const mins = Math.round(totalSeconds / 60);
    return `${mins} min`;
  }
  return `${totalSeconds}s`;
};

export const formatExerciseDetail = (ex) => {
  const parts = [];
  if (ex.sets && ex.reps) {
    parts.push(`${ex.sets} sets × ${ex.reps} reps`);
  } else if (ex.sets && ex.durationSeconds) {
    parts.push(`${ex.sets} rounds × ${formatSeconds(ex.durationSeconds)}`);
  } else if (ex.durationSeconds) {
    parts.push(formatSeconds(ex.durationSeconds));
  } else if (ex.sets) {
    parts.push(`${ex.sets} sets`);
  }
  if (ex.restSeconds) {
    parts.push(`${formatSeconds(ex.restSeconds)} rest`);
  }
  if (ex.notes) {
    parts.push(ex.notes);
  }
  return parts.join(' · ');
};

export const REST_ACTIVITY_TYPES = new Set(['Recovery', 'Mobility', 'Flexibility']);

export const INTENSITY_OPTIONS = ['All', 'Beginner', 'Moderate', 'Advanced', 'Extreme'];
export const FOCUS_OPTIONS = ['All', 'Strength', 'Cardio', 'Flexibility', 'Recovery', 'Fat Loss', 'Hypertrophy'];
export const DURATION_OPTIONS = ['All', '1 Week', '2 Weeks', '4 Weeks', '8 Weeks', '12 Weeks'];

export const CATEGORIES = [
  { label: 'All',         icon: 'grid_view',             tag: null },
  { label: 'Strength',    icon: 'fitness_center',        tag: 'Strength' },
  { label: 'Fat Loss',    icon: 'local_fire_department', tag: 'Fat Loss' },
  { label: 'Recovery',    icon: 'spa',                   tag: 'Recovery' },
  { label: 'Cardio',      icon: 'directions_run',        tag: 'Cardio' },
  { label: 'Flexibility', icon: 'self_improvement',      tag: 'Flexibility' },
];

export const TABS = [
  { id: 'my-plans', label: 'My Plans',  icon: 'bookmarks' },
  { id: 'find',     label: 'Find Plan', icon: 'search'    },
  { id: 'explore',  label: 'Explore',   icon: 'explore'   },
  { id: 'library',  label: 'Library',   icon: 'fitness_center' },
  { id: 'history',  label: 'History',   icon: 'history'   },
];
