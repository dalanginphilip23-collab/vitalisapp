import { useState, useEffect } from 'react';
import { apiPost } from '../../../../lib/apiClient.js';

// Forgot-password logic hook — REUSES the same email-OTP reset endpoints and
// rules as the auth ForgotPassword page (Auth/ForgotPassword):
//   POST /api/forgot-password/send-otp → POST /verify-otp → POST /reset-password
// Same validations/messages/anti-enumeration behavior; hooks only, no UI.
const post = (url, body) => apiPost(url, body, { skipAuthRedirect: true });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const useForgotPassword = ({ initialEmail = '' } = {}) => {
  // Steps: 0 email → 1 verify code → 2 new password → 3 done
  const [step,        setStep]        = useState(0);
  const [email,       setEmail]       = useState(initialEmail);
  const [otp,         setOtp]         = useState('');
  const [resetToken,  setResetToken]  = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const t = setTimeout(() => setResendTimer((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const clearError = () => setError('');

  const sendOtp = async (e) => {
    e?.preventDefault?.();
    const trimmedEmail = String(email || '').trim();
    if (!EMAIL_RE.test(trimmedEmail)) { setError('Enter a valid email address.'); return false; }
    setLoading(true); setError('');
    try {
      await post('/api/forgot-password/send-otp', { email: trimmedEmail });
      setStep(1);
      setResendTimer(60);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e?.preventDefault?.();
    if (String(otp || '').replace(/\D/g, '').length < 6) {
      setError('Enter the full 6-digit code.');
      return false;
    }
    setLoading(true); setError('');
    try {
      const data = await post('/api/forgot-password/verify-otp', {
        email: String(email || '').trim(),
        otp: String(otp || '').replace(/\D/g, ''),
      });
      setResetToken(data.resetToken);
      setStep(2);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (resendTimer > 0 || loading) return false;
    setLoading(true); setError('');
    try {
      await post('/api/forgot-password/send-otp', { email: String(email || '').trim() });
      setOtp('');
      setResendTimer(60);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Returns true when the password was actually reset — the caller decides
  // what happens next (profile: sign out everywhere → login).
  const resetPassword = async () => {
    if (newPassword !== confirmPw) { setError('Passwords do not match.'); return false; }
    if (newPassword.length < 8)   { setError('Password must be at least 8 characters.'); return false; }
    setLoading(true); setError('');
    try {
      await post('/api/forgot-password/reset-password', {
        email: String(email || '').trim(),
        resetToken,
        newPassword,
      });
      setStep(3);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const goBackToEmail = () => { setStep(0); setOtp(''); setError(''); };

  return {
    step, email, setEmail, otp, setOtp, newPassword, setNewPassword,
    confirmPw, setConfirmPw, loading, error, resendTimer,
    clearError, sendOtp, verifyOtp, resend, resetPassword,
    goBackToEmail,
  };
};
