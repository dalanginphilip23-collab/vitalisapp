import { useLocation } from 'react-router-dom';

/**
 * Base path for account destinations (profile, preferences, notifications,
 * help). Both shells render the same pages, so in-page links must stay inside
 * whichever shell the person is already using.
 */
export function useAccountBasePath() {
  const { pathname } = useLocation();
  return pathname.startsWith('/admin') ? '/admin' : '/dashboard';
}
