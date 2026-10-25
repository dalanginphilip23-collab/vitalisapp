import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

// Leaflet renders blank / grey tiles when its container is resized without
// being told. Watch the container (and window) so the map always repaints at
// the right size — covers initial lazy mount, sidebar expand and rotation.
const MapResizer = () => {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const invalidate = () => map.invalidateSize();

    // Layout settles after mount (flex parents, lazy chunks).
    const raf = requestAnimationFrame(invalidate);
    const t = setTimeout(invalidate, 60);

    let ro;
    if (typeof ResizeObserver !== 'undefined' && container) {
      ro = new ResizeObserver(invalidate);
      ro.observe(container);
    }
    window.addEventListener('resize', invalidate);
    window.addEventListener('orientationchange', invalidate);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('orientationchange', invalidate);
    };
  }, [map]);

  return null;
};

export default MapResizer;
