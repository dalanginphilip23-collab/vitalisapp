import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../../../lib/apiClient.js';

/**
 * Small data hook for the admin console.
 *
 * - Keeps the last successful payload while refreshing (no flicker).
 * - `loading` is true only until the first payload for the current path lands.
 * - Aborts in-flight requests when filters change / component unmounts.
 */
export function useAdminResource(path) {
  const [state, setState] = useState({ path: null, data: null, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    apiGet(path, { signal: controller.signal })
      .then((data) => {
        if (alive) setState({ path, data, error: null });
      })
      .catch((error) => {
        if (!alive || error?.code === 'ABORTED') return;
        setState({ path, data: null, error });
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.path === path;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current,
    reload,
  };
}
