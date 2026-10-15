import { useState } from 'react';
import Icon from "../../../components/Icon.jsx";
export default function StartStopButton({ isRecording, cameraOn, onPress }) {
  const [busy, setBusy] = useState(false);
  const handlePress = async (e) => {
    if (busy || !cameraOn) return;
    setBusy(true);
    try {
      await onPress?.(e);
    } finally {
      setBusy(false);
    }
  };
  const disabled = !cameraOn || busy;
  return (
    <button
      onClick={handlePress}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-label={isRecording ? 'End workout' : 'Start workout'}
      title={!cameraOn ? 'Turn the camera on to start' : undefined}
      className={`w-full min-h-[56px] px-6 py-4 rounded-2xl font-extrabold text-[14px] uppercase tracking-[0.12em] transition-all active:scale-[0.98] flex items-center justify-center gap-2 touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed ${
        isRecording
          ? 'bg-red-500 text-white shadow-[var(--shadow-md)]'
          : 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] shadow-[var(--shadow-md)]'
      }`}
    >
      {busy ? (
        <span className="w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin inline-block" aria-hidden="true" />
      ) : (
        <Icon name={isRecording ? 'stop' : 'play_arrow'} className="text-[20px]" fill={1} />
      )}
      <span>{busy ? 'Please wait…' : isRecording ? 'End Workout' : 'Start Workout'}</span>
    </button>
  );
}