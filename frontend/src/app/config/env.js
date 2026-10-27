// Empty VITE_API_URL = same-origin via Vite dev proxy (keeps cookie first-party).
function normalizeUrl(value) {
  const trimmed = (value ?? '').trim().replace(/\/$/, '');
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return trimmed;
  } catch {
    return '';
  }
}

const rawApi = (import.meta.env.VITE_API_URL ?? '').trim();
const normalizedApi = rawApi ? normalizeUrl(rawApi) : '';
export const API_BASE_URL = normalizedApi;

export const ENV_ERROR =
  rawApi && !normalizedApi
    ? `[env] VITE_API_URL is invalid ("${rawApi}") — expected absolute http(s) URL. Set VITE_API_URL to the backend URL and rebuild.`
    : !rawApi && import.meta.env.PROD
      ? '[env] VITE_API_URL is unset in a production build — API calls will hit the static host. Set VITE_API_URL to the backend URL and rebuild.'
      : '';

if (ENV_ERROR) {
  console.error(ENV_ERROR);
}

const rawSocket = (import.meta.env.VITE_SOCKET_URL ?? '').trim();
export const SOCKET_URL = rawSocket ? normalizeUrl(rawSocket) || API_BASE_URL : API_BASE_URL;

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Backend-stored assets (e.g. /uploads/food/x.jpg from the multer pipeline) are
// relative to the API origin. In dev the Vite proxy serves them same-origin;
// in prod they must ride on the absolute VITE_API_URL base.
export function resolveAssetUrl(path) {
  const p = String(path || '');
  if (!p || /^(data|blob|https?):/i.test(p)) return p;
  return p.startsWith('/') ? `${API_BASE_URL}${p}` : p;
}

export default API_BASE_URL;
