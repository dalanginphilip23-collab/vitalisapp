// Training preferences — Module 5 personalization inputs (equipment, preferred
// days, session length, location). Pure logic + DB; controller stays thin.
const db = require('../config/db');
const { AppError } = require('../utils/errors');

// Canonical equipment catalog — must match the frontend picker exactly. The
// catalog's own equipment labels (workoutGuide) use lowercase names like
// 'dumbbell', 'barbell', 'bodyweight'; the session/schedule logic accepts
// either side because normalizeEquipment maps both spellings.
const EQUIPMENT_OPTIONS = [
  'Bodyweight',
  'Dumbbells',
  'Barbell',
  'Kettlebell',
  'Resistance Bands',
  'Machines',
  'Pull-up Bar',
  'Cardio Equipment',
];
const LOCATION_OPTIONS = ['Home', 'Gym', 'Outdoor', 'BFP Office', 'Other'];
const MIN_SESSION_MINS = 10;
const MAX_SESSION_MINS = 180;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "dumbbells" / 'Dumbbell' -> 'dumbbell', so prefs match the exercise catalog. */
function normalizeEquipmentName(raw) {
  return String(raw || '').toLowerCase().replace(/s$/, '').replace(/\s+equipment$/, '');
}

/** Map a user pref ('Dumbbells') to a catalog equipment label set. Used by the
 *  frontend; kept here so both sides agree through one shared rule. */
function equipmentMatchesCatalog(preference, catalogEquipment) {
  const pref = normalizeEquipmentName(preference);
  const cat = normalizeEquipmentName(catalogEquipment);
  if (cat === 'none' || cat === 'no equipment') return pref === 'bodyweight';
  return cat === pref || pref === 'bodyweight' && cat === 'bodyweight';
}

function cleanEquipment(raw) {
  const parsed = Array.isArray(raw) ? raw : [];
  const cleaned = [];
  for (const item of parsed) {
    if (typeof item !== 'string') continue;
    const t = item.trim();
    if (t.length === 0 || t.length > 60) continue;
    // Accept any of the canonical labels; tolerate free text (normalized for storage).
    cleaned.push(t);
    if (cleaned.length >= 8) break;
  }
  return Array.from(new Set(cleaned));
}

function cleanPreferredDays(raw) {
  const parsed = Array.isArray(raw) ? raw : [];
  const cleaned = parsed
    .filter((d) => Number.isInteger(Number(d)))
    .map((d) => Number(d))
    .filter((d) => d >= 0 && d <= 6);
  return Array.from(new Set(cleaned));
}

function validateInput(body) {
  const equipment = cleanEquipment(body?.equipment ?? []);
  const preferredDays = cleanPreferredDays(body?.preferred_days ?? []);

  let duration = null;
  if (body?.session_duration_mins !== undefined && body?.session_duration_mins !== null && body?.session_duration_mins !== '') {
    duration = Number(body.session_duration_mins);
    if (!Number.isInteger(duration) || duration < MIN_SESSION_MINS || duration > MAX_SESSION_MINS) {
      throw new AppError(`session_duration_mins must be an integer ${MIN_SESSION_MINS}–${MAX_SESSION_MINS}`, 400, 'INVALID_DURATION');
    }
  }

  let location = null;
  if (body?.workout_location !== undefined && body?.workout_location !== null && body?.workout_location !== '') {
    location = String(body.workout_location).trim().slice(0, 50) || null;
  }

  return { equipment, preferred_days: preferredDays, session_duration_mins: duration, workout_location: location };
}

/** Upsert (PK is user_id). Returns the saved row as plain JSON. */
async function save(userId, body) {
  const prefs = validateInput(body);
  await db.execute(
    `INSERT INTO training_preferences (user_id, equipment, preferred_days, session_duration_mins, workout_location)
       VALUES (?, CAST(? AS JSON), CAST(? AS JSON), ?, ?)
     ON DUPLICATE KEY UPDATE
       equipment = VALUES(equipment),
       preferred_days = VALUES(preferred_days),
       session_duration_mins = VALUES(session_duration_mins),
       workout_location = VALUES(workout_location)`,
    [
      userId,
      JSON.stringify(prefs.equipment),
      JSON.stringify(prefs.preferred_days),
      prefs.session_duration_mins,
      prefs.workout_location,
    ]
  );
  return get(userId);
}

/** Returns null when the user hasn't set preferences yet. */
async function get(userId) {
  const [[row]] = await db.execute(
    `SELECT equipment, preferred_days, session_duration_mins, workout_location, updated_at
       FROM training_preferences WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  if (!row) return null;
  return {
    equipment: safeParse(row.equipment),
    preferredDays: safeParse(row.preferred_days),
    sessionDurationMins: row.session_duration_mins != null ? Number(row.session_duration_mins) : null,
    workoutLocation: row.workout_location,
    updatedAt: row.updated_at,
  };
}

function safeParse(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = {
  EQUIPMENT_OPTIONS,
  LOCATION_OPTIONS,
  DAY_NAMES,
  MIN_SESSION_MINS,
  MAX_SESSION_MINS,
  normalizeEquipmentName,
  equipmentMatchesCatalog,
  validateInput,
  save,
  get,
};
