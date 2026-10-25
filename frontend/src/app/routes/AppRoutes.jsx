import { lazy, Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { MemberRoute, ProtectedRoute, PublicRoute } from '../../hooks/useMiddleware.jsx';
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx';
import BrandLoader from '../../components/ui/BrandLoader.jsx';

const Dashboard = lazy(() => import('../../features/user/Dashboard/pages/Dashboard.jsx'));

const Plans = lazy(() => import('../../features/user/Plan/pages/Plans.jsx'));
const CameraWorkout = lazy(() => import('../../features/user/CameraWorkout/pages/CameraWorkout.jsx'));
const Log = lazy(() => import('../../features/user/Log/pages/Log.jsx'));
const Landing = lazy(() => import('../../pages/Landing/Landing.jsx'));
const NutritionTracker = lazy(() => import('../../features/user/MealTracker/pages/MealTracker.jsx'));
const Onboarding = lazy(() => import('../../features/user/Onboarding/pages/Onboarding.jsx'));
const Community = lazy(() => import('../../features/user/Community/pages/Community.jsx'));
const Profile = lazy(() => import('../../features/user/Profile/pages/Profile.jsx'));
const ActivityMap = lazy(() => import('../../features/user/ActivityMap/pages/ActivityMap.jsx'));
const Register = lazy(() => import('../../features/user/Auth/Register/pages/Register.jsx'));
const Login = lazy(() => import('../../features/user/Auth/Login/pages/Login.jsx'));
const VitalisMessenger = lazy(() => import('../../features/user/Social/pages/Social.jsx'));
const Notifications = lazy(() => import('../../features/user/Notifications/pages/Notifications.jsx'));
const Preferences = lazy(() => import('../../features/user/Preferences/pages/Preferences.jsx'));
const HelpSupport = lazy(() => import('../../features/user/HelpSupport/pages/HelpSupport.jsx'));
const ForgotPassword = lazy(() => import('../../features/user/Auth/ForgotPassword/pages/ForgotPassword.jsx'));
const CheckEmail = lazy(() => import('../../features/user/Auth/VerifyEmail/pages/CheckEmail.jsx'));
const VerifyEmail = lazy(() => import('../../features/user/Auth/VerifyEmail/pages/VerifyEmail.jsx'));
const NotFound = lazy(() => import('../../pages/NotFound/NotFound.jsx'));

// Module 7 — dedicated admin console (role-gated, own shell).
const AdminRoute = lazy(() => import('../../features/admin/components/AdminRoute.jsx'));
const AdminShell = lazy(() => import('../../features/admin/components/AdminShell.jsx'));
const AdminOverview = lazy(() => import('../../features/admin/pages/AdminOverview.jsx'));
const AdminUsers = lazy(() => import('../../features/admin/pages/AdminUsers.jsx'));
const AdminContent = lazy(() => import('../../features/admin/pages/AdminContent.jsx'));
const AdminAiUsage = lazy(() => import('../../features/admin/pages/AdminAiUsage.jsx'));
const AdminAudit = lazy(() => import('../../features/admin/pages/AdminAudit.jsx'));

const RouteFallback = () => (
  <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-[var(--bg-primary)]" role="status" aria-busy="true" aria-live="polite">
    <BrandLoader size="lg" message="Loading Vitalis…" />
    <div className="w-48 max-w-[60vw] space-y-2" aria-hidden="true">
      <div className="h-2 rounded-full bg-[var(--bg-hover)] animate-pulse" />
      <div className="h-2 rounded-full bg-[var(--bg-hover)] animate-pulse w-3/4 mx-auto" />
    </div>
  </div>
);

export default function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  // Logged-in home: admins go straight to the console (Module 7).
  const authenticatedHome = user?.role === 'admin' ? '/admin' : '/dashboard';
  return (
    <ErrorBoundary>
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={user ? <Navigate to={authenticatedHome} replace /> : <Landing />} />
        <Route path="/login" element={user ? <Navigate to={authenticatedHome} replace /> : <PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={user ? <Navigate to={authenticatedHome} replace /> : <PublicRoute><Register /></PublicRoute>} />
        {/* Member app — MemberRoute bounces admins back to their console. */}
        <Route path="/dashboard" element={<MemberRoute><Dashboard /></MemberRoute>} />

        <Route path="/dashboard/messenger" element={<MemberRoute><VitalisMessenger /></MemberRoute>} />
        <Route path="/dashboard/plans" element={<MemberRoute><Plans /></MemberRoute>} />
        <Route path="/dashboard/activity-map" element={<MemberRoute><ActivityMap /></MemberRoute>} />
                <Route path="/dashboard/workouts" element={<MemberRoute><CameraWorkout /></MemberRoute>} />
        <Route path="/dashboard/profile" element={<MemberRoute><Profile /></MemberRoute>} />
        <Route path="/dashboard/logs" element={<MemberRoute><Log /></MemberRoute>} />
        <Route path="/dashboard/meal-tracker" element={<MemberRoute><NutritionTracker /></MemberRoute>} />
        <Route path="/dashboard/community" element={<MemberRoute><Community /></MemberRoute>} />
        <Route path="/dashboard/notifications" element={<MemberRoute><Notifications /></MemberRoute>} />
        <Route path="/dashboard/preferences" element={<MemberRoute><Preferences /></MemberRoute>} />
        <Route path="/dashboard/help-support" element={<MemberRoute><HelpSupport /></MemberRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute requireOnboarding={false}><Onboarding /></ProtectedRoute>} />

        {/* Module 7 — admin console. API enforcement is requireAdmin; this is the UI gate. */}
        <Route
          path="/admin"
          element={(
            <ProtectedRoute requireOnboarding={false}>
              <AdminRoute>
                <AdminShell />
              </AdminRoute>
            </ProtectedRoute>
          )}
        >
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="ai-usage" element={<AdminAiUsage />} />
          <Route path="audit" element={<AdminAudit />} />

          {/* Account pages are shared with the member app; the admin route
              renders the same component inside the console shell. */}
          <Route path="profile" element={<Profile embedded />} />
          <Route path="preferences" element={<Preferences embedded />} />
          <Route path="notifications" element={<Notifications embedded />} />
          <Route path="help-support" element={<HelpSupport embedded />} />

          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        {/* Legacy removed-module path — redirect to dashboard */}
        <Route path="/dashboard/virtual-clinic" element={<Navigate to="/dashboard" replace />} />
        {/* BMI lives inside Profile — redirect dead ROUTES.BMI link instead of falling to * */}
        <Route path="/dashboard/bmi" element={<Navigate to="/dashboard/profile" replace />} />
        <Route path="/reset-password" element={<ForgotPassword />} />
        <Route path="/forgot-password" element={<Navigate to="/reset-password" replace />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
