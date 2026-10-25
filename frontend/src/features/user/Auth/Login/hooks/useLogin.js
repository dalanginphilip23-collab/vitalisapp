import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID } from '../../../../../app/config/env.js';
import { apiPost } from '../../../../../lib/apiClient.js';
import { safeGet } from '../../../../../lib/storage.js';
import { useAuth } from '../../../../../hooks/useAuth.jsx';

export const useLogin = () => {
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  // Module 1 — soft-deactivated account: keep the captured credentials handy
  // so the Reactivate panel can flip status and immediately sign back in.
  const [deactivated, setDeactivated] = useState(null);
  const [reactivating, setReactivating] = useState(false);
  const navigate  = useNavigate();
  const { setUser, refreshAuth } = useAuth();

  // Login 200 only means the password was right — the session lives or dies
  // on whether the browser kept the cookie. Verify immediately so a blocked
  // cookie shows an actionable error instead of a fake login + instant logout.
  const COOKIE_BLOCKED_MSG =
    'Signed in, but your browser refused the session cookie, so you were signed straight back out. ' +
    'Allow cookies for this site (turn off Incognito / third-party-cookie blocking), then try again.';
  const confirmSession = async () => {
    const ok = await refreshAuth();
    if (!ok) {
      setError(COOKIE_BLOCKED_MSG);
      return false;
    }
    return true;
  };

  // Helper: normalize any login response into the
  // same shape that /api/auth/me returns so
  // AuthContext always has a consistent user object.
  //
  // /me returns:      { id, name, email, avatar, goal }
  // /login returns:   { id, name, email, avatar, goal }
  // /google-login:    { id, name, email, avatar, goal }
  //
  // All three now match — just extract the fields.
  const normalizeUser = (data) => ({
    id:                  data.id                  || data.user?.id,
    name:                data.name                || data.user?.name,
    email:               data.email               || data.user?.email,
    avatar:              data.avatar              || data.user?.avatar,
    goal:                data.goal                || data.user?.goal,
    // Fail-closed: unverified unless backend explicitly says true.
    isVerified:          data.isVerified          ?? data.user?.isVerified ?? false,
    onboardingCompleted: data.onboardingCompleted ?? data.user?.onboardingCompleted,
    // Module 1 — governance fields (same shape as /me).
    role:                data.role                ?? data.user?.role ?? 'member',
    status:              data.status              ?? data.user?.status ?? 'active',
    acceptedTermsAt:     data.acceptedTermsAt     ?? data.user?.acceptedTermsAt ?? null,
    acceptedTermsVersion: data.acceptedTermsVersion ?? data.user?.acceptedTermsVersion ?? null,
  });

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const consumePostAuthRedirect = () => {
    try {
      const r = sessionStorage.getItem('vitalis:postAuthRedirect');
      if (r && r.startsWith('/') && !r.startsWith('//')) {
        sessionStorage.removeItem('vitalis:postAuthRedirect');
        return r;
      }
      if (r) sessionStorage.removeItem('vitalis:postAuthRedirect');
    } catch { /* private mode */ }
    return null;
  };

  // Verified users go to onboarding (if incomplete) else dashboard
  // Same routing, private-mode safe via safeGet (was raw localStorage).
  const routeAfterAuth = (user) => {
    const pending = consumePostAuthRedirect();
    if (pending) { navigate(pending); return; }
    // Admins belong in the console — the user dashboard stays one click away.
    if (user.role === 'admin') { navigate('/admin'); return; }
    const skipped = safeGet('vitalis:onboarding', null) === 'skipped';
    if (user.onboardingCompleted === false && !skipped) navigate('/onboarding');
    else navigate('/dashboard');
  };

  const handleSubmit = async (e, { email, password }) => {
    e.preventDefault();
    if (loading) return; // prevent duplicate submission
    const trimmedEmail = String(email || '').trim();
    if (!trimmedEmail || !password) {
      setError('Enter your email and password to sign in.');
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (deactivated?.email) {
      // This is the auto-resign-in after reactivate — reuse the shared path.
      await attemptLogin(trimmedEmail, password);
      return;
    }
    await attemptLogin(trimmedEmail, password);
  };

  // Shared credential attempt — clearsthe deactivated panel on a fresh try so
  // a wrong password for a wrong reason always resets the UI.
  const attemptLogin = async (trimmedEmail, password) => {
    setDeactivated(null);
    setError('');
    setLoading(true);

    try {
      // skipAuthRedirect: login page handles 401/403 itself (no global logout funnel here).
      const data = await apiPost('/api/auth/login', { email: trimmedEmail, password }, { skipAuthRedirect: true });

      const user = normalizeUser(data);
      if (!user.id) throw new Error('Login response did not include a user ID.');

      // FIX: store normalized user so shape always matches what /me returns
      setUser(user);
      if (!(await confirmSession())) return;
      routeAfterAuth(user);
    } catch (err) {
      // Unverified accounts must verify before signing in
      // (backend echoes the account email, but the submitted one is identical)
      if (err?.status === 403 && err?.code === 'NEEDS_VERIFICATION') {
        navigate('/check-email', { state: { email: trimmedEmail } });
        return;
      }
      // Module 1 — soft-deactivated accounts: surface the reactivate panel.
      if (err?.status === 403 && err?.code === 'ACCOUNT_DEACTIVATED') {
        setDeactivated({ email: trimmedEmail, password });
        setError('This account is deactivated. Reactivate to continue.');
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Module 1 — flip status back to active, then immediately sign in again so
  // the user never lands on "try again".
  const handleReactivate = async () => {
    if (!deactivated || reactivating) return;
    setReactivating(true);
    setError('');
    try {
      await apiPost('/api/auth/reactivate', {
        email: deactivated.email,
        password: deactivated.password,
      }, { skipAuthRedirect: true });
      const saved = deactivated;
      setDeactivated(null);
      await attemptLogin(saved.email, saved.password);
    } catch (err) {
      setError(err.message || 'Could not reactivate. Check your password and try again.');
    } finally {
      setReactivating(false);
    }
  };

  const handleGoogleSuccess = async (codeResponse) => {
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/api/auth/google-login', { code: codeResponse.code }, { skipAuthRedirect: true });

      const user = normalizeUser(data);
      if (!user.id) throw new Error('Google login response did not include a user ID.');

      // FIX: store normalized user — same shape as /me
      setUser(user);
      if (!(await confirmSession())) return;
      routeAfterAuth(user);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Google Login Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError:   () => setError('Google Authentication Interrupted.'),
    flow:      'auth-code',
  });
  const loginWithGoogle = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError(
        'Google login is not configured on this device. Add VITE_GOOGLE_CLIENT_ID to frontend/.env (same value as backend GOOGLE_CLIENT_ID), then restart the dev server.'
      );
      return;
    }
    try {
      return googleLogin();
    } catch {
      // Popup blocked / COOP / SDK init failure — surface actionable message
      setError('Google popup was blocked or failed to start. Allow popups for localhost and try again.');
    }
  };

  return { error, loading, handleSubmit, loginWithGoogle, googleEnabled: !!GOOGLE_CLIENT_ID, deactivated, reactivating, handleReactivate };
};