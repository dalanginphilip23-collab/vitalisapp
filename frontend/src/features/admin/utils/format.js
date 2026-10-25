export const fmtNum = (value) => Number(value || 0).toLocaleString('en-US');

export const initials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const fmtWhen = (value) => {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const fmtDay = (value) => {
  if (!value) return '—';
  const d = new Date(String(value).length <= 10 ? `${value}T00:00:00` : String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const humanize = (value) => String(value || '—')
  .toLowerCase()
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase());
