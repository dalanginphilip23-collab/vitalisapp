import { useState } from 'react';
import Icon from '../Icon.jsx';

export default function Input({
  label = undefined,
  error = undefined,
  helperText = undefined,
  icon = undefined,
  iconPosition = 'left',
  rightElement = undefined,
  className = '',
  id = undefined,
  required = false,
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
          className={`text-[length:var(--fs-13)] font-medium transition-colors ${hasError ? 'text-[var(--error)]' : focused ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
        >
          {label} {required && <span className="text-[var(--error)]">*</span>}
        </label>
      )}
      <div className="relative group">
        {icon && iconPosition === 'left' && (
          <Icon
            name={icon}
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-[length:var(--fs-18)] transition-colors pointer-events-none ${hasError ? 'text-[var(--error)]' : focused ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}
          />
        )}
        <input
          id={inputId}
          required={required}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          className={`w-full h-11 rounded-[var(--radius-md)] bg-[var(--input-bg)] border text-[length:var(--fs-15)] text-[var(--text-primary)] placeholder:text-[var(--input-placeholder)] outline-none transition-[border-color,box-shadow,background-color]
            ${hasError ? 'border-[var(--error)]/60 focus:border-[var(--error)] focus:ring-4 focus:ring-[var(--error)]/15' : 'border-[var(--input-border)] focus:border-[var(--accent-border)] focus:ring-4 focus:ring-[var(--accent)]/12'}
            ${icon && iconPosition === 'left' ? 'pl-11 pr-4' : icon && iconPosition === 'right' ? 'pl-4 pr-11' : 'px-4'}
            ${rightElement ? 'pr-11' : ''}
            ${className}`}
          {...props}
        />
        {icon && iconPosition === 'right' && (
          <Icon name={icon} className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-[length:var(--fs-18)] pointer-events-none ${hasError ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`} />
        )}
        {rightElement && <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</div>}
      </div>
      {hasError ? (
        <p id={`${inputId}-error`} className="text-[length:var(--fs-12)] text-[var(--error)] px-1">{error}</p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="text-[length:var(--fs-12)] text-[var(--text-muted)] px-1">{helperText}</p>
      ) : null}
    </div>
  );
}
