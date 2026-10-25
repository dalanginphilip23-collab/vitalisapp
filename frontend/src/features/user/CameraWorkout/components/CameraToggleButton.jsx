import Icon from "../../../../components/Icon.jsx";
export default function CameraToggleButton({ cameraOn, onToggle }) {
  return (
    <button
      onClick={onToggle}
      title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
      className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full font-black text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] uppercase tracking-widest transition-all active:scale-95 border touch-manipulation ${
        cameraOn
          ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-medium)] hover:bg-[var(--surface-hover)]'
          : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-light)]'
      }`}
    >
      <Icon name={cameraOn ? 'videocam' : 'videocam_off'} className="text-xs sm:text-sm" />
      <span className="hidden sm:inline">{cameraOn ? 'Cam On' : 'Cam Off'}</span>
    </button>
  );
}