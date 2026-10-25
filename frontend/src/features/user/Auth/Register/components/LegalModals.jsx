import Modal from '../../../../../components/ui/Modal.jsx';

const Section = ({ title, children }) => (
  <div className="mb-4">
    <h4 className="text-[12px] font-bold tracking-[0.08em] uppercase text-[var(--text-primary)] mb-1.5">{title}</h4>
    <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">{children}</p>
  </div>
);

const UpdatedStamp = () => (
  <p className="text-[11px] text-[var(--text-muted)] opacity-80 mb-4">Last updated: September 2026 • Vitalis Performance OS (capstone project)</p>
);

export function TermsOfUseModal({ isOpen, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Terms of Use"
      subtitle="Please read before creating an account"
      icon="description"
      size="lg"
      footer={
        <button
          onClick={onClose}
          className="w-full bg-[var(--accent)] text-[var(--text-inverse)] font-bold text-[11px] tracking-[0.25em] uppercase py-3 rounded-[10px] hover:brightness-110 transition-all"
        >
          I Understand
        </button>
      }
    >
      <UpdatedStamp />
      <Section title="1. What Vitalis is">
        Vitalis is a student capstone fitness app for manually logging training, nutrition, sleep, and recovery. AI
        coaching, macro estimates, and readiness scores are informational only — not medical advice, diagnosis, or treatment.
      </Section>
      <Section title="2. Your account">
        You must provide an accurate name and email, keep your password confidential, and be at least 13 years old
        (or the minimum age in your country). You are responsible for all activity under your account.
      </Section>
      <Section title="3. Acceptable use">
        Do not misuse the service: no unlawful content, no attempts to breach security, scrape, spam, or upload
        harmful material (including non-consensual photos). Camera-workout frames are processed on-device/in-session
        and are never shared publicly by Vitalis.
      </Section>
      <Section title="4. Health disclaimer">
        Consult a qualified professional before starting new exercise or nutrition programs. Stop and seek care if you
        feel pain, dizziness, or chest discomfort. Vitalis is not liable for injuries resulting from your training choices.
      </Section>
      <Section title="5. Availability & changes">
        As a capstone, features may change or go offline without notice. We may suspend accounts that violate these terms.
      </Section>
      <Section title="6. Liability limit">
        To the maximum extent permitted by law, Vitalis is provided &quot;as is&quot; without warranties, and liability is
        limited to the amount you paid for the service (PHP 0 for this capstone).
      </Section>
      <Section title="7. Contact">
        Questions about these terms? Reach us through the in-app Feedback form (Dashboard → Feedback).
      </Section>
    </Modal>
  );
}

export function PrivacyPolicyModal({ isOpen, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Privacy Policy"
      subtitle="How your data is handled"
      icon="shield"
      size="lg"
      footer={
        <button
          onClick={onClose}
          className="w-full bg-[var(--accent)] text-[var(--text-inverse)] font-bold text-[11px] tracking-[0.25em] uppercase py-3 rounded-[10px] hover:brightness-110 transition-all"
        >
          I Understand
        </button>
      }
    >
      <UpdatedStamp />
      <Section title="1. Data we collect">
        Account data (name, email, password hash), profile data you enter (goals, body metrics), and content you log
        (workouts, meals, sleep, feedback). Technical data: session cookies, device/session metadata for security.
      </Section>
      <Section title="2. How we use it">
        To run your dashboard, plans, analytics, and AI features (meal analysis, coaching); to secure accounts
        (verification, password reset); and to improve the capstone. We never sell your personal data.
      </Section>
      <Section title="3. Camera & photos">
        Workout camera frames are used for live rep/pose feedback during your session. Meal photos you submit for
        analysis are sent to our AI providers solely to estimate nutrition. We do not use your images for advertising.
      </Section>
      <Section title="4. Sharing">
        Shared only with service providers needed to operate Vitalis (hosting/database, email delivery, AI APIs) under
        confidentiality obligations — and when required by law. No public sharing without your action (e.g., community posts you write).
      </Section>
      <Section title="5. Storage & security">
        Passwords are hashed (bcrypt), sessions use HttpOnly cookies, and traffic uses HTTPS. No system is 100% secure —
        use a unique password and log out on shared devices.
      </Section>
      <Section title="6. Your rights">
        You may view/update your profile, change your password, and request deletion via Profile / Feedback. Deletion
        removes your account data subject to legal/operational retention (e.g., backups, fraud prevention).
      </Section>
      <Section title="7. Contact">
        Privacy requests: use the in-app Feedback form and include the email you registered with.
      </Section>
    </Modal>
  );
}
