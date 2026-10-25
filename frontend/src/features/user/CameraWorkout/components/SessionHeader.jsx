import { useState } from "react";
import CameraToggleButton from "./CameraToggleButton.jsx";
import VoiceToggleButton from './VoiceToggleButton.jsx';
import Icon from "../../../../components/Icon.jsx";

// Session header (reference layout): back + two-line title
// (exercise + muscle · target), live pill while recording, overflow menu
// holding the voice/camera toggles. START lives in the bottom bar.
// Minimal variant unchanged: toggles only, used on the chooser screen.
export default function SessionHeader({
  workoutLabel, workoutSub, isRecording, paused,
  cameraOn, voiceEnabled, onCameraToggle, onVoiceToggle, onBack,
  onChangeExercise, onLogManual, minimal = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (minimal) {
    return (
      <header className="sticky top-[var(--app-topbar)] z-40 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-b border-[var(--border-light)] min-h-[56px] md:h-16 flex items-center justify-end px-3 sm:px-6 gap-2 py-2">
        <VoiceToggleButton voiceEnabled={voiceEnabled} onToggle={onVoiceToggle} />
        <CameraToggleButton cameraOn={cameraOn} onToggle={onCameraToggle} />
      </header>
    );
  }

  const closeAnd = (fn) => () => { setMenuOpen(false); fn?.(); };

  return (
    <header className="sticky top-[var(--app-topbar)] z-40 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-b border-[var(--border-light)] min-h-[60px] flex items-center justify-between px-3 sm:px-6 gap-2 sm:gap-3 py-2">
      <div className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="w-10 h-10 min-w-[40px] rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] flex items-center justify-center shrink-0 transition-colors"
          >
            <Icon name="arrow_back" className="text-[length:var(--fs-20)] text-[var(--text-primary)]" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[length:var(--fs-16)] font-extrabold tracking-tight leading-tight text-[var(--text-primary)] truncate"
            style={{ fontFamily: 'var(--font-display)' }}>
            {workoutLabel || 'Select exercise'}
          </h1>
          {workoutSub && (
            <p className="text-[length:var(--fs-11)] sm:text-[length:var(--fs-12)] leading-snug text-[var(--text-muted)] truncate mt-0.5">
              {workoutSub}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {(isRecording || paused) && (
          <span
            title={paused ? 'Paused' : 'Tracking active'}
            aria-label={paused ? 'Paused' : 'Tracking active'}
            className="inline-flex items-center gap-1.5 px-2.5 min-[440px]:px-3 py-1.5 rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] text-[var(--accent)] text-[length:var(--fs-10)] font-bold uppercase tracking-widest"
          >
            <span className={`w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 ${paused ? '' : 'animate-pulse'}`} />
            <span className="hidden min-[440px]:inline">{paused ? 'Paused' : 'Tracking Active'}</span>
          </span>
        )}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Session options"
            aria-expanded={menuOpen}
            className="w-10 h-10 rounded-full hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors"
          >
            <Icon name="more_vert" className="text-[length:var(--fs-20)] text-[var(--text-primary)]" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 rounded-2xl border border-[var(--border-medium)] bg-[var(--bg-primary)] shadow-[var(--shadow-lg)] overflow-hidden">
                {onChangeExercise && (
                  <button onClick={closeAnd(onChangeExercise)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[length:var(--fs-13)] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-left">
                    <Icon name="swap_vert" className="text-[length:var(--fs-18)] text-[var(--text-muted)]" />
                    Change exercise
                  </button>
                )}
                {onLogManual && (
                  <button onClick={closeAnd(onLogManual)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-[length:var(--fs-13)] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-left ${onChangeExercise ? 'border-t border-[var(--border-light)]' : ''}`}>
                    <Icon name="edit_note" className="text-[length:var(--fs-18)] text-[var(--text-muted)]" />
                    Log manually
                  </button>
                )}
                <button onClick={closeAnd(onVoiceToggle)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[length:var(--fs-13)] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-left border-t border-[var(--border-light)]">
                  <Icon name={voiceEnabled ? 'volume_up' : 'volume_off'} className="text-[length:var(--fs-18)] text-[var(--text-muted)]" />
                  Voice cues
                  <span className="ml-auto text-[length:var(--fs-11)] font-bold text-[var(--text-muted)]">{voiceEnabled ? 'On' : 'Off'}</span>
                </button>
                <button onClick={closeAnd(onCameraToggle)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[length:var(--fs-13)] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-left border-t border-[var(--border-light)]">
                  <Icon name={cameraOn ? 'videocam' : 'videocam_off'} className="text-[length:var(--fs-18)] text-[var(--text-muted)]" />
                  Camera
                  <span className="ml-auto text-[length:var(--fs-11)] font-bold text-[var(--text-muted)]">{cameraOn ? 'On' : 'Off'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
