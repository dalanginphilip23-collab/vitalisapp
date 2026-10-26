import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRegister } from '../hooks/useRegister.js';
import { TermsOfUseModal, PrivacyPolicyModal } from '../components/LegalModals.jsx';

const pwStrength = (pw) => {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8)          score++;
  if (pw.length >= 12)         score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak',   color: '#ef4444', pct: '33%'  };
  if (score <= 3) return { label: 'Medium', color: '#f59e0b', pct: '66%'  };
  return              { label: 'Strong', color: 'var(--accent)',  pct: '100%' };
};

const VisibilityToggle = ({ visible, onToggle, label }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={label}
    className="text-white/40 hover:text-[var(--accent)] transition-colors bg-transparent border-none cursor-pointer leading-none p-1"
  >
    <span className="material-symbols-outlined text-[20px]">{visible ? 'visibility_off' : 'visibility'}</span>
  </button>
);

// Dark field matching Login's ACCESS PORTAL inputs (hardcoded dark —
// the card is always dark glass regardless of document theme).
const Field = ({ id, label, icon, error = undefined, rightElement = undefined, focusedId, setFocusedId, ...props }) => {
  const isFocused = focusedId === id;
  return (
    <div>
      <label
        htmlFor={id}
        className={`block text-[10px] font-semibold tracking-[0.25em] uppercase mb-2 transition-colors ${isFocused ? 'text-[var(--accent)]' : 'text-white/50'}`}
      >
        {label} {props.required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className={`material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] pointer-events-none transition-colors ${error ? 'text-red-400' : isFocused ? 'text-[var(--accent)]' : 'text-white/40'}`}>
            {icon}
          </span>
        )}
        <input
          id={id}
          onFocus={() => setFocusedId(id)}
          onBlur={() => setFocusedId('')}
          aria-invalid={error ? true : undefined}
          className={`w-full bg-white/5 border rounded-xl text-sm text-[#e5e2e1] p-3.5 outline-none transition-all placeholder:text-white/10 disabled:opacity-50 ${icon ? 'pl-11' : 'pl-4'} ${rightElement ? 'pr-12' : 'pr-4'} ${error ? 'border-red-500/60' : 'border-white/10 focus:border-[var(--accent)]/50 focus:bg-[var(--accent)]/5 focus:ring-4 focus:ring-[var(--accent)]/10'}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      {error && <p className="text-[11px] text-red-400 px-1 mt-1.5">{error}</p>}
    </div>
  );
};

const Register = () => {
  const [formData, setFormData] = useState({
    name:     '',
    email:    '',
    password: '',
    confirm:  '',
    agreed:   false,
  });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState('');
  const [legalView, setLegalView] = useState(null); // 'terms' | 'privacy' | null

  const navigate = useNavigate();
  const { loading, error, clearError, handleRegister, signupWithGoogle, googleEnabled } = useRegister();

  const filledFields = [formData.name, formData.email, formData.password, formData.confirm].filter(Boolean).length;
  const progressPct  = Math.round((filledFields / 4) * 100);

  const mismatch = formData.confirm.length > 0 && formData.password !== formData.confirm;
  const strength = pwStrength(formData.password);

  const update = (field) => (e) => {
    if (error) clearError();
    setFormData({ ...formData, [field]: e.target.value });
  };

  return (
    <div data-theme="dark" className="min-h-screen flex font-['DM_Sans',sans-serif] text-[#e5e2e1] overflow-x-hidden overflow-y-auto relative bg-[#0e0e0e]">
      {/* Same hardcoded dark backdrop as Login (theme-var vignette washed white in light theme) */}
      <div className="fixed inset-0 z-0 bg-[url('/auth-gym.jpg')] bg-cover bg-[center_30%] brightness-[0.28] saturate-[0.7]" />
      <div className="fixed inset-0 z-[1]" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, #0e0e0e 100%)' }} />
      <div className="fixed inset-0 z-[2]" style={{ backgroundImage: 'linear-gradient(rgba(107,142,35,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(107,142,35,0.03) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      {/* Back to Landing */}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="fixed top-6 left-6 z-40 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 backdrop-blur-md px-4 py-2 text-[11px] font-semibold tracking-[0.2em] uppercase text-white/70 hover:text-[var(--accent)] hover:border-[var(--accent)]/30 hover:bg-black/40 transition-all"
      >
        <span className="text-[14px] leading-none">←</span> Back to Landing
      </button>

      <div className="relative z-30 w-full min-h-screen m-auto grid grid-cols-1 max-[960px]:grid-cols-1 min-[960px]:grid-cols-[1fr_500px]">

        {/* ── Left hero ── (centered in the viewport, not the tall form row) ── */}
        <div className="hidden min-[960px]:flex flex-col justify-center p-[64px_56px] gap-4 min-[960px]:h-screen min-[960px]:self-start">
          <span className="text-[11px] font-semibold tracking-[0.35em] uppercase text-[var(--accent)] opacity-80">Vitalis Performance OS</span>
          <h1 className="font-['Bebas_Neue',sans-serif] text-[clamp(52px,5.5vw,82px)] leading-[0.95] tracking-[0.02em]">
            BUILD<br />YOUR<br /><span className="text-[var(--accent)]">ATHLETE</span><br />PROFILE.
          </h1>
          <p className="text-[13px] text-[#e5e2e1]/45 max-w-[320px] leading-[1.7] font-light mt-1">
            Create your account, then optionally set your goal and body profile. Log training, nutrition, and recovery manually.
          </p>
        </div>

        {/* ── Right glass card ── */}
        <div className="flex items-center justify-center p-5 sm:p-[40px_32px] max-[960px]:p-[20px]">
          <div className="relative w-full max-w-[420px] bg-[#121210]/65 backdrop-blur-[32px] saturate-[140%] border border-[var(--accent)]/10 rounded-[20px] p-6 sm:p-10 shadow-[0_32px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
            <div className="scan-bar absolute left-0 right-0 top-0 h-[1px] rounded-t-[20px]" />

            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-7">
              <img src="/pwa-192x192.png" alt="Vitalis logo" className="w-[34px] h-[34px] rounded-lg" />
              <span className="font-['Bebas_Neue',sans-serif] text-[21px] tracking-[0.12em]">VITALIS</span>
            </div>

            {/* Progress */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/50">Profile Setup</span>
              <span className="font-['Bebas_Neue',sans-serif] text-[16px] text-[var(--accent)] leading-none">{progressPct}%</span>
            </div>
            <div className="h-[2px] bg-white/5 rounded-full mb-8 overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <h2 className="font-['Bebas_Neue',sans-serif] text-[32px] tracking-wider leading-none mb-1.5">CREATE ACCOUNT</h2>
            <p className="text-xs text-[#c4c9b0]/55 tracking-wide mb-8">Step 1 of onboarding — you can set your goal and body profile next (optional).</p>

            <form onSubmit={(e) => handleRegister(e, formData)} noValidate={false}>
              {error && (
                <div role="alert" className="bg-[var(--error-bg)] border border-[var(--error)]/30 rounded-xl text-[var(--error)] text-[11px] font-semibold py-2.5 px-3.5 mb-[18px] text-center break-words">
                  {error}
                </div>
              )}

              {/* Name */}
              <div className="mb-[18px]">
                <Field
                  id="register-name"
                  label="Full Name"
                  icon="person"
                  type="text"
                  placeholder="Your name"
                  required
                  disabled={loading}
                  value={formData.name}
                  onChange={update('name')}
                  autoComplete="name"
                  focusedId={focused}
                  setFocusedId={setFocused}
                />
              </div>

              {/* Email */}
              <div className="mb-[18px]">
                <Field
                  id="register-email"
                  label="Email Address"
                  icon="mail"
                  type="email"
                  placeholder="athlete@vitalis.io"
                  required
                  disabled={loading}
                  value={formData.email}
                  onChange={update('email')}
                  autoComplete="email"
                  focusedId={focused}
                  setFocusedId={setFocused}
                />
              </div>

              {/* Password */}
              <div className="mb-[18px]">
                <Field
                  id="register-password"
                  label="Password"
                  icon="lock"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  disabled={loading}
                  value={formData.password}
                  onChange={update('password')}
                  autoComplete="new-password"
                  focusedId={focused}
                  setFocusedId={setFocused}
                  rightElement={<VisibilityToggle visible={showPw} onToggle={() => setShowPw((v) => !v)} label={showPw ? 'Hide password' : 'Show password'} />}
                />
                {strength && (
                  <div className="mt-2 px-1">
                    <div className="h-[3px] bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: strength.pct, background: strength.color }} />
                    </div>
                    <p className="text-[10px] mt-1 font-semibold" style={{ color: strength.color }}>{strength.label}</p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="mb-[18px]">
                <Field
                  id="register-confirm"
                  label="Confirm Password"
                  icon="lock_reset"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  required
                  disabled={loading}
                  value={formData.confirm}
                  onChange={update('confirm')}
                  autoComplete="new-password"
                  error={mismatch ? 'Passwords do not match' : undefined}
                  focusedId={focused}
                  setFocusedId={setFocused}
                  rightElement={<VisibilityToggle visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)} label={showConfirm ? 'Hide password' : 'Show password'} />}
                />
              </div>

              {/* Terms */}
              <div className="flex items-start gap-2.5 mb-[18px] text-[12px] text-[#c4c9b0]/55 leading-relaxed">
                <input
                  id="register-agree"
                  type="checkbox"
                  required
                  disabled={loading}
                  checked={formData.agreed}
                  onChange={(e) => { if (error) clearError(); setFormData({ ...formData, agreed: e.target.checked }); }}
                  className="mt-0.5 w-4 h-4 min-w-[16px] min-h-[16px] shrink-0 accent-[var(--accent)] cursor-pointer"
                />
                <label htmlFor="register-agree" className="cursor-pointer">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setLegalView('terms')}
                    className="text-[var(--accent)] font-semibold underline decoration-[var(--accent)]/50 underline-offset-2 hover:brightness-110 transition-colors"
                  >
                    Terms of Use
                  </button>
                  {' '}and{' '}
                  <button
                    type="button"
                    onClick={() => setLegalView('privacy')}
                    className="text-[var(--accent)] font-semibold underline decoration-[var(--accent)]/50 underline-offset-2 hover:brightness-110 transition-colors"
                  >
                    Privacy Policy
                  </button>
                </label>
              </div>

              <button
                className="group relative w-full bg-[var(--accent)] text-[var(--text-inverse)] font-bold text-[11px] tracking-[0.25em] uppercase p-4 rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 mt-1.5 overflow-hidden shadow-[var(--shadow-md)] hover:bg-[var(--accent-dark)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={loading || mismatch}
              >
                {loading ? (
                  <><div className="w-[13px] h-[13px] rounded-full animate-spin border-2 border-black border-t-transparent" /> Creating Account...</>
                ) : (
                  <>Create Account <span style={{ fontSize: 15 }}>→</span></>
                )}
              </button>
            </form>

            <div className="flex items-center gap-3 py-1 mt-4">
              <div className="flex-1 h-[1px] bg-white/5" />
              <span className="text-[10px] tracking-[0.3em] uppercase text-white/20">or</span>
              <div className="flex-1 h-[1px] bg-white/5" />
            </div>

            <button
              type="button"
              onClick={() => signupWithGoogle()}
              disabled={loading || !googleEnabled}
              title={!googleEnabled ? 'Google sign-up disabled — set VITE_GOOGLE_CLIENT_ID in frontend/.env and restart' : 'Sign up with Google'}
              className="w-full bg-white/5 border border-white/10 rounded-xl text-[11px] font-semibold tracking-widest uppercase p-3.5 flex items-center justify-center gap-2.5 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-3"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {loading ? 'Working...' : 'Sign up with Google'}
            </button>

            <div className="mt-7 text-center text-xs text-[#c4c9b0]/45">
              Already have an account?
              <Link className="text-[var(--accent-dark)] font-semibold ml-1 hover:text-[var(--accent)] transition-colors" to="/login">Sign in</Link>
            </div>
          </div>
        </div>
      </div>

      <TermsOfUseModal isOpen={legalView === 'terms'} onClose={() => setLegalView(null)} />
      <PrivacyPolicyModal isOpen={legalView === 'privacy'} onClose={() => setLegalView(null)} />
    </div>
  );
};

export default Register;
