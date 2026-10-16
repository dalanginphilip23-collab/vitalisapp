import { useState } from 'react';
import Icon from '../Icon.jsx';

export default function Input({
  label,
  error,
  helperText,
  icon,
  iconPosition = 'left',
  rightElement,
  className = '',
  id,
  required,
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);
  const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className={`text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${hasError ? 'text-red-400' : focused ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}
        >
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <div className="relative group">
        {icon && iconPosition === 'left' && (
          <Icon
            name={icon}
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] transition-colors pointer-events-none ${hasError ? 'text-red-400' : focused ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}
          />
        )}
        <input
          id={inputId}
          required={required}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          className={`w-full h-11 rounded-xl bg-[var(--input-bg)] border text-[16px] sm:text-[14px] text-[var(--text-primary)] placeholder:text-[var(--input-placeholder)] outline-none transition-all
            ${hasError ? 'border-red-500/60 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20' : 'border-[var(--input-border)] focus:border-[var(--accent-border)] focus:ring-1 focus:ring-[var(--accent-border)] focus:bg-[var(--bg-active)]'}
            ${icon && iconPosition === 'left' ? 'pl-11 pr-4' : icon && iconPosition === 'right' ? 'pl-4 pr-11' : 'px-4'}
            ${rightElement ? 'pr-11' : ''}
            ${className}`}
          {...props}
        />
        {icon && iconPosition === 'right' && (
          <Icon name={icon} className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none ${hasError ? 'text-red-400' : 'text-[var(--text-muted)]'}`} />
        )}
        {rightElement && <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</div>}
      </div>
      {hasError ? (
        <p id={`${inputId}-error`} className="text-[11px] text-red-400 px-1">{error}</p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="text-[11px] text-[var(--text-muted)] px-1">{helperText}</p>
      ) : null}
    </div>
  );
}
