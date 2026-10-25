/**
 * Fill the sparse per-day AI usage rows returned by /api/admin/ai-usage into a
 * continuous UTC-day series. The API only returns days that have usage, so the
 * chart needs zero-filled gaps to read as a real timeline.
 */
export function buildUsageSeries(rows = [], days = 14) {
  const byDay = new Map(
    (Array.isArray(rows) ? rows : []).map((row) => [String(row.usage_day).slice(0, 10), row]),
  );
  const now = new Date();
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = day.toISOString().slice(0, 10);
    const row = byDay.get(key);
    series.push({
      usage_day: key,
      calls: Number(row?.calls || 0),
      users: Number(row?.users || 0),
    });
  }
  return series;
}
