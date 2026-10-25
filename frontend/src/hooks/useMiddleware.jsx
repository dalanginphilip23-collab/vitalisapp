import { Navigate } from "react-router-dom";
import { useAuth, isCacheFresh } from "./useAuth.jsx";
import { safeGet } from "../lib/storage.js";
import BrandLoader from "../components/ui/BrandLoader.jsx";

const GuardFallback = () => (
  <div className="min-h-dvh flex items-center justify-center bg-[var(--bg-primary)]">
    <BrandLoader size="md" message="Loading…" />
  </div>
);

// Users with incomplete onboarding go to /onboarding first.
// Verification is soft (Option A): unverified sessions stay in the app and
// the VerifyEmailBanner handles the reminder — no /check-email funnel here.
export const ProtectedRoute = ({ children, requireOnboarding = true }) => {
  const { user, loading, sessionValid } = useAuth();

  if (loading) return <GuardFallback />;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (sessionValid === false && !isCacheFresh()) {
    return <Navigate to="/login" replace />;
  }

  if (requireOnboarding && user.onboardingCompleted === false) {
    const skipped = safeGet('vitalis:onboarding') === 'skipped';
    let sessionSkipped = false;
    try { sessionSkipped = sessionStorage.getItem('vitalis:onboarding:session-skip') === '1'; } catch { /* ignore */ }
    if (!skipped && !sessionSkipped) return <Navigate to="/onboarding" replace />;
  }

  return children;
};

// Blocks logged-in users from Login/Register pages.
export const PublicRoute = ({ children }) => {
  const { user, loading, sessionValid } = useAuth();

  if (loading) return <GuardFallback />;
  // Redirect only on proven session or fresh cache (avoids dashboard↔login bounce).
  if (user && (sessionValid !== false || isCacheFresh())) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return children;
};

// Member-only wrapper: an admin typing any /dashboard/* URL straight into the
// address bar is redirected to their own console. Members pass through to
// ProtectedRoute (verification + onboarding checks still apply).
export const MemberRoute = ({ children, requireOnboarding = true }) => {
  const { user, loading } = useAuth();

  if (loading) return <GuardFallback />;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;

  return (
    <ProtectedRoute requireOnboarding={requireOnboarding}>
      {children}
    </ProtectedRoute>
  );
};