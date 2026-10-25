import { useEffect, useRef } from "react";

// Pose skeleton overlay — draws the reference-style tracker (yellow bones,
// green joints, red for low-confidence) on a canvas over the video.
// Reads the latest landmarks from a ref (no re-renders) at rAF pace and
// replicates object-cover math so dots sit on the body, not beside it.
//
// Accuracy rules (fixes face-cluster + stray bottom line):
// - Bones draw ONLY when both endpoints have visibility >= BONE_MIN_VIS.
//   Hallucinated shoulders/hips (out of frame, dark room) are skipped instead
//   of stretching a yellow line across the bottom edge.
// - Face landmarks 0-10 draw small/faded — the old code drew all 33 dots at
//   full size, so a head-only close-up looked like a bug cluster on the eye.
// - Dots below DOT_MIN_VIS are skipped entirely (not drawn red in a pile).
// - Front camera (`mirrored`) flips X in the same object-cover space as the
//   mirrored <video> preview, so the skeleton isn't left-right flipped.
const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31],
  [24, 26], [26, 28], [28, 30], [30, 32],
  [15, 17], [16, 18], [15, 21], [16, 22],
];

const BONE_COLOR = "#FACC15";
const JOINT_COLOR = "#22C55E";
const WEAK_COLOR = "#EF4444";

// Endpoints below this never form a bone — kills the stray bottom line when
// the torso is out of frame (close-up / dark room hallucinations).
const BONE_MIN_VIS = 0.55;
// Dots below this are not drawn at all; between this and 0.5 they draw red.
const DOT_MIN_VIS = 0.25;
// MediaPipe pose: 0-10 = face, 11-32 = torso + limbs.
const isFaceLandmark = (i) => i <= 10;

export default function PoseSkeletonOverlay({ landmarksRef, webcamRef, mirrored = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let raf = 0;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const parent = canvas.parentElement;
      const video = webcamRef?.current?.video;
      const lm = landmarksRef?.current;
      const cw = parent?.clientWidth || 0;
      const ch = parent?.clientHeight || 0;
      if (!cw || !ch) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      if (!lm || !video || !video.videoWidth) return;

      // Torso gate: shoulders (11,12) + hips (23,24) are the anchor of every
      // rep counter. When none of them is confident (face-only close-up, dark
      // room) the model hallucinates scattered joints — draw nothing instead
      // of a confusing dot cloud. The framing guide overlay handles the hint.
      const visOf = (p) => (typeof p?.visibility === "number" ? p.visibility : 1);
      const torsoVis = Math.max(visOf(lm[11]), visOf(lm[12]), visOf(lm[23]), visOf(lm[24]));
      if (torsoVis < 0.5) return;

      // object-cover mapping: full-frame landmarks -> visible crop.
      // Front camera preview is mirrored (scaleX(-1) on <video>) so flip X
      // here too — otherwise the skeleton is left-right reversed vs the body.
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.max(cw / vw, ch / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      const px = (p) => dx + (mirrored ? (1 - p.x) : p.x) * dw;
      const py = (p) => dy + p.y * dh;

      const dotR = Math.max(3, cw / 90);
      ctx.lineWidth = Math.max(2.5, cw / 110);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Bones: draw per-segment (not one batch path) so low-confidence limbs
      // can be skipped individually. A segment draws only if BOTH endpoints
      // clear BONE_MIN_VIS — this is what removes the stray yellow line at
      // the bottom when shoulders/hips are hallucinated out of frame.
      ctx.strokeStyle = BONE_COLOR;
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 4;
      for (const [a, b] of BONES) {
        const pa = lm[a];
        const pb = lm[b];
        if (!pa || !pb) continue;
        if (visOf(pa) < BONE_MIN_VIS || visOf(pb) < BONE_MIN_VIS) continue;
        ctx.beginPath();
        ctx.moveTo(px(pa), py(pa));
        ctx.lineTo(px(pb), py(pb));
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Joints: skip near-invisible points entirely; face points draw small
      // and faded so a head-only close-up no longer looks like a bug cluster.
      lm.forEach((p, i) => {
        if (!p) return;
        const vis = visOf(p);
        if (vis < DOT_MIN_VIS) return;
        const face = isFaceLandmark(i);
        const r = face ? dotR * 0.55 : dotR;
        ctx.beginPath();
        ctx.arc(px(p), py(p), r, 0, Math.PI * 2);
        ctx.globalAlpha = face ? 0.7 : 1;
        ctx.fillStyle = vis > 0.5 ? JOINT_COLOR : WEAK_COLOR;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (!face) {
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.stroke();
        }
      });
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [landmarksRef, webcamRef, mirrored]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-10 pointer-events-none"
      aria-hidden="true"
    />
  );
}
