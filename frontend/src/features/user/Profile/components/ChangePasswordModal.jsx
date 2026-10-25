import { useCallback, useEffect, useRef, useState } from 'react';
import { apiPost } from '../../../../lib/apiClient.js';
import Modal from '../../../../components/ui/Modal.jsx';
import Button from '../../../../components/ui/Button.jsx';
import Icon from '../../../../components/Icon.jsx';
import PasswordField from './PasswordField.jsx';
import PasswordStrength from './PasswordStrength.jsx';
import '../password-ui.css';

/**
 * Change-password dialog.
 *
 * Props:
 *   onClose          — close the dialog
 *   onSuccess        — called after a confirmed update, before onClose
 *   onForgotPassword — opens the existing email-OTP reset flow
 *
 * The backend identifies the user from the session cookie. A wrong current
 * password returns 401 INVALID_PASSWORD, so this request opts out of the
 * global unauthorized redirect and handles that specific 401 inline.
 */
export default function ChangePasswordModal({ onClose, onSuccess, onForgotPassword }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const currentRef = useRef(null);
  const newRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    const timer = window.setTimeout(() => currentRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, []);

  const handleClose = useCallback(() => {
    if (!loading) onClose?.();
  }, [loading, onClose]);

  const clearFieldError = (field) => {
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
    setFormError('');
  };

  const validate = () => {
    const errors = {};

    if (!currentPassword) {
      errors.current = 'Enter your current password.';
    }
    if (newPassword.length < 8) {
      errors.new = 'New password must be at least 8 characters.';
    } else if (newPassword === currentPassword) {
      errors.new = 'New password must be different from your current password.';
    }
    if (newPassword !== confirmPassword) {
      errors.confirm = 'Passwords do not match.';
    }

    return errors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setFormError('');
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.current) currentRef.current?.focus();
      else if (errors.new) newRef.current?.focus();
      else confirmRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      await apiPost(
        '/api/auth/change-password',
        { currentPassword, newPassword },
        { skipAuthRedirect: true },
      );
      onSuccess?.();
      onClose?.();
    } catch (error) {
      const message = error?.message || 'Could not update your password. Please try again.';

      // A wrong current password is a credential check, not an expired session.
      if (error?.status === 401 && /current password/i.test(message)) {
        setFieldErrors({ current: message });
        currentRef.current?.focus();
      } else if (error?.status === 401) {
        // A genuine 401 from the auth middleware still follows the app-wide
        // expired-session path.
        window.dispatchEvent(new CustomEvent('vitalis:unauthorized'));
        setFormError('Your session expired. Please sign in again.');
      } else {
        setFormError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={handleClose}
      title="Change password"
      subtitle="Use a strong, unique password."
      icon="lock"
      size="xl"
      className="pw-modal pw-change-modal"
      headerClassName="pw-modal-head"
      closeOnBackdrop={!loading}
      footer={(
        <div className="pw-actions">
          <Button
            type="button"
            variant="ghost"
            className="pw-action"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="change-password-form"
            variant="primary"
            className="pw-action pw-action-primary"
            loading={loading}
            disabled={loading}
          >
            Update password
          </Button>
        </div>
      )}
    >
      <div className="pw-modal-content">
        <div className="pw-summary">
          <span className="pw-summary-icon" aria-hidden="true">
            <Icon name="shield" />
          </span>
          <div>
            <p className="pw-summary-title">Your session stays signed in</p>
            <p className="pw-summary-copy">
              Changing your password signs out other devices. This device remains signed in.
            </p>
          </div>
        </div>

        <form
          id="change-password-form"
          className="pw-form"
          onSubmit={handleSubmit}
          noValidate
          aria-busy={loading}
        >
          {formError && (
            <div className="pw-alert" role="alert">
              <Icon name="error" />
              <span>{formError}</span>
            </div>
          )}

          <PasswordField
            id="cp-current-password"
            label="Current password"
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              clearFieldError('current');
            }}
            autoComplete="current-password"
            placeholder="Enter password"
            helper="Enter the password you use to sign in today."
            error={fieldErrors.current}
            disabled={loading}
            inputRef={currentRef}
            labelAction={onForgotPassword ? (
              <button
                type="button"
                className="pw-label-action"
                onClick={onForgotPassword}
                disabled={loading}
              >
                Forgot password?
              </button>
            ) : undefined}
          />

          <PasswordField
            id="cp-new-password"
            label="New password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              clearFieldError('new');
            }}
            autoComplete="new-password"
            placeholder="Create password"
            helper="Use at least 8 characters."
            error={fieldErrors.new}
            disabled={loading}
            inputRef={newRef}
          >
            {newPassword ? (
              <div className="pw-strength-slot">
                <PasswordStrength password={newPassword} />
              </div>
            ) : null}
          </PasswordField>

          <PasswordField
            id="cp-confirm-password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearFieldError('confirm');
            }}
            autoComplete="new-password"
            placeholder="Re-enter password"
            helper="Re-enter your new password."
            success={
              confirmPassword && newPassword.length >= 8 && newPassword === confirmPassword
                ? 'Passwords match.'
                : ''
            }
            error={fieldErrors.confirm}
            disabled={loading}
            inputRef={confirmRef}
          />
        </form>
      </div>
    </Modal>
  );
}
