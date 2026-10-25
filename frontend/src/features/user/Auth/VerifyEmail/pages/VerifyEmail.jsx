import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../../../../../lib/apiClient.js';
import BrandLoader from '../../../../../components/ui/BrandLoader.jsx';
import { useAuth } from '../../../../../hooks/useAuth.jsx';

// Handles /verify-email?token=... links + shows the EMAIL VERIFIED success screen.
const VerifyEmail = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState(token ? 'verifying' : 'no-token');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        await apiGet(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        // Soft verification flow: if this browser still has the session from
        // registration, flip it verified immediately so the reminder banner
        // disappears the moment they come back.
        if (user) setUser({ ...user, isVerified: true });
        setState('done');
      } catch (err) {
        setError(err.message);
        setState('failed');
      }
    })();
    // Fire once per link: the token is fixed and `user`/setUser are only read
    // at completion time — re-running on identity changes could re-verify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div data-theme="dark" className="relative min-h-screen w-full bg-[#0e0e0e] font-['DM_Sans'] text-[#e5e2e1] overflow-x-hidden overflow-y-auto flex">
      <div className="fixed inset-0 z-0 bg-[url('/auth-gym.jpg')] bg-cover bg-[center_30%] brightness-[0.28] saturate-[0.7]" />
      <div className="fixed inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_30%,#0e0e0e_100%)]" />

      <div className="relative z-10 m-auto w-full max-w-[440px] p-6 flex flex-col items-center">
        <div className="w-full bg-[#121210]/65 backdrop-blur-[32px] border border-[var(--accent)]/10 rounded-[20px] p-6 sm:p-10 text-center">
          {state === 'verifying' && (
            <>
              <div className="mx-auto mb-6 w-fit"><BrandLoader size="md" /></div>
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/50">Verifying your email...</p>
            </>
          )}

          {state === 'done' && (
            <>
              <div className="w-20 h-20 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="font-['Bebas_Neue'] text-[32px] tracking-wider leading-none mb-2">EMAIL VERIFIED</h1>
              <p className="text-xs text-[#c4c9b0]/60 mb-8">Your Vitalis account is now active.</p>
              <button onClick={() => navigate(user ? '/dashboard' : '/login')}
                className="w-full bg-[var(--accent)] text-[var(--text-inverse)] font-bold text-[11px] tracking-[0.25em] uppercase p-4 rounded-xl hover:bg-[var(--accent-light)] transition-all">
                Continue
              </button>
            </>
          )}

          {state === 'failed' && (
            <>
              <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-[36px] text-red-400">error</span>
              </div>
              <h1 className="font-['Bebas_Neue'] text-[32px] tracking-wider leading-none mb-2">LINK EXPIRED</h1>
              <p className="text-xs text-[#c4c9b0]/60 mb-8">{error}</p>
              <button onClick={() => navigate('/check-email')}
                className="w-full bg-[var(--accent)] text-[var(--text-inverse)] font-bold text-[11px] tracking-[0.25em] uppercase p-4 rounded-xl hover:bg-[var(--accent-light)] transition-all">
                Request New Link
              </button>
            </>
          )}

          {state === 'no-token' && (
            <>
              <h1 className="font-['Bebas_Neue'] text-[32px] tracking-wider leading-none mb-2">VERIFY EMAIL</h1>
              <p className="text-xs text-[#c4c9b0]/60 mb-8">Open the verification link from your inbox, or request a new one.</p>
              <button onClick={() => navigate('/check-email')}
                className="w-full bg-[var(--accent)] text-[var(--text-inverse)] font-bold text-[11px] tracking-[0.25em] uppercase p-4 rounded-xl hover:bg-[var(--accent-light)] transition-all">
                Go to Check Email
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
