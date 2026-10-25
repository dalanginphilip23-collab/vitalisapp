import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

// Camera helper:
//  · centres on the first valid fix exactly once (never a hardcoded spot),
//  · follows the user while recording *and* following is on,
//  · pauses following when the user pans, so the map never fights them.
const RecenterMap = ({ lastPoint, isRecording, follow, onUserInteract }) => {
  const map = useMap();
  const centeredRef = useRef(false);

  // One-time recenter on the first real fix.
  useEffect(() => {
    if (lastPoint && !centeredRef.current) {
      centeredRef.current = true;
      map.flyTo(lastPoint, 16, { animate: true, duration: 1.2 });
    }
  }, [lastPoint, map]);

  // Follow during an active run (unless the user took control).
  useEffect(() => {
    if (isRecording && follow && lastPoint) {
      map.panTo(lastPoint, { animate: true, duration: 0.6 });
    }
  }, [lastPoint, isRecording, follow, map]);

  // Manual drag = user wants to explore; stop auto-following.
  useEffect(() => {
    const onDrag = () => onUserInteract?.();
    map.on("dragstart", onDrag);
    return () => {
      map.off("dragstart", onDrag);
    };
  }, [map, onUserInteract]);

  return null;
};

export default RecenterMap;
