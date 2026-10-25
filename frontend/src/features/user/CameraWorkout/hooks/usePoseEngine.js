import { useEffect, useRef, useState } from 'react';

/** @typedef {{ Pose?: new (config: { locateFile?: (file: string) => string }) => any }} WindowWithPose */

// Pinned: mismatched pose.js/wasm versions break with Aborted(Assertion failed).
const POSE_VERSION = '0.5.1675469404';

function loadMediaPipe() {
  return new Promise((resolve, reject) => {
    if (/** @type {WindowWithPose} */ (window).Pose) { resolve(); return; }

    const scripts = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js',
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${POSE_VERSION}/pose.js`,
    ];

    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded === scripts.length) {
        setTimeout(() => {
          if (/** @type {WindowWithPose} */ (window).Pose) resolve();
          else reject(new Error('window.Pose not found after script load'));
        }, 300);
      }
    };

    scripts.forEach((src) => {
      if (document.querySelector(`script[src="${src}"]`)) { onLoad(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = onLoad;
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  });
}

/**
 * @param {{ cameraOn: boolean, webcamRef: { current?: { video?: HTMLVideoElement | null } | null }, onPoseResult: Function, workoutType: unknown }} params
 */
export function usePoseEngine({
  cameraOn,
  webcamRef,
  onPoseResult,
  workoutType,
}) {
  const [poseReady, setPoseReady]     = useState(false);
  const [loadError, setLoadError]     = useState(false);
  const poseRef         = useRef(null);
  const onPoseResultRef = useRef(onPoseResult);
  const workoutTypeRef  = useRef(workoutType);
  const noDetectRef     = useRef(0);

  useEffect(() => { onPoseResultRef.current = onPoseResult; }, [onPoseResult]);
  useEffect(() => { workoutTypeRef.current  = workoutType;  }, [workoutType]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        await loadMediaPipe();
        if (!active) return;

        const pose = new (/** @type {WindowWithPose} */ (window).Pose)({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${POSE_VERSION}/${file}`,
        });

        pose.setOptions({
          modelComplexity:        1,
          smoothLandmarks:        true,
          enableSegmentation:     false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence:  0.5,
        });

        pose.onResults((results) => {
          if (!active) return;

          if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
            noDetectRef.current += 1;
            onPoseResultRef.current(null, workoutTypeRef.current, noDetectRef.current);
            return;
          }

          noDetectRef.current = 0;
          onPoseResultRef.current(results.poseLandmarks, workoutTypeRef.current, 0);
        });

        await pose.initialize();

        poseRef.current = pose;
        if (active) setPoseReady(true);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[usePoseEngine] init failed:', err);
        if (active) setLoadError(true);
      }
    };

    init();

    return () => {
      active = false;
      try {
        const p = poseRef.current?.close?.();
        if (p?.catch) p.catch(() => {});
      } catch { /* unmount — best effort */ }
      poseRef.current = null;
      setPoseReady(false);
    };
  }, []);

  // Live skeleton during preview too; counting stays gated on isRecording.
  useEffect(() => {
    if (!cameraOn || !poseReady) return;

    const sendFrame = async () => {
      const video = webcamRef.current?.video;
      if (!poseRef.current || !video) return;
      if (video.readyState < 2 || video.paused || video.videoWidth === 0) return;
      try {
        await poseRef.current.send({ image: video });
      } catch {
        /* ignore single-frame errors */
      }
    };

    const id = setInterval(sendFrame, 100);
    return () => clearInterval(id);
  }, [cameraOn, poseReady, webcamRef]);

  return { poseReady, loadError };
}