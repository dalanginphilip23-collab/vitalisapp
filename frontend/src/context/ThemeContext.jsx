import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiFetch } from '../lib/apiClient.js';
import { safeGet, safeSet } from '../lib/storage.js';
import { useAuth } from '../hooks/useAuth.jsx';

const ThemeContext = createContext(/** @type {any} */ (undefined));

const THEME_STORAGE_KEY = 'vitalis_theme';

// Skips server persists until a /settings round-trip proves the cookie is live
// (cached user can exist with a dead cookie and would only log 401 spam).
let serverSessionKnownGood = false;

// eslint-disable-next-line react-refresh/only-export-components
export function resetServerSessionKnownGood() {
  serverSessionKnownGood = false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('vitalis:unauthorized', resetServerSessionKnownGood);
  window.addEventListener('vitalis:logout', resetServerSessionKnownGood);
}

const fetchServerTheme = async () => {
  try {
    const data = await apiGet('/api/settings', { skipAuthRedirect: true });
    serverSessionKnownGood = true;
    const t = data?.settings?.theme;
    return t === 'light' || t === 'dark' || t === 'system' ? t : null;
  } catch (err) {
    if (err?.status === 401) serverSessionKnownGood = false;
    return null;
  }
};

const resolveEffective = (pref) => {
  if (pref === 'light' || pref === 'dark') return pref;
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const persistServerTheme = (theme) => {
  if (!serverSessionKnownGood) return Promise.resolve(null);
  try {
    return apiFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ theme }),
      skipAuthRedirect: true,
    }).then(
      () => null,
      (err) => {
        if (err?.status === 401) serverSessionKnownGood = false;
        return null;
      },
    );
  } catch {
    return Promise.resolve(null);
  }
};

export const ThemeProvider = ({ children }) => {
  const readPreference = () => {
    const savedTheme = safeGet(THEME_STORAGE_KEY, null);
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
      return savedTheme;
    }
    return null;
  };

  const getInitialPreference = () => readPreference() ?? 'system';

  const [preference, setPreferenceState] = useState(getInitialPreference);
  const [theme, setTheme] = useState(() => {
    const saved = readPreference();
    return saved ? resolveEffective(saved) : resolveEffective('system');
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const switchTimer = useRef(null);
  const smoothThemeWindow = useCallback(() => {
    try {
      const reduceMotion = typeof window !== 'undefined' && window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) return;
      if (switchTimer.current) clearTimeout(switchTimer.current);
      document.documentElement.classList.add('theme-switching');
      switchTimer.current = setTimeout(() => {
        try { document.documentElement.classList.remove('theme-switching'); } catch { /* noop */ }
      }, 500);
    } catch { /* noop */ }
  }, []);
  const hydratedFromServer = useRef(false);
  // Gate on proven session, not cached user (stale cache + dead cookie = 401 spam).
  const { user: authUser, sessionValid } = useAuth();
  const authUserId = sessionValid === true ? (authUser?.id ?? null) : null;

  useEffect(() => {
    if (!authUserId) return;
    let cancelled = false;
    fetchServerTheme().then((t) => {
      if (cancelled || hydratedFromServer.current) return;
      // Re-read storage at resolve time: a quick toggle may have landed while
      // the request was in flight — that local choice must win over the stale
      // server value, otherwise the theme visibly snaps back.
      const localNow = safeGet(THEME_STORAGE_KEY, null);
      const hasLocalNow = localNow === 'light' || localNow === 'dark' || localNow === 'system';
      if (t && !hasLocalNow) {
        hydratedFromServer.current = true;
        setPreferenceState(t);
        setTheme(resolveEffective(t));
      } else if (hasLocalNow && t && serverSessionKnownGood) {
        // Local choice is already on screen — publish it so the server
        // (and other devices) stay in sync with what was just toggled.
        persistServerTheme(localNow);
      }
    });
    return () => { cancelled = true; };
  }, [authUserId]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light-theme', 'dark-theme');
    root.classList.add(`${theme}-theme`);
    // Keep the browser/PWA chrome (address bar, status bar) in step with the theme.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#f5f7f1' : '#0d110c');
    safeSet(THEME_STORAGE_KEY, preference);
    if (!authUserId) return;
    persistServerTheme(preference);
  }, [theme, preference, authUserId]);

  useEffect(() => {
    if (preference !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preference]);

  const setPreferenceValue = useCallback((newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark' || newTheme === 'system') {
      setIsTransitioning(true);
      smoothThemeWindow();
      setPreferenceState(newTheme);
      setTheme(resolveEffective(newTheme));
      setTimeout(() => setIsTransitioning(false), 500);
    }
  }, [smoothThemeWindow]);

  const toggleTheme = useCallback(() => {
    // Quick toggle always lands on an explicit theme: flipping while on
    // 'system' pins the opposite of whatever is currently effective.
    setIsTransitioning(true);
    smoothThemeWindow();
    const effective = document.documentElement.classList.contains('light-theme') ? 'light' : 'dark';
    const next = effective === 'dark' ? 'light' : 'dark';
    setPreferenceState(next);
    setTheme(next);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [smoothThemeWindow]);

  return (
    <ThemeContext.Provider value={{
      theme,
      preference,
      setPreference: setPreferenceValue,
      toggleTheme,
      setTheme: setPreferenceValue,
      isTransitioning,
      isDark: theme === 'dark',
      isLight: theme === 'light',
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;