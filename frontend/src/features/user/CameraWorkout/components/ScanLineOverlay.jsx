export default function ScanLineOverlay({ isRecording, cameraOn }) {
  if (!isRecording || !cameraOn) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-10 border-2 border-[#D1FD52]/10 rounded-2xl">
      <div className="w-full h-[1px] bg-[#D1FD52]/40 absolute top-0 animate-[scan_3s_linear_infinite]" />
    </div>
  );
}