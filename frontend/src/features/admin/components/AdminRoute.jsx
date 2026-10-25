import { Navigate } from 'react-router-dom';
import BrandLoader from '../../../components/ui/BrandLoader.jsx';
import { useAuth } from '../../../hooks/useAuth.jsx';
import '../admin.css';

/**
 * Frontend gate for the admin console. The real enforcement is `requireAdmin`
 * on every /api/admin route — this only keeps the UI honest. A member typing
 * /admin (or any sub-path) is silently redirected to their own dashboard;
 * there is no restricted-area screen to keep probing.
 */
export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--bg-primary)]">
        <BrandLoader size="md" message="Checking clearance…" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.isVerified !== true && user.email) return <Navigate to="/check-email" replace />;
  // Role middleware — members get their own dashboard, never the console.
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return children;
}
