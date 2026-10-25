// Single app-wide SSE connection (survives navigation; pages subscribe).
import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../app/config/env.js';
import { useAuth } from '../hooks/useAuth.jsx';

const NotificationStreamContext = createContext({
  subscribe: /** @type {(fn: (notification: any) => void) => () => void} */ (() => () => {}),
});

export const NotificationStreamProvider = ({ children }) => {
  const { user, sessionValid } = useAuth();
  // Proven session only: stale cache + dead cookie would instantly 401.
  const userId = sessionValid === true ? (user?.id ?? null) : null;
  const listeners = useRef(new Set());

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => { listeners.current.delete(fn); };
  }, []);

  useEffect(() => {
    if (!userId) return;

    let es = null;
    let retryTimer = null;
    let retryDelay = 3000;
    let destroyed = false;

    const emit = (payload) => {
      for (const fn of [...listeners.current]) {
        try {
          fn(payload);
        } catch {
          /* one bad listener must not break the others */
        }
      }
    };

    const connect = () => {
      if (destroyed) return;

      // withCredentials sends the session cookie (required cross-origin).
      es = new EventSource(
        `${API_BASE_URL}/api/notifications/stream/${encodeURIComponent(userId)}`,
        { withCredentials: true }
      );

      es.onopen = () => {
        retryDelay = 3000;
      };

      es.onmessage = (e) => {
        try {
          emit(JSON.parse(e.data));
        } catch {
          /* ignore malformed payloads */
        }
      };

      es.onerror = () => {
        // EventSource hides HTTP status: probe once; dead sessions stay closed.
        es.close();
        if (destroyed) return;
        import('../lib/apiClient.js').then(async ({ apiGet }) => {
          try {
            await apiGet(`/api/notifications/${encodeURIComponent(userId)}`, { timeoutMs: 5000, skipAuthRedirect: true });
          } catch (err) {
            if (err?.status === 401 || err?.status === 403) return; // stay closed, no retry spam
          }
          if (!destroyed) {
            retryTimer = setTimeout(() => {
              retryDelay = Math.min(retryDelay * 1.5, 30000);
              connect();
            }, retryDelay);
          }
        }).catch(() => {
          if (!destroyed) {
            retryTimer = setTimeout(() => {
              retryDelay = Math.min(retryDelay * 1.5, 30000);
              connect();
            }, retryDelay);
          }
        });
      };
    };

    connect();

    return () => {
      destroyed = true;
      clearTimeout(retryTimer);
      es?.close();
    };
  }, [userId]);

  return (
    <NotificationStreamContext.Provider value={{ subscribe }}>
      {children}
    </NotificationStreamContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotificationStream = () => useContext(NotificationStreamContext);

export default NotificationStreamContext;
