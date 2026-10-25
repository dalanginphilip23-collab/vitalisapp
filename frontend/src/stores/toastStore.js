import { create } from 'zustand';

let idCounter = 0;
const timers = new Map();

// Single source for all toasts. Variants: success | error | info.
export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (message, variant = 'info', duration = 4000, options = {}) => {
    const id = ++idCounter;
    const title = options.title || message;
    const description = options.description || '';
    // Cap 20: sticky (duration 0) toasts would otherwise grow unbounded.
    set((state) => ({ toasts: [...state.toasts.slice(-19), { id, message, variant, title, description, duration }] }));
    if (duration > 0) {
      const t = setTimeout(() => {
        timers.delete(id);
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, duration);
      try { /** @type {any} */ (t)?.unref?.(); } catch { /* noop */ }
      timers.set(id, t);
    }
    return id;
  },
  removeToast: (id) => {
    const t = timers.get(id);
    if (t) { try { clearTimeout(t); } catch { /* noop */ } timers.delete(id); }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  clearToasts: () => {
    for (const [, t] of timers) { try { clearTimeout(t); } catch { /* noop */ } }
    timers.clear();
    set({ toasts: [] });
  },
}));

// Legacy alias: `useNotification().addToast`
export const useNotification = () => {
  const { addToast, removeToast } = useToastStore();
  return { addToast, removeToast };
};
