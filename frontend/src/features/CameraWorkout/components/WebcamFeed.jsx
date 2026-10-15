import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import Icon from "../../../components/Icon.jsx";
import { safeGet, safeSet } from "../../../lib/storage.js";
import ScanLineOverlay from "./ScanLineOverlay.jsx";
import CameraOffPlaceholder from "./CameraOffPlaceholder.jsx";
import Webcam from "react-webcam";
import CoachFeedbackOverlay from "./CoachFeedbackOverlay.jsx";
import RepCounterOverlay from "./RepCounterOverlay.jsx";
import PoseStatusBadge from "./PoseStatusBadge.jsx";
import PoseSkeletonOverlay from "./PoseSkeletonOverlay.jsx";

const mobileConstraints  = { facingMode: 'user', width: { ideal: 720 },  height: { ideal: 960 } };
const desktopConstraints = { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } };

// Viewport tracking: narrow screens get the portrait camera profile.
// Fullscreen stays in whatever orientation the user holds — no forced
// rotation, portrait camera fills a portrait screen via object-cover.
function useViewport() {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : true
  );
  useEffect(() => {
    const update = () => setIsNarrow(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return isNarrow;
}

export default function WebcamFeed({
  webcamRef,
  cameraOn,
  isRecording,
  paused = false,
  poseReady,
  loadError,
  aiFeedback,
  isAnalyzing,
  repCount,
  onCameraToggle,
  landmarksRef,
  elapsedLabel,
  onStartStop,
  onPauseToggle,
  tracking = false,
  hideRepCount = false,
}) {
  const isNarrow = useViewport();
  // fsMode: 'api' = Fullscreen API, 'css' = fixed-position fallback for
  // browsers without element fullscreen (iPhone Safari). null = windowed.
  const [fsMode, setFsMode] = useState(null);
  const isFullscreen = fsMode !== null;
  const [streamLive, setStreamLive] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [facing, setFacing] = useState(() => safeGet('vitalis_facing', 'user') || 'user');
  const containerRef = useRef(null);

  // getUserMedia is missing on HTTP origins and camera-less devices — without
  // this guard the UI hangs on "Starting camera…" forever with no recovery.
  const cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  // Stable constraints: memoized so the stream only renegotiates when the
  // profile or lens actually changes (never on fullscreen toggle).
  const videoConstraints = useMemo(() => ({
    ...(isNarrow ? mobileConstraints : desktopConstraints),
    facingMode: facing,
  }), [isNarrow, facing]);

  const flipCamera = useCallback(() => {
    setFacing((f) => {
      const next = f === 'user' ? 'environment' : 'user';
      safeSet('vitalis_facing', next);
      return next;
    });
    setStreamLive(false);
    setStreamError('');
  }, []);

  const describeStreamError = (err) => {
    switch (err?.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Camera blocked — allow camera access in your browser, then tap Retry.';
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'No camera found on this device.';
      case 'NotReadableError':
        return 'Camera is in use by another app — close it and tap Retry.';
      default:
        return 'Could not start the camera. Check connection or tap Retry.';
    }
  };

  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        setFsMode('api');
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
        setFsMode('api');
      } else {
        // No element fullscreen (iPhone Safari): pin the feed with CSS.
        setFsMode('css');
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn('Fullscreen failed:', err);
      // API request failed after all: fall back to CSS pinning so the
      // button never leaves a broken giant in-flow box.
      setFsMode('css');
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    try {
      if (fsMode === 'api') {
        if (document.exitFullscreen)            document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    } catch { void 0; /* fullscreen exit unsupported — safe to ignore */ }
    setFsMode(null);
  }, [fsMode]);

  useEffect(() => {
    if (fsMode === 'css') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [fsMode]);

  const toggleFullscreen = useCallback(() => {
    isFullscreen ? exitFullscreen() : enterFullscreen();
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  const handleTurnOn = useCallback(() => {
    setStreamLive(false);
    setStreamError('');
    onCameraToggle?.();
  }, [onCameraToggle]);

  const handleRetry = useCallback(() => {
    setStreamLive(false);
    setStreamError('');
    onCameraToggle?.();
    setTimeout(() => onCameraToggle?.(), 300);
  }, [onCameraToggle]);

  const feedLive = cameraOn && streamLive && !streamError;

  useEffect(() => {
    const onFSChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (!fsEl) {
        // System-gesture exit only applies to API mode; CSS mode exits
        // exclusively through our own Back button.
        setFsMode((m) => (m === 'api' ? null : m));
      }
    };
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
    };
  }, []);

  // Collapsed banner (no live feed, not fullscreen): slim status card instead
  // of a tall dead camera box. Feed overlays (coach card, rep counter,
  // status badge, veils, fullscreen toggle) are gated behind !collapsed
  // below — they are absolutely positioned for the live feed and would
  // otherwise clip/overlap inside this slim banner (overflow-hidden).
  // Coach feedback is re-rendered in-flow so the message is never lost.
  const collapsed = !isFullscreen && !feedLive;
  const off = !cameraOn;

  // Front camera behaves like a mirror (selfie preview); the rear camera does
  // not. The skeleton overlay mirrors its X mapping with the same flag so
  // dots sit on the body instead of flipped left-right.
  const mirrored = facing === 'user';

  const webcamEl = cameraOn && cameraSupported && (
    <Webcam
      audio={false}
      ref={webcamRef}
      mirrored={mirrored}
      playsInline
      screenshotFormat="image/jpeg"
      videoConstraints={videoConstraints}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', backgroundColor: '#000' }}
      className={collapsed
        ? 'absolute bottom-0 right-0 w-px h-px opacity-0 pointer-events-none'
        : 'absolute inset-0 w-full h-full object-cover grayscale-[0.2]'}
      onUserMedia={() => { setStreamLive(true); setStreamError(''); }}
      onUserMediaError={(err) => {
        setStreamLive(false);
        setStreamError(describeStreamError(err));
      }}
    />
  );

  // Single root (never unmounted): only the chrome switches between the
  // slim banner and the full feed, so the camera stream and pose engine
  // survive the collapsed → live transition without reconnecting.
  return (
    <div
      ref={containerRef}
      className={collapsed
        ? 'col-span-1 lg:col-span-8 relative overflow-hidden bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl px-4 py-3'
        : [
            'col-span-1 lg:col-span-8 relative bg-black overflow-hidden',
            'border border-[var(--border-light)] shadow-[var(--shadow-lg)]',
            fsMode === 'api'
              ? 'rounded-none w-screen h-screen'
              : fsMode === 'css'
                ? 'fixed inset-0 z-[200] rounded-none'
                : 'rounded-2xl aspect-[3/4] sm:aspect-[4/5] md:aspect-video w-full',
          ].join(' ')}
    >
      {collapsed ? (
        <div className="w-full flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-[var(--bg-hover)] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px] text-[var(--text-muted)]">
                {off ? 'videocam_off' : 'videocam'}
              </span>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[var(--text-primary)]">
                {!cameraSupported ? 'Camera not supported' : off ? 'Camera off' : 'Camera unavailable'}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                {!cameraSupported
                  ? 'This browser or connection blocks camera access — use HTTPS on a device with a camera.'
                  : off ? 'Turn it on for live rep counting' : (streamError || 'Starting camera… allow access when asked.')}
              </p>
            </div>
            {cameraSupported && (
              <button
                onClick={off ? handleTurnOn : handleRetry}
                className="shrink-0 px-4 py-2 min-h-[40px] rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[12px] font-bold active:scale-95 transition-transform"
              >
                {off ? 'Turn on' : 'Retry'}
              </button>
            )}
          </div>
          {aiFeedback ? (
            <div className="border-t border-[var(--border-light)] pt-2.5 mt-1">
              <span className="text-[8px] font-black text-[var(--accent)] uppercase tracking-[0.2em] block mb-1.5">
                {isAnalyzing ? 'Analyzing…' : 'Coach'}
              </span>
              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed break-words bg-[var(--accent-bg)] border border-[var(--accent-border)] rounded-xl px-3 py-2.5">
                {aiFeedback}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <ScanLineOverlay isRecording={isRecording} cameraOn={cameraOn} />
          <CameraOffPlaceholder cameraOn={cameraOn} onTurnOn={() => { setStreamLive(false); setStreamError(''); onCameraToggle?.(); }} />
        </>
      )}

      {webcamEl}

      {/* Skeleton tracker over the live feed */}
      {!collapsed && <PoseSkeletonOverlay landmarksRef={landmarksRef} webcamRef={webcamRef} mirrored={mirrored} />}

      {/* Framing guide: shown until shoulders/hips lock so users stop
          training face-only close-ups. Compact in fullscreen (record
          cluster owns the bottom). */}
      {!collapsed && feedLive && !tracking && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2 px-6 pointer-events-none text-center">
          <span className="w-16 h-16 rounded-full bg-black/55 border border-white/25 backdrop-blur-sm flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-white">accessibility_new</span>
          </span>
          <p className="text-[13px] font-bold text-white drop-shadow">Step back — show head to hips</p>
          <p className="text-[11px] text-white/70">Full body in frame to start tracking</p>
        </div>
      )}

      {/* Fullscreen cinematic scrims (reference style) */}
      {isFullscreen && (
        <>
          <div className="absolute top-0 left-0 right-0 h-24 z-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-44 z-20 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-[12px] font-bold tabular-nums text-white">
            {elapsedLabel || '0:00'}
          </div>
          {/* Bottom record cluster — fullscreen owns Start/Stop (page header
              is outside the fullscreen element) */}
          <div className="absolute bottom-6 left-0 right-0 z-40 flex flex-col items-center gap-2">
            <button
              onClick={onStartStop}
              aria-label={isRecording ? 'Stop workout' : 'Start workout'}
              className={`w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-transform border-4 ${
                isRecording
                  ? 'bg-white/20 border-white'
                  : 'bg-[#e63030] border-white/80 shadow-[var(--shadow-md)]'
              }`}
            >
              {isRecording
                ? <span className="w-6 h-6 rounded-[6px] bg-white" />
                : <span className="w-5 h-5 rounded-full bg-white" />}
            </button>
            <span className="text-[13px] font-bold tabular-nums text-white drop-shadow">
              {elapsedLabel || '0:00'}
            </span>
          </div>
        </>
      )}

      {cameraOn && !streamLive && !collapsed && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 p-6 text-center bg-black">
          <span className="material-symbols-outlined text-[36px] text-[var(--accent)] animate-pulse">videocam</span>
          <p className="text-[13px] font-bold text-white">
            {streamError || 'Starting camera… allow access when asked.'}
          </p>
          {streamError && (
            <button onClick={handleRetry}
              className="px-4 py-2 rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[12px] font-bold">
              Retry camera
            </button>
          )}
        </div>
      )}

      {/* In-feed control bar (windowed mode): pause + Start/End + timer,
          overlaid on the feed bottom so page scroll / BottomNav can never
          cover it. Fullscreen keeps its own record-cluster below. */}
      {!collapsed && !isFullscreen && (
        <>
          <div className="absolute bottom-0 left-0 right-0 h-28 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
          <div className="absolute bottom-3 inset-x-3 z-30 flex items-center gap-2.5">
            <button
              onClick={onPauseToggle}
              disabled={!isRecording}
              aria-label={paused ? 'Resume workout' : 'Pause workout'}
              title={paused ? 'Resume' : 'Pause'}
              className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-white/15 border border-white/30 backdrop-blur-md flex items-center justify-center shrink-0 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[24px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                {paused ? 'play_arrow' : 'pause'}
              </span>
            </button>
            <button
              onClick={onStartStop}
              disabled={!cameraOn}
              aria-label={isRecording ? 'End workout' : 'Start workout'}
              title={!cameraOn ? 'Turn the camera on to start' : undefined}
              className={`flex-1 min-w-0 h-12 rounded-2xl font-extrabold text-[13px] uppercase tracking-[0.12em] flex items-center justify-center gap-2 active:scale-[0.98] transition-all touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed ${
                isRecording
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] shadow-lg'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isRecording ? 'stop' : 'play_arrow'}
              </span>
              <span className="truncate">{isRecording ? 'End Workout' : 'Start Workout'}</span>
            </button>
            <span className="shrink-0 px-2.5 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-[12px] font-bold tabular-nums text-white">
              {elapsedLabel || '0:00'}
            </span>
          </div>
        </>
      )}

      {loadError && !collapsed && (
        <div className={`absolute left-3 z-30 bg-[var(--error-bg)] border border-[var(--error)]/30 px-3 py-1.5 rounded-xl ${isFullscreen ? 'bottom-3' : 'bottom-20'}`}>
          <p className="text-[9px] text-[var(--error)] font-bold uppercase tracking-widest">
            Pose AI failed to load — check your connection
          </p>
        </div>
      )}

      {/* Live-feed overlays only — hidden in the collapsed banner (see above)
          where they would clip/overlap inside the slim overflow-hidden box. */}
      {!collapsed && <CoachFeedbackOverlay aiFeedback={aiFeedback} isAnalyzing={isAnalyzing} fullscreen={isFullscreen} />}
      {!collapsed && !hideRepCount && <RepCounterOverlay repCount={repCount} />}
      {!collapsed && <PoseStatusBadge poseReady={poseReady} loadError={loadError} />}

      {/* Fullscreen toggle — live feed only */}
      {!collapsed && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 z-40 flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-medium)] backdrop-blur-sm active:scale-95 transition-transform touch-manipulation"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          <Icon
            name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            className="text-[var(--text-primary)] text-xl leading-none"
          />
        </button>
      )}

      {/* Front/back lens switch — tablets and phones without a usable
          front camera can still train with the rear lens. */}
      {cameraOn && streamLive && (
        <button
          onClick={flipCamera}
          aria-label={facing === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
          className="absolute top-14 right-3 z-40 flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-medium)] backdrop-blur-sm active:scale-95 transition-transform touch-manipulation"
        >
          <Icon name="flip_camera_ios" className="text-[var(--text-primary)] text-xl leading-none" />
        </button>
      )}

      {/* Back / exit-fullscreen — visible only in fullscreen */}
      {isFullscreen && (
        <button
          onClick={exitFullscreen}
          aria-label="Exit fullscreen"
          className="absolute top-3 left-3 z-40 flex items-center gap-1.5 h-9 pl-2.5 pr-3.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-medium)] backdrop-blur-sm text-[12px] font-bold text-[var(--text-primary)] active:scale-95 transition-transform touch-manipulation"
        >
          <Icon name="arrow_back" className="text-[18px] leading-none" />
          Back
        </button>
      )}

    </div>
  );
}