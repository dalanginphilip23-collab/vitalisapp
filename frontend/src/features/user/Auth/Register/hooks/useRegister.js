import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { apiPost } from '../../../../../lib/apiClient.js';
import { GOOGLE_CLIENT_ID } from '../../../../../app/config/env.js';
import { useAuth } from '../../../../../hooks/useAuth.jsx';

export const useRegister = () => {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const navigate = useNavigate();
  const { setUser, refreshAuth } = useAuth();

  const clearError = () => setError('');

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const getSafeRedirect = () => {
    try {
      const r = new URLSearchParams(window.location.search).get('redirect');
      if (r && r.startsWith('/') && !r.startsWith('//')) return r;
    } catch { /* ignore */ }
    return null;
  };

  // Login 200 only means the backend issued a session — it lives or dies on
  // whether the browser kept the cookie. Verify immediately like useLogin so a
  // blocked cookie shows an actionable error instead of a fake registration.
  const COOKIE_BLOCKED_MSG =
    'Account created, but your browser refused the session cookie, so you were signed straight back out. ' +
    'Allow cookies for this site (turn off Incognito / third-party-cookie blocking), then sign in below.';

  // Same shape /login and /me return — copy of useLogin's normalizeUser for the
  // fixed register payload (fail-closed on missing fields).
  const normalizeUser = (data) => ({
    id:                   data.id,
    name:                 data.name,
    email:                data.email,
    avatar:               data.avatar ?? null,
    goal:                 data.goal ?? null,
    isVerified:           data.isVerified ?? false,
    onboardingCompleted:  data.onboardingCompleted ?? false,
    role:                 data.role ?? 'member',
    status:               data.status ?? 'active',
    acceptedTermsAt:      data.acceptedTermsAt ?? null,
    acceptedTermsVersion: data.acceptedTermsVersion ?? null,
  });

  // Register = sign in (soft verification): land in the app directly.
  const routeAfterRegister = (user) => {
    const pending = getSafeRedirect();
    if (pending && pending.startsWith('/') && !pending.startsWith('//')) {
      navigate(pending);
      return;
    }
    // Admins belong in the console — the user dashboard stays one click away.
    if (user.role === 'admin') { navigate('/admin'); return; }
    navigate(user.onboardingCompleted === false ? '/onboarding' : '/dashboard');
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

      // Soft verification (Option A): the backend issues the session during
      // register, so the new user goes straight into the app — onboarding for
      // new accounts, dashboard otherwise. No check-your-email wall.
      if (data.id) {
        const user = normalizeUser(data);
        setUser(user);
        if (!(await refreshAuth())) {
          setError(COOKIE_BLOCKED_MSG);
          return;
        }
        routeAfterRegister(user);
        return;
      }

      // Fallback for an older backend without instant sessions (never
      // expected, but keeps the flow fail-open to the known screens).
      if (data.needsVerification === false) {
        navigate('/login', { state: { email, justRegistered: true } });
        return;
      }
      navigate('/check-email', { state: { email, devLink: data.devVerificationLink } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Google sign-up reuses POST /api/auth/google-login: the backend auto-creates
  // the account for first-time Google users (verified, consent recorded) and
  // issues the session — so a "Sign up with Google" needs no separate endpoint.
  const handleGoogleSuccess = async (codeResponse) => {
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/api/auth/google-login', { code: codeResponse.code }, { skipAuthRedirect: true });
      const user = normalizeUser(data);
      if (!user.id) throw new Error('Google response did not include a user ID.');
      setUser(user);
      if (!(await refreshAuth())) {
        setError(COOKIE_BLOCKED_MSG);
        return;
      }
      routeAfterRegister(user);
    } catch (err) {
      setError(err.message || 'Google sign-up failed.');
    } finally {
      setLoading(false);
    }
  };

  const googleSignup = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setError('Google sign-up was interrupted.'),
    flow: 'auth-code',
  });

  const signupWithGoogle = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError(
        'Google sign-up is not configured on this device. Add VITE_GOOGLE_CLIENT_ID to frontend/.env (same value as backend GOOGLE_CLIENT_ID), then restart the dev server.'
      );
      return;
    }
    try {
      return googleSignup();
    } catch {
      // Popup blocked / COOP / SDK init failure — actionable message.
      setError('Google popup was blocked or failed to start. Allow popups for this site and try again.');
    }
  };

  return { loading, error, clearError, handleRegister, signupWithGoogle, googleEnabled: !!GOOGLE_CLIENT_ID };
};
