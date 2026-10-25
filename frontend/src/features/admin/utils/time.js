const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
};

const pad = (value) => String(value).padStart(2, '0');

/** Local YYYY-MM-DD key shared by the calendar and its activity filter. */
export const localDayKey = (value) => {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Compact timestamp for the dashboard rail (e.g. "8m ago", "Oct 18"). */
export function fmtAgo(value) {
  const date = parseDate(value);
  if (!date) return '—';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Single timestamp used in calendar footers and rail rows. */
export function fmtShot(value) {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
