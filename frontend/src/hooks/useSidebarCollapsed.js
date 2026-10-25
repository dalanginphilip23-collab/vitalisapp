import { useCallback, useEffect, useRef, useState } from 'react';
import { safeGet, safeSet } from '../lib/storage.js';

const STORAGE_KEY = 'vitalis:sidebarCollapsed';
const COMPACT_QUERY = '(max-width: 1023px)';

const readInitialState = () => {
  const stored = safeGet(STORAGE_KEY, null);
  if (stored === '1' || stored === '0') return stored === '1';
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(COMPACT_QUERY).matches;
};

/**
 * Persisted desktop-sidebar state.
 *
 * The preference lives in localStorage so it follows the user between the
 * dashboard and every AppShell page. If no preference exists yet, compact
 * widths start in the icon rail so the content keeps a usable column.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readInitialState);
  const userToggled = useRef(false);

  useEffect(() => {
    if (!userToggled.current) return;
    safeSet(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia(COMPACT_QUERY);
    const handleChange = (event) => {
      if (!event.matches || safeGet(STORAGE_KEY, null) !== null) return;
      setCollapsed(true);
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const toggle = useCallback(() => {
    userToggled.current = true;
    setCollapsed((previous) => !previous);
  }, []);

  return { collapsed, toggle };
}
