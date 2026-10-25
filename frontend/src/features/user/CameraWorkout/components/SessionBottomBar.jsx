import Icon from "../../../../components/Icon.jsx";
import StartStopButton from "./StartStopButton.jsx";

// Bottom action bar (reference layout): round pause/resume button +
// full-width primary CTA. Pause freezes timer + rep counting; the video
// and skeleton preview keep running.
export default function SessionBottomBar({
  isRecording, paused, cameraOn, onPauseToggle, onStartStop,
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onPauseToggle}
        disabled={!isRecording}
        aria-label={paused ? 'Resume workout' : 'Pause workout'}
        className="w-[52px] h-[52px] rounded-full border border-[var(--border-medium)] bg-[var(--bg-card)] flex items-center justify-center shrink-0 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Icon name={paused ? 'play_arrow' : 'pause'} className="text-[length:var(--fs-22)] text-[var(--text-primary)]" fill={1} />
      </button>
      <div className="flex-1 [&>button]:w-full [&>button]:px-4 [&>button]:py-3.5 [&>button]:text-[length:var(--fs-13)] [&>button]:rounded-2xl">
        <StartStopButton isRecording={isRecording} cameraOn={cameraOn} onPress={onStartStop} />
      </div>
    </div>
  );
}
