export default function CoachFeedbackOverlay({ aiFeedback, isAnalyzing, fullscreen = false }) {
  return (
    <div className={fullscreen
      // Fullscreen: below the top controls + scrim, full-width, above scrims
      ? "absolute top-16 left-3 right-3 z-40"
      : "absolute top-3 left-3 sm:top-6 sm:left-6 z-20 max-w-[calc(100%-6.5rem)] sm:max-w-[300px]"}>
      {/* Media overlay: fixed dark glass + fixed light text so it stays legible
          over the video feed in BOTH themes (theme text colors flip to dark in
          light mode and would vanish on a dark scrim). */}
      <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-[rgba(8,11,8,0.82)] backdrop-blur-xl p-3.5 sm:p-4 shadow-[var(--shadow-xl)]">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" />
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[length:var(--fs-15)] text-[var(--accent)]">
            {isAnalyzing ? 'graphic_eq' : 'smart_toy'}
          </span>
          <span className="text-[length:var(--fs-10)] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
            {isAnalyzing ? 'Analyzing…' : 'Coach Response'}
          </span>
        </div>
        <p className={`mt-1.5 font-semibold text-white leading-relaxed line-clamp-3 ${fullscreen ? 'text-[length:var(--fs-13)]' : 'text-[length:var(--fs-12)] sm:text-[length:var(--fs-13)]'}`}>
          {`"${aiFeedback}"`}
        </p>
      </div>
    </div>
  );
}