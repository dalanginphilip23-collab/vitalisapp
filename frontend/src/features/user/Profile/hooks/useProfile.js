import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiFetch } from '../../../../lib/apiClient.js';
import { useAuth } from '../../../../hooks/useAuth.jsx';
import { getAvatarUrl } from '../utils/avatar.js';
import { goalLabel, GOAL_TYPES } from '../../Onboarding/constants/goals.js';

// Raw goal enums (e.g. BUILD_MUSCLE) must never leak into the Bio textbox.
// Normalize once at load so both a saved enum and the user.goal fallback
// display as their human label ("Build Muscle").
const GOAL_KEYS = new Set(GOAL_TYPES.map((g) => g.key));
const prettyBio = (raw) => (GOAL_KEYS.has(raw) ? goalLabel(raw) : (raw || ''));

export const useProfile = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading, logout, setUser, refreshAuth } = useAuth();
  const USER_ID = user?.id || null;

  // Cache the profile for a few minutes so returning to the page is instant.
  // React Query keeps the last successful payload mounted across route changes.
  const profileQuery = useQuery({
    queryKey: ['profile', USER_ID],
    queryFn: () => apiGet(`/api/profile/${USER_ID}`),
    enabled: !!USER_ID,
    staleTime: 1000 * 60 * 5,
  });
  const isLoading = profileQuery.isLoading;

  const [isSaving,       setIsSaving]       = useState(false);
  const [isEditing,      setIsEditing]      = useState(false);
  const [toastVisible,   setToastVisible]   = useState(false);
  const [toastMessage,   setToastMessage]   = useState('');
  const [toastVariant,   setToastVariant]   = useState('success');
  const [sessions,       setSessions]       = useState([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [isDirty,        setIsDirty]        = useState(false);
  // Identity typed in My Account while the user has NO active goal yet. The
  // "Set Up Your Plan" modal consumes it when creating the first goal, so
  // nothing the user typed is lost — and nothing redirects to onboarding.
  const [pendingIdentity, setPendingIdentity] = useState(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email:    '',
    contact:  '',
    bio:      '',
    height_cm: '',
    weight_kg: '',
  });
  const [onboarding, setOnboarding] = useState(null);
  // Goal identity (dob/sex) — editable from My Account, stored on the
  // active fitness_goals row (NOT in users/user_profiles).
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState('');
  const [savedDob, setSavedDob] = useState('');
  const [savedSex, setSavedSex] = useState('');
  const [savedData,      setSavedData]      = useState({ ...formData });
  const [avatarSrc,      setAvatarSrc]      = useState(null);
  const [savedAvatarSrc, setSavedAvatarSrc] = useState(null);
  const [pendingAvatar,  setPendingAvatar]  = useState(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const showToast = (message, variant = 'success') => {
    setToastMessage(message);
    setToastVariant(variant);
    setToastVisible(true);
  };

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  // ── Device sessions — loaded only when the panel is opened ────────────────
  // This keeps the initial Profile load lean: the list is hidden by default
  // and can be large, so there is no reason to fetch/render it up front.
  const loadSessions = async ({ force = false } = {}) => {
    if (!USER_ID || sessionsLoading) return;
    if (sessionsLoaded && !force) return;
    setSessionsLoading(true);
    try {
      const data = await apiGet('/api/security');
      setSessions(Array.isArray(data) ? data : []);
      setSessionsLoaded(true);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  // ── Sync the cached profile into editable form state ───────────────────────
  // Skip while the user is editing so a background refresh can never wipe input.
  useEffect(() => {
    const dbData = profileQuery.data;
    if (!dbData || isEditing || isDirty) return;

    const mapped = {
      fullName:  dbData.fullName || user?.name  || '',
      email:     dbData.email    || user?.email || '',
      contact:   dbData.contact  || '',
      bio:       prettyBio(dbData.bio || (/unspecified/i.test(user?.goal || '') ? '' : user?.goal)),
      height_cm: dbData.height_cm ?? dbData.onboarding?.heightCm ?? '',
      weight_kg: dbData.weight_kg ?? dbData.onboarding?.weightKg ?? '',
    };
    setFormData(mapped);
    setSavedData(mapped);
    setOnboarding(dbData.onboarding || null);
    // Normalize for inputs: date-only for <input type="date">, UPPER for chips/select.
    const ob = dbData.onboarding || null;
    const dobNorm = ob?.dob ? String(ob.dob).slice(0, 10) : '';
    const sexNorm = ob?.sex ? String(ob.sex).toUpperCase() : '';
    setDob(dobNorm);
    setSavedDob(dobNorm);
    setSex(sexNorm);
    setSavedSex(sexNorm);

    const src = dbData.avatar_url || user?.avatar || getAvatarUrl(USER_ID);
    setAvatarSrc(src);
    setSavedAvatarSrc(src);
  }, [profileQuery.data, USER_ID, user, isEditing, isDirty]);

  useEffect(() => {
    if (profileQuery.error && import.meta.env.DEV) {
      console.error('Failed to fetch profile:', profileQuery.error);
    }
  }, [profileQuery.error]);

  // Keep the cached snapshot in sync with goal edits made elsewhere on the page.
  useEffect(() => {
    if (!USER_ID || !onboarding) return;
    queryClient.setQueryData(['profile', USER_ID], (prev) => {
      if (!prev || prev.onboarding === onboarding) return prev;
      return { ...prev, onboarding };
    });
  }, [USER_ID, onboarding, queryClient]);

  // ── Track dirty state ──────────────────────────────────────────────────────
  // FIX: height_cm / weight_kg removed from the dirty check — they're
  // read-only on this page now and can never differ from savedData here.
  useEffect(() => {
    const formChanged =
      formData.fullName !== savedData.fullName ||
      formData.contact  !== savedData.contact  ||
      formData.bio      !== savedData.bio;
    const identityChanged = dob !== savedDob || sex !== savedSex;
    setIsDirty(formChanged || identityChanged || !!pendingAvatar);
  }, [formData, savedData, dob, savedDob, sex, savedSex, pendingAvatar]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleInputChange = (e, field) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (!isEditing) setIsEditing(true);
  };

  const doDiscard = () => {
    setFormData({ ...savedData });
    setDob(savedDob);
    setSex(savedSex);
    setPendingAvatar(null);
    setAvatarSrc(savedAvatarSrc);
    setIsEditing(false);
    setIsDirty(false);
  };

  const handleDiscard = () => {
    if (!isDirty) {
      doDiscard();
      return;
    }
    setShowDiscardConfirm(true);
  };

  const confirmDiscard = () => {
    doDiscard();
    setShowDiscardConfirm(false);
  };

  const cancelDiscard = () => setShowDiscardConfirm(false);

  const handleRevoke = async (sessionId) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    try {
      await apiFetch(`/api/security/${sessionId}`, { method: 'DELETE' });
      showToast('Session revoked');
    } catch (err) {
      if (import.meta.env.DEV) console.error('Revoke session error:', err);
      const data = await apiGet('/api/security').catch(() => null);
      if (Array.isArray(data)) setSessions(data);
      showToast('Failed to revoke session', 'error');
    }
  };

  const handleSave = async () => {
    if (!USER_ID) return;
    setIsSaving(true);
    try {
      const avatarToSave = pendingAvatar
        ? pendingAvatar.value
        : (avatarSrc || savedAvatarSrc || null);

      // FIX: height_cm / weight_kg intentionally NOT included in this
      // request anymore — they're read-only on this page and are owned
      // by the BMI page. Sending them here (even unchanged) is unnecessary
      // now that the backend route no longer accepts/updates them.
      const body = {
        fullName:   formData.fullName,
        contact:    formData.contact,
        bio:        formData.bio,
        avatar_url: avatarToSave,
      };

      await apiFetch('/api/profile/update', {
        method: 'PUT',
        body:   JSON.stringify(body),
      });

      // Goal identity lives on the active fitness_goals row — PATCH it
      // separately so DOB/sex edits don't force a full goal rewrite.
      // No active goal (skipped onboarding): stash the identity for the
      // in-place "Set Up Your Plan" modal instead of redirecting anywhere.
      if (dob !== savedDob || sex !== savedSex) {
        if (onboarding) {
          const g = await apiFetch(`/api/goals/active/${USER_ID}`, {
            method: 'PATCH',
            body:   JSON.stringify({ dob: dob || null, sex: sex || null }),
          });
          if (g?.goal) setOnboarding(g.goal);
          setSavedDob(dob);
          setSavedSex(sex);
        } else {
          // Stash only — saved refs stay put so the dirty check stays sane.
          // The Set Up Your Plan modal consumes this identity when created.
          setPendingIdentity({ dob: dob || null, sex: sex || null });
          showToast('Almost set — create your plan below to save DOB / sex', 'info');
        }
      }

      // Update the cached profile before leaving edit mode so the sync effect
      // cannot briefly restore the previous name/contact/avatar.
      queryClient.setQueryData(['profile', USER_ID], (prev) => (prev ? {
        ...prev,
        fullName: formData.fullName,
        email: formData.email,
        contact: formData.contact,
        bio: formData.bio,
        avatar_url: avatarToSave,
      } : prev));

      setSavedData({ ...formData });
      setSavedAvatarSrc(avatarToSave);
      setPendingAvatar(null);
      setIsEditing(false);
      setIsDirty(false);

      setUser(prev => ({
        ...prev,
        name:       formData.fullName,
        avatar:     avatarToSave,
        avatar_url: avatarToSave,
      }));

      await refreshAuth({ silent: true });

      showToast('Profile saved');
    } catch (err) {
      if (import.meta.env.DEV) console.error('Save error:', err);
      showToast('Save failed — check your connection', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return {
    user, loading, USER_ID,
    isLoading, isSaving, isEditing, isDirty,
    toastVisible, toastMessage, toastVariant,
    sessions, sessionsLoaded, sessionsLoading, loadSessions,
    formData, onboarding, setOnboarding, avatarSrc, pendingAvatar,
    dob, setDob, sex, setSex,
    pendingIdentity, setPendingIdentity,
    setToastVisible, setAvatarSrc, setPendingAvatar, setIsEditing,
    handleInputChange, handleDiscard, confirmDiscard, cancelDiscard, showDiscardConfirm, handleRevoke, handleSave, handleLogout,
    showToast,
  };
};