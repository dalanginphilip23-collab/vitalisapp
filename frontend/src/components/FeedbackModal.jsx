import { useState } from 'react';
import Modal from './ui/Modal.jsx';
import Input from './ui/Input.jsx';
import Button from './ui/Button.jsx';
import { apiPost } from '../lib/apiClient.js';
import { useAuth } from '../hooks/useAuth.jsx';

const RATING_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Great', 5: 'Excellent' };

export default function FeedbackModal({ onClose }) {
  // Identity comes from the logged-in session — the user only rates + writes.
  // Manual inputs reappear only when the session has no identity (stale cache).
  const { user } = useAuth();
  const sessionName = user?.name?.trim() || '';
  const sessionEmail = user?.email?.trim() || '';
  const hasIdentity = Boolean(sessionName && sessionEmail);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const setField = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (error) setError('');
  };

  const pickRating = (v) => {
    setRating(v);
    if (error) setError('');
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MAX_MSG = 2000;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Please tap a star rating.');
      return;
    }
    const name = hasIdentity ? sessionName : form.name.trim();
    const email = hasIdentity ? sessionEmail : form.email.trim();
    if (!name || !email || !form.message.trim()) {
      setError('All fields are required.');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (form.message.trim().length > MAX_MSG) {
      setError(`Message must be under ${MAX_MSG} characters.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiPost('/api/feedback', { name, email, message: form.message.trim().slice(0, MAX_MSG), rating }, { skipAuthRedirect: true });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={submitted ? undefined : 'Send Feedback'}
      subtitle={submitted ? undefined : 'Help us make Vitalis better'}
      icon={submitted ? undefined : 'chat_bubble'}
      size="md"
    >
      {submitted ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="w-[72px] h-[72px] rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="25" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="166" strokeDashoffset="0" />
              <polyline points="14,27 22,35 38,18" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-[18px] font-extrabold text-[var(--text-primary)] tracking-tight">Feedback Received</p>
            <p className="text-[14px] mt-2 tracking-tight" aria-label={`You rated ${rating} out of 5 stars`}>
              {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
            </p>
            <p className="text-[12px] text-[var(--text-muted)] leading-relaxed mt-2 max-w-[260px]">Thanks for helping us improve Vitalis. We'll review your message shortly.</p>
          </div>
          <Button type="button" variant="primary" size="lg" fullWidth onClick={onClose}>Close</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-[var(--error-bg)] border border-[var(--error)]/30 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-[var(--error)]">
              {error}
            </div>
          )}
          {hasIdentity ? (
            <p className="rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 py-2.5 text-[12px] text-[var(--text-muted)]">
              Sending as <span className="font-bold text-[var(--text-primary)]">{sessionName}</span> · {sessionEmail}
            </p>
          ) : (
            <>
              <Input label="Name" placeholder="Your name" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
              <Input label="Email" type="email" placeholder="athlete@vitalis.io" value={form.email} onChange={(e) => setField('email', e.target.value)} required />
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]" id="feedback-rating-label">
              Rating <span className="text-red-400">*</span>
            </span>
            <div
              role="radiogroup"
              aria-labelledby="feedback-rating-label"
              className="flex items-center gap-1"
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1, 2, 3, 4, 5].map((v) => {
                const lit = v <= (hoverRating || rating);
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={rating === v}
                    aria-label={`${v} star — ${RATING_LABELS[v]}`}
                    title={RATING_LABELS[v]}
                    onClick={() => pickRating(v)}
                    onMouseEnter={() => setHoverRating(v)}
                    onFocus={() => setHoverRating(v)}
                    onBlur={() => setHoverRating(0)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' && rating < 5) { e.preventDefault(); pickRating(rating + 1); }
                      if (e.key === 'ArrowLeft' && rating > 1) { e.preventDefault(); pickRating(rating - 1); }
                    }}
                    className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center transition-transform active:scale-90 hover:bg-[var(--bg-hover)]"
                  >
                    <span className={`material-symbols-outlined text-[32px] leading-none ${lit ? 'text-[var(--accent)]' : 'text-[var(--text-disabled)]'}`}
                      style={lit ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                      star
                    </span>
                  </button>
                );
              })}
              <span className="text-[11px] font-bold text-[var(--text-muted)] ml-1 min-w-[52px]" aria-live="polite">
                {(hoverRating || rating) > 0 ? RATING_LABELS[hoverRating || rating] : ''}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Message <span className="text-red-400">*</span></label>
            <textarea
              placeholder="Tell us what you think, what's broken, or what you'd love to see..."
              value={form.message}
              onChange={(e) => setField('message', e.target.value)}
              rows={4}
              required
              maxLength={2000}
              className="w-full rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] p-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:border-[var(--accent-border)] focus:ring-1 focus:ring-[var(--accent-border)] resize-none"
            />
            <p className="text-[10px] text-[var(--text-muted)] text-right">{form.message.length}/2000</p>
          </div>
          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} icon="send">
            {loading ? 'Sending…' : 'Send Feedback'}
          </Button>
          <p className="text-center text-[10px] text-[var(--text-muted)]">Your feedback is private and goes directly to our team.</p>
        </form>
      )}
    </Modal>
  );
}
