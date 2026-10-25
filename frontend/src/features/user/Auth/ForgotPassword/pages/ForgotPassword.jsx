import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiPost } from '../../../../../lib/apiClient.js';

const post = async (url, body) => apiPost(url, body, { skipAuthRedirect: true });

const STEPS = ['Email', 'Verify', 'Reset'];

const StepBar = ({ current }) => (
  <div className="flex items-center gap-2 mb-8">
    {STEPS.map((label, i) => {
      const done   = i < current;
      const active = i === current;
      return (
        <React.Fragment key={label}>
          <div className="flex items-center gap-1.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-300
              ${done   ? 'bg-[var(--accent)] text-[var(--text-inverse)]' : ''}
              ${active ? 'bg-[var(--accent)]/15 border border-[var(--accent)]/50 text-[var(--accent)]' : ''}
              ${!done && !active ? 'bg-white/5 border border-white/10 text-white/20' : ''}
            `}>
              {done ? (
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-[9px] font-semibold tracking-[0.2em] uppercase transition-colors duration-300
              ${active ? 'text-[var(--accent)]' : done ? 'text-[var(--accent)]/50' : 'text-white/15'}
            `}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-px transition-colors duration-500 ${i < current ? 'bg-[var(--accent)]/30' : 'bg-white/5'}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

const OtpInput = ({ value, onChange }) => {
  const inputs = useRef([]);
  const digits = String(value || '').split('');

  const handleKey = (e, i) => {
    if (e.key === 'Backspace') {
      const next = digits.map((d, idx) => idx === i ? '' : d);
      onChange(next.join(''));
      if (i > 0 && !digits[i]) inputs.current[i - 1]?.focus();
    }
  };

  const handleChange = (e, i) => {
    const val  = e.target.value.replace(/\D/g, '').slice(-1);
    const next = digits.map((d, idx) => idx === i ? val : d);
    while (next.length < 6) next.push('');
    onChange(next.join(''));
    if (val && i < 5) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted.padEnd(6, '').slice(0, 6));
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-2 justify-between" role="group" aria-label="6-digit verification code">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          aria-label={`Digit ${i + 1} of 6`}
          value={digits[i] || ''}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKey(e, i)}
          onPaste={handlePaste}
          className={`w-full aspect-square max-w-[52px] text-center text-[20px] font-bold rounded-xl border bg-white/5 text-[#e5e2e1] outline-none transition-all duration-200
            ${digits[i]
              ? 'border-[var(--accent)]/50 bg-[var(--accent)]/[0.04] shadow-[0_0_0_3px_rgba(107,142,35,0.08)]'
              : 'border-white/10 focus:border-[var(--accent)]/40 focus:bg-[var(--accent)]/[0.04] focus:shadow-[0_0_0_3px_rgba(107,142,35,0.08)]'
            }`}
        />
      ))}
    </div>
  );
};

const ErrorBox = ({ msg }) => (
  <div className="bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] font-semibold tracking-[0.1em] uppercase py-2.5 px-3.5 mb-5 text-center">
    {msg}
  </div>
);

const SubmitBtn = ({ loading, label, disabled = false }) => (
  <button
    type="submit"
    disabled={loading || disabled}
    className="btn-primary w-full bg-[var(--accent)] text-[var(--text-inverse)] font-bold text-[11px] tracking-[0.25em] uppercase p-[15px] rounded-[10px] cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 relative overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {loading ? (
      <><div className="w-[13px] h-[13px] rounded-full animate-spin border-2 border-black border-t-transparent" /> Processing...</>
    ) : (
      <>{label} <span style={{ fontSize: 15 }}>→</span></>
    )}
  </button>
);

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [step,        setStep]        = useState(0);
  const [email,       setEmail]       = useState('');
  const [otp,         setOtp]         = useState('');
  const [resetToken,  setResetToken]  = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [focused,     setFocused]     = useState('');
  const [done,        setDone]        = useState(false);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const clearError = () => setError('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    const trimmedEmail = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) { setError('Enter a valid email address.'); return; }
    setLoading(true); clearError();
    try {
      await post('/api/forgot-password/send-otp', { email: trimmedEmail });
      setStep(1);
      setResendTimer(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (String(otp || '').replace(/\D/g, '').length < 6) return setError('Enter the full 6-digit code.');
    setLoading(true); clearError();
    try {
      const data = await post('/api/forgot-password/verify-otp', { email: String(email || '').trim(), otp: String(otp || '').replace(/\D/g, '') });
      setResetToken(data.resetToken);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true); clearError();
    try {
      await post('/api/forgot-password/send-otp', { email: String(email || '').trim() });
      setOtp('');
      setResendTimer(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPw) return setError('Passwords do not match.');
    if (newPassword.length < 8)    return setError('Password must be at least 8 characters.');
    setLoading(true); clearError();
    try {
      await post('/api/forgot-password/reset-password', { email: String(email || '').trim(), resetToken, newPassword });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const pwStrength = (() => {
    if (!newPassword) return null;
    let score = 0;
    if (newPassword.length >= 8)          score++;
    if (newPassword.length >= 12)         score++;
    if (/[A-Z]/.test(newPassword))        score++;
    if (/[0-9]/.test(newPassword))        score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    if (score <= 1) return { label: 'Weak',   color: '#ef4444', pct: '33%'  };
    if (score <= 3) return { label: 'Medium', color: '#f59e0b', pct: '66%'  };
    return              { label: 'Strong', color: 'var(--accent)',  pct: '100%' };
  })();

  return (
    <div data-theme="dark" className="min-h-screen flex items-center justify-center font-['DM_Sans',sans-serif] text-[#e5e2e1] overflow-hidden relative bg-[#0e0e0e]">
      <div className="bg-image fixed inset-0 z-0" />

      <div className="relative z-30 w-full flex items-center justify-center p-5 sm:p-[40px_20px]">

        {done ? (
          <div className="glass-card w-full max-w-[420px] border border-[var(--accent)]/20 rounded-[20px] p-6 sm:p-[40px_38px] text-center relative overflow-hidden">
            <div className="w-20 h-20 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-['Bebas_Neue',sans-serif] text-[28px] tracking-widest text-[#e5e2e1] mb-2 uppercase">Password Reset</h2>
            <p className="text-[12px] text-[#c4c9b0]/50 leading-relaxed mb-2">
              Your credentials have been updated. Redirecting to login...
            </p>
            <div className="flex gap-1 justify-center mt-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/40 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        ) : (

        <div className="glass-card w-full max-w-[420px] border border-[var(--accent)]/12 rounded-[20px] p-6 sm:p-[40px_38px] relative overflow-hidden">

          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-7">
            <div className="w-[34px] h-[34px] bg-[var(--accent)] rounded-lg flex items-center justify-center">
              <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none">
                <path d="M3 12h3l3-8 4 16 3-10 2 2h3" stroke="var(--text-inverse)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-['Bebas_Neue',sans-serif] text-[21px] tracking-[0.12em] text-[#e5e2e1]">VITALIS</span>
          </div>

          <StepBar current={step} />

          {step === 0 && (
            <>
              <h2 className="font-['Bebas_Neue',sans-serif] text-[28px] tracking-[0.04em] text-[#e5e2e1] mb-1">RESET ACCESS</h2>
              <p className="text-[12px] text-[#c4c9b0]/50 tracking-[0.02em] mb-6 leading-relaxed">
                Enter the email linked to your account. We'll send you a 6-digit verification code.
              </p>
              <form onSubmit={handleSendOtp}>
                {error && <ErrorBox msg={error} />}
                <div className="mb-5">
                  <label className={`block text-[10px] font-semibold tracking-[0.25em] uppercase mb-[7px] transition-colors duration-200 ${focused === 'email' ? 'text-[var(--accent)]' : 'text-[#c4c9b0]/50'}`}>
                    Email Address
                  </label>
                  <input
                    type="email" required
                    placeholder="athlete@vitalis.io"
                    value={email}
                    onChange={e => { setEmail(e.target.value); clearError(); }}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused('')}
                    className="w-full bg-white/5 border border-white/10 rounded-[10px] text-[#e5e2e1] text-[14px] p-[12px_15px] outline-none transition-all duration-200 placeholder:text-white/15 focus:border-[var(--accent)]/45 focus:bg-[var(--accent)]/[0.04] focus:ring-[3px] focus:ring-[var(--accent)]/10 box-border"
                  />
                </div>
                <SubmitBtn loading={loading} label="Send Verification Code" />
              </form>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-['Bebas_Neue',sans-serif] text-[28px] tracking-[0.04em] text-[#e5e2e1] mb-1">CHECK YOUR EMAIL</h2>
              <p className="text-[12px] text-[#c4c9b0]/50 tracking-[0.02em] mb-1 leading-relaxed">
                A 6-digit code was sent to
              </p>
              <p className="text-[13px] font-semibold text-[var(--accent)] mb-6 truncate">{email}</p>
              <form onSubmit={handleVerifyOtp}>
                {error && <ErrorBox msg={error} />}
                <div className="mb-6">
                  <label className="block text-[10px] font-semibold tracking-[0.25em] uppercase mb-4 text-[#c4c9b0]/50">
                    Verification Code
                  </label>
                  <OtpInput value={otp} onChange={v => { setOtp(v); clearError(); }} />
                </div>
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[11px] text-[#c4c9b0]/35">Didn't receive it?</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendTimer > 0 || loading}
                    className={`text-[11px] font-semibold transition-colors duration-200 ${resendTimer > 0 ? 'text-white/20 cursor-not-allowed' : 'text-[var(--accent-dark)] hover:text-[var(--accent)] cursor-pointer'}`}
                  >
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
                  </button>
                </div>
                <SubmitBtn loading={loading} label="Verify Code" disabled={otp.replace(/\D/g, '').length < 6} />
              </form>
              <button
                type="button"
                onClick={() => { setStep(0); setOtp(''); clearError(); }}
                className="w-full mt-3 text-[11px] text-white/25 hover:text-white/50 transition-colors duration-200 text-center py-1"
              >
                ← Use a different email
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-['Bebas_Neue',sans-serif] text-[28px] tracking-[0.04em] text-[#e5e2e1] mb-1">NEW PASSWORD</h2>
              <p className="text-[12px] text-[#c4c9b0]/50 tracking-[0.02em] mb-6 leading-relaxed">
                Choose a strong password for your Vitalis account.
              </p>
              <form onSubmit={handleReset}>
                {error && <ErrorBox msg={error} />}

                <div className="mb-4">
                  <label className={`block text-[10px] font-semibold tracking-[0.25em] uppercase mb-[7px] transition-colors duration-200 ${focused === 'newpw' ? 'text-[var(--accent)]' : 'text-[#c4c9b0]/50'}`}>
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      required minLength={8}
                      placeholder="••••••••••••"
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); clearError(); }}
                      onFocus={() => setFocused('newpw')}
                      onBlur={() => setFocused('')}
                      className="w-full bg-white/5 border border-white/10 rounded-[10px] text-[#e5e2e1] text-[14px] p-[12px_44px_12px_15px] outline-none transition-all duration-200 placeholder:text-white/15 focus:border-[var(--accent)]/45 focus:bg-[var(--accent)]/[0.04] focus:ring-[3px] focus:ring-[var(--accent)]/10 box-border"
                    />
                    <button type="button" onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                    >
                      {showPw
                        ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                        : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      }
                    </button>
                  </div>
                  {pwStrength && (
                    <div className="mt-2">
                      <div className="h-[2px] bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: pwStrength.pct, background: pwStrength.color }} />
                      </div>
                      <p className="text-[10px] mt-1 font-semibold" style={{ color: pwStrength.color }}>{pwStrength.label}</p>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <label className={`block text-[10px] font-semibold tracking-[0.25em] uppercase mb-[7px] transition-colors duration-200 ${focused === 'confirmpw' ? 'text-[var(--accent)]' : 'text-[#c4c9b0]/50'}`}>
                    Confirm Password
                  </label>
                  <input
                    type="password" required
                    placeholder="••••••••••••"
                    value={confirmPw}
                    onChange={e => { setConfirmPw(e.target.value); clearError(); }}
                    onFocus={() => setFocused('confirmpw')}
                    onBlur={() => setFocused('')}
                    className={`w-full bg-white/5 border rounded-[10px] text-[#e5e2e1] text-[14px] p-[12px_15px] outline-none transition-all duration-200 placeholder:text-white/15 focus:ring-[3px] box-border
                      ${confirmPw && newPassword !== confirmPw
                        ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10'
                        : 'border-white/10 focus:border-[var(--accent)]/45 focus:bg-[var(--accent)]/[0.04] focus:ring-[var(--accent)]/10'
                      }`}
                  />
                  {confirmPw && newPassword !== confirmPw && (
                    <p className="text-[10px] text-red-400/70 mt-1.5 font-semibold">Passwords do not match</p>
                  )}
                </div>

                <SubmitBtn loading={loading} label="Update Password" disabled={newPassword !== confirmPw || !newPassword} />
              </form>
            </>
          )}

          <div className="mt-6 text-center text-[12px] text-[#c4c9b0]/45">
            Remember it?{' '}
            <Link to="/login" className="text-[var(--accent-dark)] font-semibold ml-1 no-underline transition-colors duration-200 hover:text-[var(--accent)]">
              Sign in
            </Link>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;