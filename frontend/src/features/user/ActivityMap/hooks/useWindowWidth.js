import { useState, useEffect } from 'react';

// lg breakpoint (1024px): the map has enough room for the persistent session
// console. Tablets keep the compact floating dock instead of squeezing a
// 300px panel next to a narrow map.
export const useWindowWidth = () => {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isLargeScreen = windowWidth >= 1024;

  return { windowWidth, isLargeScreen };
};