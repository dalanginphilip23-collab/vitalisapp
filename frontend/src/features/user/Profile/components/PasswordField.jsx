import { useState } from 'react';
import Icon from '../../../../components/Icon.jsx';

/**
 * Theme-aware password field used by the Profile security modals.
 * Visibility is local to each field, so toggling one never clears or exposes
 * the others.
 */
export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  placeholder = 'Enter password',
  helper = '',
  error = '',
  success = '',
  disabled = false,
  inputRef = undefined,
  autoFocus = false,
  labelAction = undefined,
  children = undefined,
  onBlur = undefined,
}) {
  const [visible, setVisible] = useState(false);
  const messageId = `${id}-message`;
  const hasError = Boolean(error);
  const successMessage = !hasError ? success : '';
  const IconTag = Icon;

  return (
    <div className="pw-field">
      <div className="pw-label-row">
        <label className="pw-label" htmlFor={id}>{label}</label>
        {labelAction}
      </div>

      <div className="pw-input-wrap">
        <input
          ref={inputRef}
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          className={`pw-input${hasError ? ' is-invalid' : ''}`}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={hasError || undefined}
          aria-describedby={messageId}
        />
        <button
          type="button"
          className="pw-eye"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          aria-controls={id}
        >
          <IconTag name={visible ? 'visibility_off' : 'visibility'} />
        </button>
      </div>

      <p
        id={messageId}
        className={`pw-message${hasError ? ' is-error' : ''}${successMessage ? ' is-success' : ''}`}
        role={hasError ? 'alert' : undefined}
      >
        {hasError ? <IconTag name="error" /> : null}
        {successMessage ? <IconTag name="check_circle" /> : null}
        <span>{error || successMessage || helper || '\u00A0'}</span>
      </p>

      {children}
    </div>
  );
}
