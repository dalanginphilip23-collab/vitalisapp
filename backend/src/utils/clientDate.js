// Client-anchored "today". The browser sends its own local date as
// ?today=YYYY-MM-DD on dashboard reads, so the week card, streak strip and
// "today" flags follow the USER's calendar instead of the server's timezone
// (the two can disagree by a day around local midnight).
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Returns the query's ?today= when well-formed, else null so the caller can
// fall back to the server clock (old clients, direct API calls, tests).
// Rejects impossible dates too — 2026-02-31 would otherwise parse as Mar 3.
function clientDateFromQuery(query) {
  const value = String(query?.today ?? "").trim();
  if (!ISO_DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) !== value) return null;
  return value;
}

module.exports = { clientDateFromQuery, ISO_DATE_RE };
