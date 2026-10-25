export default function PoseStatusBadge({ poseReady, loadError }) {
  const label = loadError ? 'Load Failed' : poseReady ? 'Pose AI' : 'Loading…';
  const style = loadError
    ? 'bg-red-500/10 border-red-500/30 text-red-400'
    : poseReady
      ? 'bg-green-500/10 border-green-500/30 text-green-400'
      : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
  const dotStyle = loadError ? 'bg-red-400' : poseReady ? 'bg-green-400 animate-pulse' : 'bg-yellow-400';
  return (
    <div className="absolute top-3 right-14 z-20" title={label} aria-label={label}>
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[length:var(--fs-8)] font-black uppercase tracking-widest backdrop-blur-md ${style}`}>
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyle}`} />
        {/* Phones: dot only, so the coach card beside it keeps its text clear.
            From sm up there is room for the full status label. */}
        <span className="hidden sm:inline">{label}</span>
        <span className="sr-only sm:hidden">{label}</span>
      </div>
    </div>
  );
}