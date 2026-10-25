import { useCallback, useEffect, useRef } from 'react';
import { useForgotPassword } from '../hooks/useForgotPassword.js';
import Modal from '../../../../components/ui/Modal.jsx';
import Button from '../../../../components/ui/Button.jsx';
import Icon from '../../../../components/Icon.jsx';
import PasswordField from './PasswordField.jsx';
import PasswordStrength from './PasswordStrength.jsx';
import OtpInput from './OtpInput.jsx';
import '../password-ui.css';

const STEP_META = [
  {
    title: 'Reset password',
    subtitle: 'Verify your email to choose a new password.',
    icon: 'lock_reset',
  },
  {
    title: 'Check your inbox',
    subtitle: 'Enter the 6-digit code we emailed you.',
    icon: 'mark_email_read',
  },
  {
    title: 'Choose a new password',
    subtitle: 'This signs out every device.',
    icon: 'password',
  },
  {
    title: 'Password reset',
    subtitle: 'All devices have been signed out.',
    icon: 'verified_user',
  },
];

const STEP_LABELS = ['Email', 'Code', 'Password'];

/**
 * Profile forgot-password dialog.
 *
 * Reuses the existing email-OTP endpoints and validation through
 * useForgotPassword. Presentation is owned here so it matches the premium
 * security form, but the reset still revokes every session.
 */
export default function ForgotPasswordModal({ defaultEmail, onClose, onBack, onDone }) {
  const flow = useForgotPassword({ initialEmail: defaultEmail || '' });
  const { step } = flow;
  const meta = STEP_META[step] || STEP_META[0];
  const emailRef = useRef(null);
  const newPasswordRef = useRef(null);

  const handleClose = useCallback(() => {
    // After a completed reset the session is already revoked; the only safe
    // exit is the explicit "Go to sign in" action.
    if (flow.loading || flow.step === 3) return;
    onClose?.();
  }, [flow.loading, flow.step, onClose]);

  const handleBack = useCallback(() => {
    if (flow.loading) return;
    if (onBack) onBack();
    else onClose?.();
  }, [flow.loading, onBack, onClose]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (flow.step === 0) emailRef.current?.focus();
      if (flow.step === 2) newPasswordRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [flow.step]);

  const errorAlert = flow.error ? (
    <div className="pw-alert" role="alert">
      <Icon name="error" />
      <span>{flow.error}</span>
    </div>
  ) : null;

  const footer = (() => {
    if (step === 3) {
      return (
        <Button
          type="button"
          variant="primary"
          className="pw-action pw-action-full"
          onClick={onDone}
          autoFocus
        >
          Go to sign in
        </Button>
      );
    }

    if (step === 0) {
      return (
        <div className="pw-actions">
          <Button
            type="button"
            variant="ghost"
            className="pw-action"
            onClick={handleBack}
            disabled={flow.loading}
          >
            Back
          </Button>
          <Button
            type="submit"
            form="forgot-email-form"
            variant="primary"
            className="pw-action pw-action-primary"
            loading={flow.loading}
            disabled={flow.loading}
          >
            Send code
          </Button>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="pw-actions">
          <Button
            type="button"
            variant="ghost"
            className="pw-action"
            onClick={flow.goBackToEmail}
            disabled={flow.loading}
          >
            Different email
          </Button>
          <Button
            type="submit"
            form="forgot-otp-form"
            variant="primary"
            className="pw-action pw-action-primary"
            loading={flow.loading}
            disabled={flow.loading || flow.otp.replace(/\D/g, '').length < 6}
          >
            Verify code
          </Button>
        </div>
      );
    }

    return (
      <div className="pw-actions">
        <Button
          type="button"
          variant="ghost"
          className="pw-action"
          onClick={handleBack}
          disabled={flow.loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="forgot-reset-form"
          variant="primary"
          className="pw-action pw-action-primary"
          loading={flow.loading}
          disabled={flow.loading}
        >
          Reset password
        </Button>
      </div>
    );
  })();

  return (
    <Modal
      isOpen
      onClose={handleClose}
      title={meta.title}
      subtitle={meta.subtitle}
      icon={meta.icon}
      size="xl"
      className="pw-modal pw-forgot-modal"
      headerClassName="pw-modal-head"
      closeOnBackdrop={step < 3 && !flow.loading}
      hideClose={step === 3}
      footer={footer}
    >
      <div className="pw-modal-content">
        {step < 3 && (
          <div className="pw-steps" aria-label={`Step ${step + 1} of 3`}>
            {STEP_LABELS.map((label, index) => (
              <div
                key={label}
                className={`pw-step${index === step ? ' is-current' : ''}${index < step ? ' is-done' : ''}`}
                aria-current={index === step ? 'step' : undefined}
              >
                <span className="pw-step-track" aria-hidden="true" />
                <span className="pw-step-label">
                  {index < step && <Icon name="check" />}
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {errorAlert}

        {step === 0 && (
          <form id="forgot-email-form" className="pw-form" onSubmit={flow.sendOtp} noValidate aria-busy={flow.loading}>
            <div className="pw-field">
              <div className="pw-label-row">
                <label className="pw-label" htmlFor="fp-email">Account email</label>
              </div>
              <div className="pw-input-wrap">
                <input
                  ref={emailRef}
                  id="fp-email"
                  name="email"
                  type="email"
                  className="pw-input no-action"
                  value={flow.email}
                  onChange={(event) => {
                    flow.setEmail(event.target.value);
                    flow.clearError();
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={flow.loading}
                  aria-describedby="fp-email-message"
                />
              </div>
              <p id="fp-email-message" className="pw-message">
                <span>Use the email linked to your Vitalis account.</span>
              </p>
            </div>
          </form>
        )}

        {step === 1 && (
          <form id="forgot-otp-form" className="pw-form" onSubmit={flow.verifyOtp} noValidate aria-busy={flow.loading}>
            <div className="pw-field">
              <p className="pw-summary-copy">We sent a 6-digit code to</p>
              <span className="pw-email-chip">
                <Icon name="mail" />
                {flow.email}
              </span>
            </div>

            <div className="pw-field">
              <div className="pw-label-row">
                <span className="pw-label" id="fp-otp-label">Verification code</span>
              </div>
              <OtpInput
                value={flow.otp}
                labelledBy="fp-otp-label"
                onChange={(value) => {
                  flow.setOtp(value);
                  flow.clearError();
                }}
              />
              <p className="pw-message">
                <span>The code expires in 10 minutes.</span>
              </p>
            </div>

            <div className="pw-helper-row">
              <span>Didn&apos;t receive it?</span>
              <button
                type="button"
                className="pw-inline-button"
                onClick={flow.resend}
                disabled={flow.resendTimer > 0 || flow.loading}
              >
                {flow.resendTimer > 0 ? `Resend in ${flow.resendTimer}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form id="forgot-reset-form" className="pw-form" onSubmit={(event) => { event.preventDefault(); flow.resetPassword(); }} noValidate aria-busy={flow.loading}>
            <PasswordField
              id="fp-new-password"
              label="New password"
              value={flow.newPassword}
              onChange={(event) => {
                flow.setNewPassword(event.target.value);
                flow.clearError();
              }}
              autoComplete="new-password"
              placeholder="Create password"
              helper="Use at least 8 characters."
              disabled={flow.loading}
              inputRef={newPasswordRef}
            >
              {flow.newPassword ? (
                <div className="pw-strength-slot">
                  <PasswordStrength password={flow.newPassword} />
                </div>
              ) : null}
            </PasswordField>

            <PasswordField
              id="fp-confirm-password"
              label="Confirm new password"
              value={flow.confirmPw}
              onChange={(event) => {
                flow.setConfirmPw(event.target.value);
                flow.clearError();
              }}
              autoComplete="new-password"
              placeholder="Re-enter password"
              helper="Re-enter your new password."
              success={
                flow.confirmPw && flow.newPassword.length >= 8 && flow.newPassword === flow.confirmPw
                  ? 'Passwords match.'
                  : ''
              }
              disabled={flow.loading}
            />
          </form>
        )}

        {step === 3 && (
          <div className="pw-success">
            <span className="pw-success-icon" aria-hidden="true">
              <Icon name="check_circle" />
            </span>
            <h4 className="pw-success-title">You&apos;re all set</h4>
            <p className="pw-success-copy">
              Your password has been reset. Every device was signed out for your security.
              Sign in again with your new password.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
