// Lightweight toast for non-critical confirmations. Use SuccessModal only
// for destructive / irreversible actions.
// Props: message, visible, onDismiss, duration (default 2800),
// variant: 'success' | 'error' | 'info'.
import { useEffect } from 'react';

const VARIANTS = {
  success: {
    bg: 'bg-[var(--accent)]',
    text: 'text-[var(--text-inverse)]',
    icon: 'check_circle',
  },
  error: {
    bg: 'bg-[var(--error)]',
    text: 'text-[var(--text-inverse)]',
    icon: 'error',
  },
  info: {
    bg: 'bg-[var(--bg-card)] backdrop-blur border border-[var(--border-medium)]',
    text: 'text-[var(--text-primary)]',
    icon: 'info',
  },
};

const Toast = ({
  message,
  visible,
  onDismiss,
  duration = 2800,
  variant = 'success',
}) => {
  const v = VARIANTS[variant] ?? VARIANTS.success;

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => onDismiss?.(), duration);
    return () => clearTimeout(t);
  }, [visible, duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 z-[110] flex items-center gap-2.5
        px-5 py-3 rounded-full shadow-xl pointer-events-none
        transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        ${v.bg} ${v.text}
        ${visible
          ? 'opacity-100 translate-x-[-50%] translate-y-0'
          : 'opacity-0 translate-x-[-50%] translate-y-6'
        }`}
    >
      <span className="material-symbols-outlined text-[length:var(--fs-17)]">{v.icon}</span>
      <span className="text-[length:var(--fs-11)] font-black uppercase tracking-[0.08em] whitespace-nowrap">
        {message}
      </span>
    </div>
  );
};

export default Toast;