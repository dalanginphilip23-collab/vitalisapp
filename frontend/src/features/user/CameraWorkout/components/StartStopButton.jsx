import { useState } from 'react';
import Icon from "../../../../components/Icon.jsx";
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
      className={`flex-shrink-0 px-4 sm:px-8 py-2 rounded-full font-black text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2 touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed ${
        isRecording
          ? 'bg-red-500 text-white shadow-[var(--shadow-md)]'
          : 'bg-[var(--accent)] text-[var(--text-inverse)] shadow-[var(--shadow-md)]'
      }`}
    >
      {busy ? (
        <span className="w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin inline-block" aria-hidden="true" />
      ) : (
        <Icon name={isRecording ? 'stop' : 'play_arrow'} className="text-xs sm:text-sm" fill={1} />
      )}
      <span className="hidden sm:inline">{busy ? 'Please wait…' : isRecording ? 'End Workout' : 'Start Workout'}</span>
      <span className="sm:hidden">{busy ? '…' : isRecording ? 'End' : 'Start'}</span>
    </button>
  );
}