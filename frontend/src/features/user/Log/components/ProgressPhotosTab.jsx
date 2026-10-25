// Module 6 — Progress photos tab: front/side/back captures stored PRIVATELY,
// each reviewed by Gemini (quality + visibility — always labeled a visual
// estimate, never a body-fat or medical read), with an optional
// latest-vs-previous comparison per pose.
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import Modal from '../../../../components/ui/Modal.jsx';
import Button from '../../../../components/ui/Button.jsx';
import { apiGet, apiPost, apiFetch } from '../../../../lib/apiClient.js';
import { compressImage } from '../utils/compressImage.js';

const POSES = [
  { key: 'front', label: 'Front', hint: 'Face the camera, arms relaxed' },
  { key: 'side',  label: 'Side',  hint: 'Stand sideways, weight even' },
  { key: 'back',  label: 'Back',  hint: 'Back to the camera, shoulders square' },
];

const POSE_EMOJI = { front: '🧍', side: '🚶', back: '🚶‍♀️' };

function RatingStars({ rating }) {
  if (!rating) return null;
  return (
    <span className="text-[length:var(--fs-10)] font-black text-[var(--accent)] tabular-nums" title="Gemini photo-usability rating (1–5)">
      {'★'.repeat(rating)}{'☆'.repeat(Math.max(0, 5 - rating))}
    </span>
  );
}

export default function ProgressPhotosTab({ userId }) {
  const [photos, setPhotos]     = useState(null);
  const [error,     setError]   = useState(null);
  const [pose,      setPose]    = useState('front');
  const [busy,      setBusy]    = useState(false);       // upload + analyze pipeline
  const [analyzingId, setAnalyzingId] = useState(null);
  const [viewing,   setViewing] = useState(null);        // photo object in Modal
  const [compare,   setCompare] = useState({ open: false, busy: false, result: null, error: '' });
  // Check-in cadence: { cadence: 'weekly'|'monthly', days, poses: { pose: { nextAllowedAt, daysLeft } } }
  const [cadence,   setCadenceState] = useState(null);
  const [cadenceBusy, setCadenceBusy] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    setError(null);
    try {
      const data = await apiGet('/api/progress/photos');
      setPhotos(Array.isArray(data?.photos) ? data.photos : []);
    } catch (err) {
      setError(err.message);
    }
  };

  // No rows yet → first photo of each pose is always allowed.
  const poseState = () => cadence?.poses?.[pose] || { nextAllowedAt: null, daysLeft: 0 };
  const poseBlocked = poseState().daysLeft > 0;
  const poseLabel = pose.charAt(0).toUpperCase() + pose.slice(1);

  const setCadence = async (next) => {
    if (cadenceBusy || cadence?.cadence === next) return;
    setCadenceBusy(true);
    try {
      await apiFetch('/api/progress/cadence', { method: 'PUT', body: JSON.stringify({ cadence: next }) });
      setCadenceState(await apiGet('/api/progress/cadence'));
    } catch (err) {
      setError(err.message);
    } finally {
      setCadenceBusy(false);
    }
  };

  useEffect(() => {
    load();
    apiGet('/api/progress/cadence').then((state) => setCadenceState(state)).catch(() => setCadenceState(null));
  }, []);

  const forPose = useMemo(() => (photos || []).filter((p) => p.pose === pose), [photos, pose]);

  // Upload → optional auto-analyze (one tap, two small calls; analyze can be
  // retried later without re-uploading).
  const onPhotoPicked = async (e) => {
    // Capture the file BEFORE resetting the input: per the HTML spec,
    // input.value = '' empties the selected-files list — running the reset
    // first silently killed every upload.
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (busy) return;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    setBusy(true);
    setError(null);
    const priorCount = forPose.length; // ≥1 → this upload makes compare possible
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the file'));
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(dataUrl);
      const saved = await apiPost('/api/progress/photos', { pose, image_data: compressed });
      await load();
      // Auto-confirm the check-in: the compare IS the point of the interval.
      apiGet('/api/progress/cadence').then(setCadenceState).catch(() => {});
      // Fire-and-analyze: failure here is recoverable from the photo's menu.
      setAnalyzingId(saved.id);
      try {
        await apiPost(`/api/progress/photos/${saved.id}/analyze`, {});
      } catch { /* analysis failed — user can retry via Analyze button */ }
      await load();
      if (priorCount >= 1) runCompare();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setAnalyzingId(null);
      setBusy(false);
    }
  };

  const analyze = async (photo) => {
    setAnalyzingId(photo.id);
    setError(null);
    try {
      await apiPost(`/api/progress/photos/${photo.id}/analyze`, {});
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzingId(null);
    }
  };

  const remove = async (photoId) => {
    try {
      await apiFetch(`/api/progress/photos/${photoId}`, { method: 'DELETE' });
      setViewing(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const runCompare = async () => {
    setCompare({ open: true, busy: true, result: null, error: '' });
    try {
      const result = await apiPost('/api/progress/compare', { pose });
      setCompare({ open: true, busy: false, result, error: '' });
    } catch (err) {
      setCompare({ open: true, busy: false, result: null, error: err.message });
    }
  };

  const photoUrl = (id) => `/api/progress/photos/${id}/image`;

  return (
    <div className="glass-card border border-[var(--border-light)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full space-y-4" data-user={userId}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[length:var(--fs-15)] font-extrabold tracking-tight">Progress Photos</h3>
          <p className="text-[length:var(--fs-11)] text-[var(--text-muted)]">
            Front · Side · Back — private to you. Gemini reviews them; results are visual estimates only.
          </p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoPicked} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy || poseBlocked}
          className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-1.5 h-10 px-4 rounded-full bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-10)] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
        >
          <Icon name="add_a_photo" className="text-[length:var(--fs-14)]" /> {busy ? 'Uploading…' : poseBlocked ? 'Check-in done' : 'Add photo'}
        </button>
      </div>

      {/* Pose selector */}
      <div className="grid grid-cols-3 gap-1 sm:gap-1.5 bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-2xl p-1 sm:p-1.5">
        {POSES.map((p) => (
          <button
            key={p.key}
            onClick={() => setPose(p.key)}
            aria-pressed={pose === p.key}
            title={p.hint}
            className={`flex w-full min-w-0 items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3 h-10 rounded-xl text-[length:var(--fs-11)] font-black uppercase tracking-[0.06em] sm:tracking-widest whitespace-nowrap border-none cursor-pointer transition-all ${
              pose === p.key
                ? 'text-[var(--text-inverse)] bg-[var(--accent)] shadow-[var(--shadow-md)]'
                : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <span aria-hidden="true">{POSE_EMOJI[p.key]}</span> {p.label}
          </button>
        ))}
      </div>

      {/* Check-in cadence — enforced server-side so before/after pairs stay fair */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-hover)] px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name="event_repeat" className="text-[length:var(--fs-14)] text-[var(--accent)] shrink-0" />
          <div className="min-w-0">
            <p className="text-[length:var(--fs-11)] font-black uppercase tracking-widest">
              {(cadence?.cadence || 'monthly') === 'weekly' ? 'Weekly' : 'Monthly'} check-in
            </p>
            <p className="text-[length:var(--fs-10)] text-[var(--text-muted)] truncate">
              {poseBlocked
                ? `${poseLabel} next check-in in ${poseState().daysLeft} ${poseState().daysLeft === 1 ? 'day' : 'days'} (${poseState().nextAllowedAt?.slice(0, 10)})`
                : `${poseLabel} ready for a check-in`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--border-light)] bg-[var(--bg-elevated)] p-1 w-full sm:w-auto">
          {['weekly', 'monthly'].map((c) => (
            <button
              key={c}
              onClick={() => setCadence(c)}
              disabled={cadenceBusy || cadence?.cadence === c}
              aria-pressed={cadence?.cadence === c}
              className={`px-3 h-8 rounded-lg text-[length:var(--fs-10)] font-black uppercase tracking-widest border-none cursor-pointer transition-all ${
                cadence?.cadence === c
                  ? 'bg-[var(--accent)] text-[var(--text-inverse)]'
                  : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-[length:var(--fs-11)] font-bold text-[var(--error)] bg-[var(--error-bg)] border border-[var(--error)]/25 rounded-xl px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {/* Gallery for the selected pose */}
      {photos === null ? (
        <div className="py-10 text-center animate-pulse text-[var(--accent)] font-black uppercase tracking-widest text-[length:var(--fs-11)]">Loading photos…</div>
      ) : forPose.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">
          No {pose} photos yet — same pose, same lighting, roughly same distance gives the fairest comparisons.
        </p>
      ) : (
        <div className="grid grid-cols-2 min-[360px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
          {forPose.map((p) => (
            <button
              key={p.id}
              onClick={() => setViewing(p)}
              className="group text-left"
              title={`${p.pose}, ${p.captured_at}`}
            >
              <span className="relative block aspect-[3/4] rounded-2xl overflow-hidden border border-[var(--border-light)] bg-[var(--bg-hover)]">
                <img
                  src={photoUrl(p.id)}
                  alt={`Progress photo (${p.pose})`}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {analyzingId === p.id && (
                  <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="vitalis-spinner" />
                  </span>
                )}
                <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                  <span className="block text-[length:var(--fs-8)] font-black text-white/90 uppercase tracking-widest">
                    {new Date(p.captured_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </span>
                {p.ai_rating != null && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/50 text-[length:var(--fs-8)] font-black text-[var(--accent)]">
                    ★ {p.ai_rating}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Gemini latest-vs-previous comparison for this pose */}
      {forPose.length >= 2 && (
        <Button
          onClick={runCompare}
          disabled={compare.busy}
          loading={compare.busy}
          variant="secondary"
          icon="compare"
          className="w-full min-w-0 !py-3 !text-[length:var(--fs-11)] !font-black !uppercase !tracking-widest"
        >
          <span className="sm:hidden">Compare latest two</span>
          <span className="hidden sm:inline">Compare latest two {pose} photos</span>
        </Button>
      )}
      {compare.open && (compare.busy || compare.result || compare.error) && (
        <div className="rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] p-3.5 space-y-1.5">
          <p className="flex items-center gap-1.5 text-[length:var(--fs-11)] font-black uppercase tracking-widest text-[var(--accent)]">
            <Icon name="auto_awesome" className="text-[length:var(--fs-13)]" /> Gemini comparison
          </p>
          {compare.busy ? (
            <p className="text-sm text-[var(--text-muted)] animate-pulse">Reviewing both photos…</p>
          ) : compare.error ? (
            <p className="text-[length:var(--fs-12)] font-bold text-[var(--error)]" role="alert">{compare.error}</p>
          ) : (
            <>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{compare.result?.summary}</p>
              <p className="text-[length:var(--fs-10)] text-[var(--text-muted)]">
                Confidence: <span className="font-bold uppercase">{compare.result?.confidence}</span> — visual estimate, not a measurement.
              </p>
            </>
          )}
          <button onClick={() => setCompare({ open: false, busy: false, result: null, error: '' })} className="text-[length:var(--fs-10)] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Hide
          </button>
        </div>
      )}

      {/* Photo detail */}
      {viewing && (
        <Modal
          isOpen
          onClose={() => setViewing(null)}
          title={`${POSE_EMOJI[viewing.pose]} ${viewing.pose} photo`}
          subtitle={new Date(viewing.captured_at).toLocaleString()}
          size="lg"
        >
          <div className="space-y-3">
            <img src={photoUrl(viewing.id)} alt={`Progress photo (${viewing.pose})`} className="w-full rounded-2xl border border-[var(--border-light)]" />
            <div className="rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[length:var(--fs-11)] font-black uppercase tracking-widest text-[var(--accent)] flex items-center gap-1.5">
                  <Icon name="auto_awesome" className="text-[length:var(--fs-13)]" /> Gemini review
                </p>
                <RatingStars rating={viewing.ai_rating} />
              </div>
              {viewing.ai_summary ? (
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">{viewing.ai_summary}</p>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">Not analyzed yet.</p>
              )}
              <p className="text-[length:var(--fs-10)] text-[var(--text-muted)]">Visual estimate — not a measurement, not medical advice.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => analyze(viewing)}
                loading={analyzingId === viewing.id}
                icon="auto_awesome"
                className="flex-1 !py-3 !text-[length:var(--fs-11)] !font-black !uppercase !tracking-widest"
              >
                {viewing.ai_summary ? 'Re-analyze' : 'Analyze'}
              </Button>
              <Button
                variant="danger"
                onClick={() => remove(viewing.id)}
                icon="delete"
                className="flex-1 !py-3 !text-[length:var(--fs-11)] !font-black !uppercase !tracking-widest"
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
