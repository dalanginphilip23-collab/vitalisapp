// User allergies — storage + matching against AI-detected food allergens.
// Table: user_allergies (migration 033). One row per allergy, many per user.
const db = require('../config/db');

const MAX_NAME = 60;
const MAX_PER_USER = 30;

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// crude but effective singularisation: "peanuts" -> "peanut", "eggs" -> "egg"
// ("glass"/"dress" style words don't appear in allergen names).
const singular = (s) => (s.length > 3 && s.endsWith('s') && !s.endsWith('ss') ? s.slice(0, -1) : s);

// Synonym groups so either side can name the allergen:
//   user "tree nuts"  vs AI "almond"   → same group
//   user "shellfish"  vs AI "shrimp"   → same group
//   user "milk"       vs AI "dairy"    → same group
const ALLERGEN_GROUPS = [
  ['peanut', 'peanuts', 'groundnut', 'groundnuts'],
  ['tree nut', 'tree nuts', 'nut', 'nuts', 'almond', 'almonds', 'cashew', 'cashews', 'walnut', 'walnuts', 'pecan', 'pecans', 'pistachio', 'pistachios', 'hazelnut', 'hazelnuts', 'macadamia', 'macadamias', 'brazil nut'],
  ['milk', 'dairy', 'lactose'],
  ['egg', 'eggs'],
  ['gluten', 'wheat'],
  ['soy', 'soya', 'soybean', 'soybeans'],
  ['fish'],
  ['shellfish', 'crustacean', 'crustaceans', 'shrimp', 'prawn', 'prawns', 'crab', 'crabs', 'lobster', 'lobsters', 'scallops', 'clams', 'mussels', 'oysters', 'squid', 'octopus'],
  ['sesame', 'sesames', 'tahini'],
];

const TERM_TO_GROUP = (() => {
  const map = new Map();
  ALLERGEN_GROUPS.forEach((group, i) => group.forEach((t) => map.set(t, i)));
  return map;
})();

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// group index for a term, or -1. Falls back to the singular form.
function groupIndex(term) {
  const t = norm(term);
  const direct = TERM_TO_GROUP.get(t);
  if (direct !== undefined) return direct;
  const s = singular(t);
  return TERM_TO_GROUP.get(s) ?? -1;
}

/**
 * Sanitise a client-provided allergy list: array of short strings only,
 * trimmed/collapsed, de-duplicated case-insensitively, capped.
 * Returns [] for anything that isn't an array.
 */
function sanitizeList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const name = raw.trim().replace(/\s+/g, ' ').replace(/[<>]/g, '');
    if (name.length < 2 || name.length > MAX_NAME) continue;
    const key = norm(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_PER_USER) break;
  }
  return out;
}

/** GET — best-effort: a read failure must never break a caller's UI. */
async function getAllergies(userId) {
  if (!userId) return [];
  try {
    const [rows] = await db.execute(
      'SELECT allergy_name FROM user_allergies WHERE user_id = ? ORDER BY id ASC',
      [userId],
    );
    return rows.map((r) => r.allergy_name);
  } catch {
    return [];
  }
}

/**
 * PUT semantics — replaces the whole list for the user.
 * Array input: saves (possibly empty, which clears). Throws on DB failure so
 * callers decide whether that is fatal (onboarding keeps going: it logs).
 */
async function setAllergies(userId, list) {
  if (!userId) return;
  const items = sanitizeList(list);
  await db.execute('DELETE FROM user_allergies WHERE user_id = ?', [userId]);
  if (!items.length) return;
  const placeholders = items.map(() => '(?, ?)').join(', ');
  await db.execute(
    `INSERT INTO user_allergies (user_id, allergy_name) VALUES ${placeholders}`,
    [userId, ...items],
  );
}

/**
 * Which of the user's allergies does this food item touch?
 * Returns the user's original allergy names (e.g. "Peanuts") — never []-falsy
 * ambiguity: a non-empty array means "flag this".
 *
 * Signals, in order of trust:
 *   1. item.possible_allergens — what the vision model said is in the dish
 *   2. item.food_name / item.serving — word-boundary match on the name itself
 *      (word-boundary avoids egg → "eggplant")
 *
 * Matching is synonym-group aware and singular-insensitive.
 */
function matchAllergies(userAllergies, item = {}) {
  const mine = sanitizeList(userAllergies);
  if (!mine.length) return [];

  const detected = Array.isArray(item.possible_allergens)
    ? item.possible_allergens.filter((x) => typeof x === 'string').map(norm).filter(Boolean)
    : [];

  // name text: use word-boundary matching so "egg" doesn't hit "eggplant"
  const names = [norm(item.food_name), norm(item.serving)].filter(Boolean);
  const nameWordRe = (term) => {
    const forms = new Set([term, singular(term)]);
    // every synonym of the user's allergen can appear inside the food name
    const gi = groupIndex(term);
    if (gi >= 0) ALLERGEN_GROUPS[gi].forEach((v) => forms.add(v));
    return new RegExp(`(?:^|[^a-z0-9])(?:${[...forms].map(escapeRegExp).join('|')})(?![a-z0-9])`, 'i');
  };

  const hits = [];
  for (const allergy of mine) {
    const a = norm(allergy);
    const aSing = singular(a);
    const gi = groupIndex(a);

    const viaDetected = detected.some((d) => {
      const dSing = singular(d);
      if (gi >= 0 && groupIndex(d) === gi) return true; // synonym group
      // plain containment covers custom entries ("cashew butter")
      return d === a || d === aSing || dSing === a || dSing === aSing
        || d.includes(aSing) || a.includes(dSing);
    });

    const viaName = !viaDetected && names.some((n) => nameWordRe(a).test(n));

    if (viaDetected || viaName) hits.push(allergy);
  }
  return hits;
}

/**
 * Attach `allergy_matches` to each item of an analyze-pic payload.
 * IMPORTANT: never mutates `result` — it may be the shared cached object.
 * Returns the original object untouched when the user has no allergies.
 */
async function attachMatches(userId, result) {
  if (!result || !Array.isArray(result.items) || result.items.length === 0) return result;
  const mine = await getAllergies(userId);
  if (!mine.length) return result;

  let flagged = false;
  const items = result.items.map((it) => {
    const matches = matchAllergies(mine, it || {});
    if (!matches.length) return it;
    flagged = true;
    return { ...(it || {}), allergy_matches: matches };
  });
  return flagged ? { ...result, items } : result;
}

module.exports = { getAllergies, setAllergies, sanitizeList, matchAllergies, attachMatches };
