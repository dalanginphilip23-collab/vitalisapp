import { useState, useEffect, useRef } from 'react';

const FALLBACK_COORDS = [14.6760, 121.0437];

// Fixes with worse accuracy than this are dropped — indoor/urban-canyon
// fixes (100m+) otherwise inject phantom distance into the run.
const MAX_FIX_ACCURACY_M = 25;

export const useGeolocation = (isRecording) => {
  const [userLocation, setUserLocation]     = useState(null);
  const [startCoords, setStartCoords]       = useState(FALLBACK_COORDS);
  const [locationStatus, setLocationStatus] = useState(() => (
    typeof navigator !== 'undefined' && navigator.geolocation ? 'pending' : 'denied'
  ));
  // Live fix stream while recording: false on watch error/timeout, true on
  // every accepted fix. locationStatus stays 'granted' (permission), this
  // tracks signal — the badge would otherwise claim "GPS Active" mid-dropout.
  const [gpsLive, setGpsLive] = useState(true);
  const [mapCenter, setMapCenter]           = useState(FALLBACK_COORDS);
  const [path, setPath]                     = useState([FALLBACK_COORDS]);

  const watchIdRef = useRef(null);
  // Per-fix metadata parallel to `path` (same indexes): { t, acc, speed }.
  // `path` stays [lat, lng] for Leaflet; timestamps/accuracy live here so the
  // timer can filter by speed instead of raw distance. Reset alongside path.
  const fixesRef = useRef([]);
  const resetFixes = () => { fixesRef.current = []; };

  // Get initial position on mount
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(c);
        setStartCoords(c);
        setMapCenter(c);
        setPath([c]);
        setLocationStatus('granted');
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // Watch position while recording
  useEffect(() => {
    if (isRecording && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          // Drop low-accuracy fixes (tunnels, indoors, urban canyon) —
          // the timer counts them as distance otherwise. Missing accuracy
          // is also dropped: real fixes always carry it (spec), nulls only
          // come from mocks — and untrusted fixes must not bill distance.
          const acc = pos.coords?.accuracy;
          if (!Number.isFinite(acc) || acc > MAX_FIX_ACCURACY_M) return;
          const c = [pos.coords.latitude, pos.coords.longitude];
          fixesRef.current = [...fixesRef.current, {
            t: Number.isFinite(pos.timestamp) ? pos.timestamp : Date.now(),
            acc,
            speed: Number.isFinite(pos.coords?.speed) ? pos.coords.speed : null,
          }];
          setPath(prev => [...prev, c]);
          setUserLocation(c);
          setGpsLive(true);
        },
        (err) => {
          setGpsLive(false);
          if (import.meta.env.DEV) console.warn('[geolocation] watch error:', err?.message);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isRecording]);

  return {
    userLocation,
    setUserLocation,
    startCoords,
    locationStatus,
    gpsLive,
    mapCenter,
    path,
    setPath,
    fixesRef,
    resetFixes,
  };
};