import Icon from "../../../../components/Icon.jsx";
export default function NeuralStatusCard() {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-[var(--accent-bg)] border border-[var(--accent-border)]">
      <span className="text-[length:var(--fs-10)] font-black text-[var(--accent)] uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
        <Icon name="psychology" className="text-sm" />
        How it works
      </span>
      <p className="text-[length:var(--fs-11)] text-[var(--text-secondary)] leading-relaxed">
        Tracks 33 pose landmarks on-device to count reps and estimate form.
        Voice cues announce milestones as you train.
      </p>
    </div>
  );
}