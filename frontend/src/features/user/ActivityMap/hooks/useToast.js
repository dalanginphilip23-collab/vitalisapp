// Legacy showToast(message, type) signature over the global toast store.
import { useToastStore } from '../../../../stores/toastStore.js';
import { useCallback } from 'react';

export const useToast = (duration = 2800) => {
  const addToast = useToastStore((s) => s.addToast);
  const showToast = useCallback(
    (message, type = 'ok') => {
      const variant = type === 'error' ? 'error' : type === 'warn' ? 'info' : 'success';
      addToast(message, variant, duration);
    },
    [addToast, duration]
  );
  // Keep legacy shape: { visible, message, type } always false (global handles render)
  return { toast: { visible: false, message: '', type: 'ok' }, showToast };
};
