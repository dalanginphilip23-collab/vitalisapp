// Auto-loading: if onClick returns a promise, spinner shows until it settles.
// Explicit `loading` / `isLoading` prop still wins for form submits.
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  loading = false,
  isLoading = false,
  disabled = false,
  icon = undefined,
  iconPosition = 'left',
  fullWidth = false,
  type = 'button',
  onClick = undefined,
  ...props
}) {
  const [autoBusy, setAutoBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const busy = Boolean(loading || isLoading || autoBusy);

  const handleClick = useCallback(async (e) => {
    if (!onClick || busy) return;
    let result;
    try {
      result = onClick(e);
    } catch {
      return;
    }
    // Sync handler (navigation, toggles) — flash press animation only.
    if (!result || typeof result.then !== 'function') return;
    setAutoBusy(true);
    try {
      await result;
    } catch {
      // Caller toasts the error — just drop the spinner.
    } finally {
      if (mounted.current) setAutoBusy(false);
    }
  }, [onClick, busy]);
  const base =
    'inline-flex items-center justify-center font-semibold rounded-[var(--radius-md)] ' +
    'transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-out border ' +
    'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] select-none touch-manipulation ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]';
  const variants = {
    primary: 'bg-[var(--accent)] text-[var(--text-inverse)] border-transparent hover:brightness-95 shadow-[var(--shadow-sm)]',
    ghost: 'bg-transparent text-[var(--text-primary)] border-[var(--border-light)] hover:bg-[var(--bg-hover)]',
    outline: 'bg-transparent text-[var(--text-primary)] border-[var(--border-medium)] hover:border-[var(--border-heavy)] hover:bg-[var(--bg-hover)]',
    danger: 'bg-[var(--error)] text-white border-transparent hover:brightness-110',
    subtle: 'bg-[var(--accent-bg)] text-[var(--accent)] border-[var(--accent-border)] hover:bg-[var(--accent)] hover:text-[var(--text-inverse)]',
  };
  const sizes = {
    sm: 'px-3.5 py-2 text-[length:var(--fs-13)] gap-1.5',
    md: 'px-5 py-2.5 text-[length:var(--fs-14)] gap-2',
    lg: 'px-6 py-3 text-[length:var(--fs-15)] gap-2',
    icon: 'p-2.5 aspect-square',
  };

  const isDisabled = disabled || busy;

  return (
    <button
      type={/** @type {'button' | 'submit' | 'reset'} */ (type)}
      disabled={isDisabled}
      data-managed-loading
      onClick={onClick ? handleClick : undefined}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${fullWidth ? 'w-full' : ''} ${busy ? 'btn-is-busy' : ''} ${className}`}
      aria-busy={busy || undefined}
      data-loading={busy ? 'true' : undefined}
      {...props}
    >
      {busy && (
        <span className="btn-spinner w-3.5 h-3.5 rounded-full border-2 border-transparent border-t-current animate-spin shrink-0" aria-hidden="true" />
      )}
      {!busy && icon && iconPosition === 'left' && <Icon name={icon} className="text-[length:var(--fs-16)] shrink-0" />}
      <span className="truncate">{children}</span>
      {!busy && icon && iconPosition === 'right' && <Icon name={icon} className="text-[length:var(--fs-16)] shrink-0" />}
    </button>
  );
}
