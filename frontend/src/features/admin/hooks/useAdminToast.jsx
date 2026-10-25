import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../../../components/Icon.jsx';

const TOAST_ICONS = { success: 'check_circle', error: 'error', info: 'info' };

/** Tiny single-toast controller shared by the admin pages. */
export function useAdminToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback((message, tone = 'success') => {
    clearTimeout(timer.current);
    setToast({ message, tone, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const node = toast ? (
    <div
      className={`adm-toast${toast.tone === 'error' ? ' is-error' : toast.tone === 'info' ? ' is-info' : ''}`}
      role="status"
    >
      <Icon name={TOAST_ICONS[toast.tone] || TOAST_ICONS.success} />
      {toast.message}
    </div>
  ) : null;

  return { show, node };
}
