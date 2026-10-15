import Icon from "../../../components/Icon.jsx";
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
        title={paused ? 'Resume' : 'Pause'}
        className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full border border-[var(--border-medium)] bg-[var(--bg-card)] flex items-center justify-center shrink-0 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        <Icon name={paused ? 'play_arrow' : 'pause'} className="text-[24px] text-[var(--text-primary)]" fill={1} />
      </button>
      <div className="flex-1 min-w-0">
        <StartStopButton isRecording={isRecording} cameraOn={cameraOn} onPress={onStartStop} />
      </div>
    </div>
  );
}
