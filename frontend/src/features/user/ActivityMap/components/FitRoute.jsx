import { useEffect } from "react";
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const FitRoute = ({ path }) => {
  const map = useMap();
  useEffect(() => {
    if (path.length > 1) {
      map.fitBounds(L.latLngBounds(path), { padding: [60, 60], animate: true, duration: 1.2 });
    }
  }, [path, map]);
  return null;
};

export default FitRoute;