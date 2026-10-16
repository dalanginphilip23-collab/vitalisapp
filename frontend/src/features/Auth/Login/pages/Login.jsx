import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLogin } from '../hooks/useLogin.js';
import { GOOGLE_CLIENT_ID } from '../../../../app/config/env.js';

const Login = () => {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [focused,  setFocused]  = useState('');

  const { error, loading, handleSubmit, loginWithGoogle } = useLogin();
  const googleEnabled = !!GOOGLE_CLIENT_ID;

  return (
    <div data-theme="dark" className="relative min-h-screen w-full bg-[#0e0e0e] font-sans text-[#e5e2e1] overflow-x-hidden overflow-y-auto flex">

      <style>{`
        .vitalis-spinner {
          width: 14px; height: 14px;
          border: 2px solid #ffffff;
          border-top-color: transparent;
          border-radius: 50%;
          animation: vitalis-spin 0.7s linear infinite;
        }
        @keyframes vitalis-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes vitalis-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vitalis-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes vitalis-fade-left {
          from { opacity: 0; transform: translateX(-22px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes vitalis-scale-in {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .v-hero-eyebrow {
          animation: vitalis-fade-left 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s backwards;
        }
        .v-hero-h1 {
          animation: vitalis-fade-left 0.7s cubic-bezier(0.22,1,0.36,1) 0.25s backwards;
        }
        .v-hero-sub {
          animation: vitalis-fade-left 0.6s cubic-bezier(0.22,1,0.36,1) 0.45s backwards;
        }
        .v-hero-stats {
          animation: vitalis-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) 0.6s backwards;
        }
        .v-card {
          animation: vitalis-scale-in 0.75s cubic-bezier(0.22,1,0.36,1) 0.15s backwards;
        }
        .v-card-logo    { animation: vitalis-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 0.5s  backwards; }
        .v-card-title   { animation: vitalis-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 0.62s backwards; }
        .v-card-sub     { animation: vitalis-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 0.70s backwards; }
        .v-card-field1  { animation: vitalis-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 0.80s backwards; }
        .v-card-field2  { animation: vitalis-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 0.90s backwards; }
        .v-card-forgot  { animation: vitalis-fade-in 0.4s ease            0.98s backwards; }
        .v-card-btn     { animation: vitalis-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 1.05s backwards; }
        .v-card-divider { animation: vitalis-fade-in 0.4s ease            1.15s backwards; }
        .v-card-google  { animation: vitalis-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 1.22s backwards; }
        .v-card-footer  { animation: vitalis-fade-in 0.4s ease            1.35s backwards; }
      `}</style>

      {/* Layered Backgrounds */}
      <div className="fixed inset-0 z-0 bg-[url('/auth-gym.jpg')] bg-cover bg-[center_30%] brightness-[0.28] saturate-[0.7]" />

      {/* Back to Landing */}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="fixed top-6 left-6 z-20 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 backdrop-blur-md px-4 py-2 text-[11px] font-semibold tracking-[0.2em] uppercase text-white/70 hover:text-[var(--accent)] hover:border-[var(--accent)]/30 hover:bg-black/40 transition-all"
      >
        <span className="text-[14px] leading-none">←</span> Back to Landing
      </button>

      <div className="relative z-10 m-auto grid w-full min-h-screen lg:grid-cols-[1fr_480px]">

        {/* Left Hero Panel */}
        <div className="hidden lg:flex flex-col justify-center p-14 gap-4">
          <span className="v-hero-eyebrow text-[11px] font-semibold tracking-[0.35em] uppercase text-[var(--accent)] opacity-80">
            Vitalis Performance OS
          </span>
          <h1 className="v-hero-h1 font-display font-extrabold text-[clamp(56px,6vw,88px)] leading-[0.95] tracking-wider">
            TRAIN<br />
            HARDER.<br />
            <span className="text-[var(--accent)]">RECOVER</span><br />
            SMARTER.
          </h1>
          <p className="v-hero-sub text-[13px] text-[#e5e2e1]/45 max-w-[320px] leading-relaxed font-light mt-1">
            Manual training, nutrition, and recovery logging with AI insights from your own data.
          </p>

          <div className="v-hero-stats flex gap-8 mt-6 pt-6 border-t border-white/10">
            <div className="flex flex-col">
              <span className="font-display font-extrabold text-3xl text-[var(--accent)] leading-none">6</span>
              <span className="text-[10px] tracking-widest uppercase text-white/30">Modules</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-extrabold text-3xl text-[var(--accent)] leading-none">100%</span>
              <span className="text-[10px] tracking-widest uppercase text-white/30">Manual-first</span>
            </div>
          </div>
        </div>

        {/* Right Glass Panel */}
        <div className="flex items-center justify-center p-4 sm:p-8 pt-20 sm:pt-8">
          <div className="v-card relative w-full max-w-[400px] bg-[#121210]/65 backdrop-blur-[32px] saturate-[140%] border border-[var(--accent)]/10 rounded-[20px] p-5 sm:p-10 shadow-[0_32px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)]">

            {/* Logo */}
            <div className="v-card-logo flex items-center gap-3 mb-9">
              <img src="/pwa-192x192.png" alt="Vitalis logo" className="w-9 h-9 rounded-lg" />
              <span className="font-display font-extrabold text-[22px] tracking-[0.12em]">VITALIS</span>
            </div>

            <h2 className="v-card-title font-display font-extrabold text-[32px] tracking-wider leading-none mb-1.5">ACCESS PORTAL</h2>
            <p className="v-card-sub text-xs text-[#c4c9b0]/55 tracking-wide mb-8">Enter credentials to synchronize biometrics.</p>

            <form onSubmit={(e) => handleSubmit(e, { email, password })} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] font-semibold tracking-widest uppercase p-2.5 text-center break-words">
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="v-card-field1 relative">
                <label className={`block text-[10px] font-semibold tracking-[0.25em] uppercase mb-2 transition-colors ${focused === 'email' ? 'text-[var(--accent)]' : 'text-white/50'}`}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="w-full bg-white/5 border border-white/10 rounded-xl text-[16px] sm:text-sm p-3.5 outline-none transition-all focus:border-[var(--accent)]/50 focus:bg-[var(--accent)]/5 focus:ring-4 focus:ring-[var(--accent)]/10 placeholder:text-white/10 disabled:opacity-50"
                  placeholder="athlete@vitalis.io"
                  required
                  disabled={loading}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused('')}
                />
              </div>

              {/* Password */}
              <div className="v-card-field2 relative">
                <label className={`block text-[10px] font-semibold tracking-[0.25em] uppercase mb-2 transition-colors ${focused === 'password' ? 'text-[var(--accent)]' : 'text-white/50'}`}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="w-full bg-white/5 border border-white/10 rounded-xl text-[16px] sm:text-sm p-3.5 pr-12 outline-none transition-all focus:border-[var(--accent)]/50 focus:bg-[var(--accent)]/5 focus:ring-4 focus:ring-[var(--accent)]/10 placeholder:text-white/10 disabled:opacity-50"
                    placeholder="••••••••••••"
                    required
                    disabled={loading}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused('')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    disabled={loading}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-[var(--accent)] transition-colors bg-transparent border-none cursor-pointer text-[18px] leading-none"
                  >
                    <span className="material-symbols-outlined text-[20px]">{showPw ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div className="v-card-forgot flex justify-end">
                <Link to="/reset-password" className="text-[10px] font-semibold tracking-widest uppercase text-[var(--accent-dark)]/70 hover:text-[var(--accent)] transition-colors py-2 min-h-[32px] inline-flex items-center">
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="v-card-btn group relative w-full bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] font-bold text-[11px] tracking-[0.25em] uppercase p-4 rounded-xl shadow-[var(--shadow-md)] hover:bg-[var(--accent-solid-hover)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><div className="vitalis-spinner" /> Signing In...</>
                ) : (
                  <>Sign In <span className="text-lg">→</span></>
                )}
              </button>

              <div className="v-card-divider flex items-center gap-3 py-1">
                <div className="flex-1 h-[1px] bg-white/5" />
                <span className="text-[10px] tracking-[0.3em] uppercase text-white/20">or</span>
                <div className="flex-1 h-[1px] bg-white/5" />
              </div>

              <button
                type="button"
                onClick={() => loginWithGoogle()}
                disabled={loading || !googleEnabled}
                title={!googleEnabled ? 'Google login disabled — set VITE_GOOGLE_CLIENT_ID in frontend/.env and restart' : 'Sign in with Google'}
                className="v-card-google w-full bg-white/5 border border-white/10 rounded-xl text-[11px] font-semibold tracking-widest uppercase p-3.5 flex items-center justify-center gap-2.5 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </form>

            <div className="v-card-footer mt-7 text-center text-xs text-[#c4c9b0]/45">
              Don't have an account?
              <Link to="/register" className="text-[var(--accent-dark)] font-semibold ml-1 hover:text-[var(--accent)] transition-colors">Register</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;