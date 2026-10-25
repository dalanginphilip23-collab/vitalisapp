import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../../../../../lib/apiClient.js';

export const useRegister = () => {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const navigate = useNavigate();

  const clearError = () => setError('');

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const getSafeRedirect = () => {
    try {
      const r = new URLSearchParams(window.location.search).get('redirect');
      if (r && r.startsWith('/') && !r.startsWith('//')) return r;
    } catch { /* ignore */ }
    return null;
  };

  const handleRegister = async (e, formData) => {
    e.preventDefault();
    if (loading) return; // prevent duplicate submission
    const name = String(formData.name || '').trim();
    const email = String(formData.email || '').trim();
    if (!name) {
      setError('Enter your full name.');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!formData.password || formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (formData.password !== formData.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!formData.agreed) {
      setError('Please agree to the Terms of Use and Privacy Policy.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/api/auth/register', {
        name,
        email,
        password: formData.password,
        // Module 1 — explicit consent flag; server records the audit trail.
        agreed: true,
      }, { skipAuthRedirect: true });
      // Preserve ?redirect= across verify -> login -> dashboard (validated, no open redirect)
      const redirect = getSafeRedirect();
      if (redirect) {
        try { sessionStorage.setItem('vitalis:postAuthRedirect', redirect); } catch { /* private mode */ }
      }
      // Dev/test backend auto-activates accounts (no inbox needed) — skip the
      // check-your-email screen and go straight to sign in.
      if (data.needsVerification === false) {
        navigate('/login', { state: { email, justRegistered: true } });
        return;
      }
      // New accounts must verify email before signing in
      navigate('/check-email', { state: { email, devLink: data.devVerificationLink } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, clearError, handleRegister };
};
