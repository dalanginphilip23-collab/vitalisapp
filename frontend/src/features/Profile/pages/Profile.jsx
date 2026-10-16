// pages/Profile.jsx — redesigned to match reference image (dark + green header + 3 stats + accordion)
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Sidebar, BottomNav, Topbar } from '../../../components/index.js';
import { useProfile } from '../hooks/useProfile.js';
import { useAvatar } from '../hooks/useAvatar.js';
import Toast from '../components/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import ChangePasswordModal from '../components/ChangePasswordModal.jsx';
import ChangeGoalModal from '../components/ChangeGoalModal.jsx';
import { DEFAULT_AVATARS } from '../utils/avatar.js';
import { resolveAvatar, avatarGradient, getInitials } from '../../../lib/avatar.js';
import { apiFetch } from '../../../lib/apiClient.js';
import { goalLabel, isGoalLikeBio } from '../../Onboarding/constants/goals.js';
import Eyebrow from '../components/Eyebrow.jsx';
import GoalSnapshotCard from '../components/GoalSnapshotCard.jsx';
import BodyMetricsPanel from '../components/BodyMetricsPanel.jsx';
import GoalPicker from '../components/GoalPicker.jsx';

const SectionRow = ({ icon, title, subtitle, expanded, onClick, danger, rightIcon }) => (
  <button
    onClick={onClick}
    aria-expanded={expanded ?? undefined}
    className={`w-full flex items-center gap-3 px-4 py-4 min-h-[64px] text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${danger ? 'hover:bg-red-500/5' : 'hover:bg-[var(--bg-hover)] active:bg-[var(--bg-hover)]'}`}
  >
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${danger ? 'bg-red-500/10 border-red-500/20' : 'bg-[var(--bg-hover)] border-[var(--border-light)]'}`}>
      <span className={`material-symbols-outlined text-[18px] ${danger ? 'text-[var(--error)]' : 'text-[var(--accent)]'}`}>{icon}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-[13px] font-bold leading-tight truncate ${danger ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>{title}</p>
      <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{subtitle}</p>
    </div>
    <span className={`material-symbols-outlined text-[20px] shrink-0 transition-transform text-[var(--text-muted)] ${expanded ? 'rotate-180' : ''}`}>
      {rightIcon || (expanded !== undefined ? 'expand_more' : 'chevron_right')}
    </span>
  </button>
);

const Profile = () => {
  const {
    USER_ID,
    loading, isLoading, isSaving, isDirty,
    toastVisible, toastMessage, toastVariant,
    sessions,
    formData, onboarding, setOnboarding, avatarSrc,
    dob, setDob, sex, setSex,
    setToastVisible, setAvatarSrc, setPendingAvatar, setIsEditing,
    handleInputChange, handleDiscard, confirmDiscard, cancelDiscard, showDiscardConfirm, handleSave, handleLogout,
    handleRevoke,
    showToast,
  } = useProfile();

  const {
    uploadPreview,
    fileInputRef,
    handleSelectPreset,
    handleFileChange,
    handleRemoveAvatar,
  } = useAvatar({ setAvatarSrc, setPendingAvatar });

  const [expanded, setExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const [streakDays, setStreakDays] = useState(0);
  const [weightProgress, setWeightProgress] = useState(null); // { diff } | { pct } | null

  // MFP-style header stats: check-in streak + weight progress (both best-effort).
  // NOTE: kept above the early returns — hooks must run unconditionally.
  useEffect(() => {
    if (!USER_ID) return;
    const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    apiFetch(`/api/checkins/${USER_ID}/history?days=60`)
      .then((d) => {
        const days = new Set((d.history || []).map(h => String(h.checkin_date || h.check_date || '').slice(0, 10)));
        const cur = new Date();
        if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1); // today's check-in can still happen
        let s = 0;
        while (days.has(dayKey(cur))) { s++; cur.setDate(cur.getDate() - 1); }
        setStreakDays(s);
      })
      .catch(() => {});
    apiFetch(`/api/goals/active/${USER_ID}`)
      .then((d) => {
        const g = d.goal;
        const curW = d.currentWeightKg != null ? Number(d.currentWeightKg) : null;
        if (g?.weightKg != null && curW != null) {
          setWeightProgress({ diff: Number(g.weightKg) - curW });
        } else if (d.progressPct != null) {
          setWeightProgress({ pct: Number(d.progressPct) });
        }
      })
      .catch(() => {});
  }, [USER_ID]);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [changeGoalOpen, setChangeGoalOpen] = useState(false);
  const [pendingGoalType, setPendingGoalType] = useState(null);
  const [metricsEditSignal, setMetricsEditSignal] = useState(0);
  const [isMasterEditing, setIsMasterEditing] = useState(false);
  const profileSectionRef = useRef(null);

  const handleMasterEdit = () => {
    if (isGoalLikeBio(formData.bio)) {
      handleInputChange({ target: { value: '' } }, 'bio');
    }
    setIsMasterEditing(true);
    setMetricsEditSignal((n) => n + 1);
    setOpenSection('account');
    setTimeout(() => profileSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const handleMasterDone = () => {
    setIsMasterEditing(false);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex overflow-x-hidden">
        <Sidebar expanded={expanded} setExpanded={setExpanded} onClick={handleLogout} />
        <div className={`flex-1 flex flex-col min-w-0 ${expanded ? 'md:ml-60' : 'md:ml-18'}`}>
          <Topbar sidebarExpanded={expanded} userId={USER_ID} />
          <main className="w-full max-w-[720px] mx-auto px-4 pb-20 pt-[56px]">
            <div className="h-4 w-16 rounded-full bg-[var(--bg-hover)] animate-pulse mt-4 mb-3" />
            <div className="h-5 w-24 rounded-full bg-[var(--bg-hover)] animate-pulse mb-4" />
            <div className="h-24 rounded-[16px] bg-[var(--bg-hover)] animate-pulse flex items-center gap-4 p-5">
              <div className="w-16 h-16 rounded-full bg-[var(--bg-card)] animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded-full bg-[var(--bg-card)] animate-pulse" />
                <div className="h-3 w-48 rounded-full bg-[var(--bg-card)] animate-pulse" />
                <div className="h-5 w-20 rounded-full bg-[var(--bg-card)] animate-pulse" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <div className="flex-1 h-20 rounded-[16px] bg-[var(--bg-hover)] animate-pulse" />
              <div className="flex-1 h-20 rounded-[16px] bg-[var(--bg-hover)] animate-pulse" />
              <div className="flex-1 h-20 rounded-[16px] bg-[var(--bg-hover)] animate-pulse" />
            </div>
            <div className="h-64 rounded-[16px] bg-[var(--bg-hover)] animate-pulse mt-6" />
          </main>
        </div>
      </div>
    );
  }
  if (!USER_ID) return null;

  const toggle = (id) => setOpenSection(prev => prev === id ? null : id);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex overflow-x-hidden relative">
      <div className="glass-content flex-1 min-w-0">
      <Toast message={toastMessage} visible={toastVisible} onDismiss={() => setToastVisible(false)} variant={toastVariant} />
      <Sidebar expanded={expanded} setExpanded={setExpanded} onClick={handleLogout} />
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${expanded ? 'md:ml-60' : 'md:ml-18'}`}>
        <Topbar sidebarExpanded={expanded} userId={USER_ID} />

        <main className="w-full max-w-[720px] lg:max-w-4xl mx-auto px-4 pb-20 md:pb-8 pt-[56px]">
          {/* Header band: Streak | avatar+name+tier | Progress.
              Solid deep-green block (no gradient wash) with light text in
              both themes — dark media block, tokens can't express it. */}
          <div className="relative rounded-[20px] overflow-hidden text-[#EAF2EA] shadow-md mt-4 bg-[#1B4332] border border-white/10">
            <div className="flex items-center justify-between gap-1.5 sm:gap-2 px-3 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5">
              <div className="text-center w-[56px] sm:w-[76px] shrink-0">
                <p className="text-[20px] sm:text-[22px] font-black leading-none tabular-nums">{streakDays}</p>
                <p className="text-[10px] font-bold mt-1 leading-tight opacity-80">Streak<br />days</p>
              </div>
              <div className="w-px self-stretch bg-white/15 rounded-full" aria-hidden="true" />
              <div className="flex flex-col items-center min-w-0 flex-1">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 sm:w-[76px] sm:h-[76px] rounded-full overflow-hidden border-2 border-white/25 bg-white/10 flex items-center justify-center font-bold text-[20px]">
                    {(() => {
                      const a = resolveAvatar(avatarSrc, formData.fullName);
                      return a.kind === 'image'
                        ? <img src={a.src} alt="avatar" className="w-full h-full object-cover" />
                        : <span className="w-full h-full flex items-center justify-center text-black bg-[#4E9B5F]">{a.initials}</span>;
                    })()}
                  </div>
                  <button onClick={() => setPickerOpen(v => !v)} aria-label={pickerOpen ? 'Close avatar picker' : 'Change avatar'} aria-expanded={pickerOpen} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#6BAE7E] text-[#0C1410] border border-transparent flex items-center justify-center shadow hover:scale-105 active:scale-95 transition-transform">
                    <span className="material-symbols-outlined text-[15px]">{pickerOpen ? 'close' : 'photo_camera'}</span>
                  </button>
                </div>
                <p className="text-[15px] font-extrabold tracking-tight text-center leading-tight mt-2 break-words max-w-[140px] min-[380px]:max-w-[180px] sm:max-w-[220px]">{formData.fullName || 'Athlete'}</p>
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black opacity-80">
                  <span className="material-symbols-outlined text-[13px]">crown</span>
                  {onboarding?.goalType ? goalLabel(onboarding.goalType) : 'No goal yet'}
                </span>
              </div>
              <div className="w-px self-stretch bg-white/15 rounded-full" aria-hidden="true" />
              <div className="text-center w-[56px] sm:w-[76px] shrink-0">
                <p className="text-[22px] font-black leading-none tabular-nums">
                  {weightProgress == null ? '—' : weightProgress.diff != null ? Math.abs(weightProgress.diff).toFixed(1) : `${weightProgress.pct}%`}
                </p>
                <p className="text-[10px] font-bold mt-1 leading-tight">
                  {weightProgress?.diff != null
                    ? (weightProgress.diff > 0 ? <>kg<br />lost</> : weightProgress.diff < 0 ? <>kg<br />gained</> : 'on track')
                    : weightProgress?.pct != null ? <>of<br />goal</> : <>no<br />data</>}
                </p>
              </div>
            </div>
          </div>

          {/* Avatar picker */}
          {pickerOpen && (
            <div className="mt-3 glass-card border border-[var(--border-light)] rounded-[16px] p-4">
              <div className="flex items-center justify-between mb-3">
                <Eyebrow>Choose avatar</Eyebrow>
                <button onClick={() => setPickerOpen(false)}><span className="material-symbols-outlined text-[16px] text-[var(--text-muted)]">close</span></button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
                {DEFAULT_AVATARS.map(av => {
                  const isActive = avatarSrc === av.id;
                  return (
                    <button key={av.id} onClick={() => { handleSelectPreset(av.id); setPickerOpen(false); setIsEditing(true); }} className="flex flex-col items-center gap-1 group" aria-label={av.label}>
                      <div className={`w-12 h-12 rounded-xl overflow-hidden border-2 flex items-center justify-center font-bold text-white ${isActive ? 'border-[var(--accent)]' : 'border-[var(--border-light)] group-hover:border-[var(--accent)]/50'}`} style={{ background: avatarGradient(av.seed) }}>
                        {getInitials(av.label)}
                      </div>
                    </button>
                  );
                })}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleFileChange(e); setPickerOpen(false); setIsEditing(true); }} />
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-2.5 border border-dashed border-[var(--border-light)] rounded-xl text-[11px] font-bold text-[var(--text-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors">Upload custom photo</button>
              {uploadPreview && <div className="mt-2 flex items-center gap-2 bg-[var(--accent-bg)] border border-[var(--accent-border)] rounded-xl px-3 py-2"><img src={uploadPreview} alt="preview" className="w-7 h-7 rounded-lg object-cover" /><span className="text-[10px] font-bold text-[var(--accent)]">Custom photo ready</span></div>}
              {avatarSrc && <button onClick={() => { handleRemoveAvatar(); setIsEditing(true); }} className="w-full mt-2 text-[10px] font-bold text-[var(--text-muted)] hover:text-red-400">Remove avatar</button>}
              {isDirty && (
                <div className="flex gap-2 mt-3">
                  <button onClick={handleDiscard} className="flex-1 py-2 rounded-full border border-[var(--border-light)] text-[11px] font-bold text-[var(--text-muted)]">Discard</button>
                  <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2 rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[11px] font-black disabled:opacity-50">{isSaving ? 'Saving…' : 'Save'}</button>
                </div>
              )}
            </div>
          )}

          {/* Single master edit entry for the whole profile */}
          <button
            onClick={() => (isMasterEditing ? handleMasterDone() : handleMasterEdit())}
            aria-expanded={isMasterEditing}
            className={`w-full mt-3 h-12 min-h-[48px] rounded-2xl text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm ${isMasterEditing ? 'border border-[var(--border-light)] bg-[var(--bg-card)]' : 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]'}`}
            style={isMasterEditing ? { color: 'var(--text-primary)' } : undefined}
          >
            <span className="material-symbols-outlined text-[18px]" style={isMasterEditing ? { color: 'var(--accent)' } : undefined}>{isMasterEditing ? 'close' : 'edit'}</span> {isMasterEditing ? 'Done Editing' : 'Edit Profile'}
          </button>

          {/* Body Metrics — separated section (measurements, energy, targets, history) */}
          <div ref={profileSectionRef} className="scroll-mt-20" />
          <Eyebrow className="mt-6 mb-2 px-1">Body Metrics</Eyebrow>
          <div className="glass-card border border-[var(--border-light)] rounded-2xl p-4 sm:p-5 shadow-sm">
            <BodyMetricsPanel USER_ID={USER_ID} initialWeight={formData.weight_kg} initialHeight={formData.height_cm} onboarding={onboarding} showToast={showToast} editSignal={metricsEditSignal} />
          </div>

          {/* Account sections */}
          <Eyebrow className="mt-6 mb-2 px-1">Profile</Eyebrow>
          <div className="glass-card border border-[var(--border-light)] rounded-2xl overflow-hidden divide-y divide-[var(--border-light)] shadow-sm">
            {/* My Account */}
            <div>
              <SectionRow icon="person" title="My Account" subtitle="Personal info & contact details" expanded={openSection === 'account'} onClick={() => toggle('account')} />
              {openSection === 'account' && (
                <div className="px-4 pb-4 pt-1 bg-[var(--bg-primary)]/30">
                  {!isMasterEditing && (
                    <p className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-xl px-3 py-2 mb-1">Tap Edit Profile above to make changes.</p>
                  )}
                  <div className={`space-y-3 ${isMasterEditing ? '' : 'opacity-70'}`}>
                    <div>
                      <label htmlFor="pf-name" className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Full name</label>
                      <input id="pf-name" value={formData.fullName} disabled={!isMasterEditing} onChange={e => handleInputChange(e, 'fullName')} placeholder="Your name" autoComplete="name" className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[16px] sm:text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-60" />
                    </div>
                    <div>
                      <label htmlFor="pf-email" className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Email (locked)</label>
                      <input id="pf-email" value={formData.email} readOnly className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[16px] sm:text-[13px] text-[var(--text-muted)] opacity-60" />
                    </div>
                    <div>
                      <label htmlFor="pf-contact" className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Emergency contact</label>
                      <input id="pf-contact" value={formData.contact} disabled={!isMasterEditing} onChange={e => handleInputChange(e, 'contact')} placeholder="Name · phone" autoComplete="tel" className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[16px] sm:text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-60" />
                    </div>
                    <div>
                      <label htmlFor="pf-bio" className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Bio</label>
                      <textarea id="pf-bio" value={isGoalLikeBio(formData.bio) ? '' : formData.bio} disabled={!isMasterEditing} onChange={e => handleInputChange(e, 'bio')} rows={2} placeholder="Tell us about yourself" className="mt-1 w-full rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 py-3 text-[16px] sm:text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-60 resize-y min-h-[76px]" />
                    </div>
                    <div>
                      <label htmlFor="pf-goal" className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Goal</label>
                      <GoalPicker
                        value={onboarding?.goalType || ''}
                        disabled={!isMasterEditing}
                        onPick={(key) => {
                          setPendingGoalType(key);
                          setChangeGoalOpen(true);
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <label htmlFor="pf-dob" className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">DOB</label>
                        <input id="pf-dob" type="date" value={dob} disabled={!isMasterEditing || !onboarding} onChange={e => { setDob(e.target.value); setIsEditing(true); }} className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[16px] sm:text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-50" />
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="pf-sex" className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Sex</label>
                        <select id="pf-sex" value={sex} disabled={!isMasterEditing || !onboarding} onChange={e => { setSex(e.target.value); setIsEditing(true); }} className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[16px] sm:text-[13px] text-[var(--text-primary)] outline-none disabled:opacity-50">
                          <option value="">—</option>
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Created</p>
                      <p className="text-[12px] font-bold mt-1">{onboarding?.createdAt ? new Date(onboarding.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p>
                    </div>
                    {!onboarding && (
                      <p className="text-[11px] text-[var(--text-muted)]">Complete onboarding to unlock DOB / sex editing.</p>
                    )}
                    {isMasterEditing && isDirty && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button onClick={() => { handleDiscard(); }} className="flex-1 h-12 min-h-[44px] rounded-xl border border-[var(--border-light)] text-[12px] font-bold text-[var(--text-muted)] active:scale-[0.98] transition-all">Discard</button>
                        <button onClick={async () => { await handleSave(); setIsMasterEditing(false); }} disabled={isSaving} className="flex-1 h-12 min-h-[44px] rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[12px] font-black disabled:opacity-50 active:scale-[0.98] transition-all">{isSaving ? 'Saving…' : 'Save changes'}</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* My Goals — full plan snapshot lives here (single home, no duplicate) */}
            <div>
              <SectionRow icon="flag" title="My Goals" subtitle={onboarding?.goalType ? goalLabel(onboarding.goalType) : 'Set your fitness goal'} expanded={openSection === 'goals'} onClick={() => toggle('goals')} />
              {openSection === 'goals' && (
                <div className="px-4 pb-4 pt-1 bg-[var(--bg-primary)]/30">
                  <GoalSnapshotCard onboarding={onboarding} onChangeGoal={() => setChangeGoalOpen(true)} />
                </div>
              )}
            </div>

            {/* Devices & Sessions */}
            <div>
              <SectionRow icon="devices" title="Devices & Sessions" subtitle={sessions.length ? `${sessions.length} signed-in ${sessions.length === 1 ? 'device' : 'devices'}` : "Manage where you're signed in"} expanded={openSection === 'devices'} onClick={() => toggle('devices')} />
              {openSection === 'devices' && (
                <div className="px-4 pb-4 pt-1 bg-[var(--bg-primary)]/30 space-y-2 max-h-[320px] overflow-auto">
                  {sessions.length === 0 ? <p className="text-[12px] text-[var(--text-muted)] py-4 text-center">No sessions</p> :
                    sessions.map(s => (
                      <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border ${s.is_current ? 'border-[var(--accent)]/30 bg-[var(--accent-bg)]' : 'border-[var(--border-light)] bg-[var(--bg-hover)]'}`}>
                        <span className="material-symbols-outlined text-[16px] text-[var(--text-muted)]">{s.is_current ? 'smartphone' : 'laptop_mac'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold truncate text-[var(--text-primary)]">{s.browser} on {s.os}</p>
                          <p className="text-[10px] font-mono text-[var(--text-muted)] truncate">{[s.city, s.country].filter(Boolean).join(', ') || 'UNKNOWN'} {s.is_current && '• ACTIVE NOW'}</p>
                        </div>
                        {s.is_current ? <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]">Active</span> :
                          <button onClick={() => handleRevoke(s.id)} className="text-[10px] font-bold text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10">Revoke</button>}
                      </div>
                    ))}
                </div>
              )}
            </div>

          </div>

          {/* Security */}
          <Eyebrow className="mt-6 mb-2 px-1">Security</Eyebrow>
          <div className="glass-card border border-[var(--border-light)] rounded-2xl overflow-hidden divide-y divide-[var(--border-light)] shadow-sm">
            <SectionRow icon="key" title="Change Password" subtitle="Keep your account secure" onClick={() => setChangePwOpen(true)} />
            <SectionRow icon="logout" title="Log Out" subtitle="Sign out of this device" danger onClick={handleLogout} />
          </div>

        </main>
      </div>

      <div className="md:hidden"><BottomNav variant="biometrics" /></div>

      {changePwOpen && <ChangePasswordModal onClose={() => setChangePwOpen(false)} onSuccess={() => showToast('Password updated')} />}
      {changeGoalOpen && <ChangeGoalModal userId={USER_ID} currentGoal={pendingGoalType ? { ...onboarding, goalType: pendingGoalType } : onboarding} onClose={() => { setChangeGoalOpen(false); setPendingGoalType(null); }} onUpdated={(goal) => { if (goal) setOnboarding(goal); setPendingGoalType(null); }} showToast={showToast} />}
      <Modal
        isOpen={!!showDiscardConfirm}
        onClose={cancelDiscard}
        title="Discard changes?"
        subtitle="Unsaved edits will be lost."
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={cancelDiscard}>Keep editing</Button>
            <Button variant="danger" onClick={confirmDiscard}>Discard</Button>
          </div>
        }
      >
        <p className="text-[13px] text-[var(--text-muted)]">Discard unsaved profile changes?</p>
      </Modal>
      </div>
    </div>
  );
};

export default Profile;
