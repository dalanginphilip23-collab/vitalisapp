import { useEffect, useRef, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';

// Live "Scan a Meal" camera: viewfinder + corner frame + capture.
// Capture snapshots to canvas and hands a JPEG dataURL to the parent,
// which feeds the existing AI analyze pipeline.
export default function CameraScanner({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('UNSUPPORTED');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStarting(false);
      } catch (err) {
        if (cancelled) return;
        setStarting(false);
        if (err?.name === 'NotAllowedError') {
          setError('Camera blocked — allow camera access in your browser settings, then try again.');
        } else if (err?.message === 'UNSUPPORTED' || err?.name === 'NotFoundError') {
          setError('No camera found on this device. Use Gallery upload instead.');
        } else if (window.isSecureContext === false) {
          setError('Camera needs HTTPS or localhost. Open the app via https:// or use Gallery upload.');
        } else {
          setError('Could not start the camera. Use Gallery upload instead.');
        }
      }
    };
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;
    const MAX_W = 1024;
    const scale = video.videoWidth > MAX_W ? MAX_W / video.videoWidth : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture?.(canvas.toDataURL('image/jpeg', 0.85));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" role="dialog" aria-modal="true" aria-label="Scan a meal">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
        <button onClick={onClose} aria-label="Close camera" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
          <Icon name="close" className="text-[length:var(--fs-20)]" />
        </button>
        <p className="text-white text-[length:var(--fs-15)] font-semibold">Scan a Meal</p>
        <span className="w-10" />
      </div>

      {/* Viewfinder */}
      <div className="flex-1 relative min-h-0 bg-black overflow-hidden">
        {!error && (
          <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 w-full h-full object-cover" />
        )}
        {starting && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
            <span className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            <p className="text-xs font-semibold tracking-widest uppercase">Starting camera…</p>
          </div>
        )}
        {/* Scan frame */}
        {!error && !starting && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-[78%] aspect-[4/3]">
              {['top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'].map(c => (
                <span key={c} className={`absolute w-10 h-10 border-[var(--accent)] ${c}`} />
              ))}
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="material-symbols-outlined text-[length:var(--fs-40)] text-white/40">videocam_off</span>
            <p className="text-white/80 text-sm leading-relaxed">{error}</p>
          </div>
        )}
      </div>

      {/* Capture bar */}
      <div className="shrink-0 px-6 pt-4 text-center" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        {!error && !starting && (
          <>
            <p className="text-white/60 text-xs mb-4">Point at your meal, then tap to detect items with AI</p>
            <button
              onClick={capture}
              aria-label="Capture meal photo"
              className="mx-auto w-[72px] h-[72px] rounded-full bg-[var(--accent)] flex items-center justify-center ring-4 ring-[var(--accent)]/30 hover:brightness-110 active:scale-95 transition-all"
            >
              <Icon name="photo_camera" className="text-[length:var(--fs-28)] text-[var(--text-inverse)]" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
