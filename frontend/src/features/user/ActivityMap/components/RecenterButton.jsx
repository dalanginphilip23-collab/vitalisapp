import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import Icon from '../../../../components/Icon.jsx';

// Explicit "back to me": auto-follow pauses once the user pans the map, so
// this is the reliable way to snap the camera back to the current GPS fix.
const RecenterButton = ({ userLocation, onRecenter }) => {
  const map = useMap();
  const btnRef = useRef(null);
  const disabled = !userLocation;

  // Keep button clicks from starting a map drag (canonical Leaflet pattern).
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return undefined;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    return () => {
      L.DomEvent.off(el);
    };
  }, []);

  const handleClick = () => {
    if (!userLocation) return;
    map.flyTo(userLocation, Math.max(map.getZoom(), 16), {
      animate: true,
      duration: 0.8,
    });
    onRecenter?.();
  };

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label="Recenter to my location"
      title="Recenter to my location"
      className="am-map-btn absolute top-3 right-3 z-[1000] sm:top-4 sm:right-4"
    >
      <Icon name="my_location" className="text-[19px]" />
    </button>
  );
};

export default RecenterButton;
