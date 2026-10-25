export default function RepCounterOverlay({ repCount }) {
  return (
    <div className="absolute bottom-4 right-4 sm:bottom-10 sm:right-10 z-20">
      <div className="text-right">
        <span className="text-[length:var(--fs-8)] sm:text-[length:var(--fs-10)] font-bold text-white/70 uppercase tracking-[0.3em] block mb-0.5 sm:mb-1 drop-shadow">
          Total Reps
        </span>
        <span className="text-5xl sm:text-7xl md:text-8xl font-black text-white tracking-tighter leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
          {repCount.toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}