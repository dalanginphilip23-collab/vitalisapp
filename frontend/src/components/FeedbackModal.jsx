import { useState } from 'react';
import Modal from './ui/Modal.jsx';
import Input from './ui/Input.jsx';
import Button from './ui/Button.jsx';
import { apiPost } from '../lib/apiClient.js';

export default function FeedbackModal({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const setField = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (error) setError('');
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MAX_MSG = 2000;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('All fields are required.');
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
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
      await apiPost('/api/feedback', { name: form.name.trim(), email: form.email.trim(), message: form.message.trim().slice(0, MAX_MSG) }, { skipAuthRedirect: true });
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
          <div className="w-[72px] h-[72px] rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center animate-[pulse_1.8s_ease_infinite]">
            <svg width="48" height="48" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="25" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="166" strokeDashoffset="0" />
              <polyline points="14,27 22,35 38,18" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-[length:var(--fs-18)] font-extrabold text-[var(--text-primary)] tracking-tight">Feedback Received</p>
            <p className="text-[length:var(--fs-12)] text-[var(--text-muted)] leading-relaxed mt-2 max-w-[260px]">Thanks for helping us improve Vitalis. We'll review your message shortly.</p>
          </div>
          <Button type="button" variant="primary" size="lg" fullWidth onClick={onClose}>Close</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-[var(--error-bg)] border border-[var(--error)]/30 rounded-xl px-3 py-2.5 text-[length:var(--fs-11)] font-semibold text-[var(--error)]">
              {error}
            </div>
          )}
          <Input label="Name" placeholder="Your name" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
          <Input label="Email" type="email" placeholder="athlete@vitalis.io" value={form.email} onChange={(e) => setField('email', e.target.value)} required />
          <div className="flex flex-col gap-1.5">
            <label className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Message <span className="text-[var(--error)]">*</span></label>
            <textarea
              placeholder="Tell us what you think, what's broken, or what you'd love to see..."
              value={form.message}
              onChange={(e) => setField('message', e.target.value)}
              rows={4}
              required
              maxLength={2000}
              className="w-full rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] p-3 text-[length:var(--fs-13)] text-[var(--text-primary)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:border-[var(--accent-border)] focus:ring-1 focus:ring-[var(--accent-border)] resize-none"
            />
            <p className="text-[length:var(--fs-10)] text-[var(--text-muted)] text-right">{form.message.length}/2000</p>
          </div>
          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} icon="send">
            {loading ? 'Sending…' : 'Send Feedback'}
          </Button>
          <p className="text-center text-[length:var(--fs-10)] text-[var(--text-muted)]">Your feedback is private and goes directly to our team.</p>
        </form>
      )}
    </Modal>
  );
}
