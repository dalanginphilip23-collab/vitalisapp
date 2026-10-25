import Icon from "../../../../components/Icon.jsx";

// Correction banner pinned to the video bottom: shows the latest coach cue
// while recording. Dark card like the reference — readable over video in
// both themes. Hidden when there is nothing fresh to say.
export default function CorrectionBanner({ text, warn = false, onOpen }) {
  if (!text) return null;
  return (
    <button
      onClick={onOpen}
      className="absolute left-3 right-3 bottom-3 z-30 flex items-center gap-3 rounded-2xl px-4 py-3 text-left bg-[#101410]/90 backdrop-blur-sm border border-white/10 active:scale-[0.99] transition-transform"
    >
      <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        warn ? 'bg-amber-400 text-black' : 'bg-[var(--accent)] text-[var(--text-inverse)]'
      }`}>
        <Icon name={warn ? 'priority_high' : 'record_voice_over'} className="text-[length:var(--fs-18)]" />
      </span>
      <span className="flex-1 min-w-0 text-[length:var(--fs-14)] font-semibold text-white truncate">
        {text}
      </span>
      <Icon name="chevron_right" className="text-[length:var(--fs-20)] text-white/60 shrink-0" />
    </button>
  );
}
