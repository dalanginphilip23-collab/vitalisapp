import { useState, useEffect, useRef, useCallback } from 'react';
import { evaluateFix } from '../utils/geo.js';

// Neutral placeholder centre shown before a real fix arrives. It is never
// presented as the user's position — no marker is placed here, and the camera
// flies to the real GPS fix as soon as one is available.
export const DEFAULT_MAP_CENTER = [20, 0];

// Recording gates + fix evaluation live in utils/geo.js (shared + unit-tested).

// GeolocationPositionError.code: 1 denied, 2 unavailable, 3 timeout.
const statusFromError = (err) => {
  if (!err) return 'unavailable';
  if (err.code === 1) return 'denied';
  if (err.code === 3) return 'timeout';
  return 'unavailable';
};

export const useGeolocation = (isRecording) => {
  const supported =
    typeof navigator !== 'undefined' && !!navigator.geolocation;

  const [userLocation, setUserLocation]       = useState(null);
  const [startCoords, setStartCoords]         = useState(DEFAULT_MAP_CENTER);
  const [locationStatus, setLocationStatus]   = useState(supported ? 'pending' : 'denied');
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [locationError, setLocationError]     = useState(null);
  const [mapCenter, setMapCenter]             = useState(DEFAULT_MAP_CENTER);
  const [path, setPath]                       = useState([]);

  const watchIdRef = useRef(null);
  // Last fix actually considered, used for the move / speed gates.
  const lastFixRef = useRef(null);

  // ── Initial fix (also powers the retry button) ─────────────────────────────
  // NB: no synchronous setState here — React sees state updates only from the
  // geolocation callbacks, so this stays effect-safe.
  const requestInitialPosition = useCallback(() => {
    if (!supported) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords || {};
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setLocationStatus('unavailable');
          return;
        }
        const c = [latitude, longitude];
        lastFixRef.current = { lat: latitude, lng: longitude, t: Date.now() };
        setUserLocation(c);
        setStartCoords(c);
        setMapCenter(c);
        setLocationAccuracy(Number.isFinite(accuracy) ? accuracy : null);
        setLocationError(null);
        setLocationStatus('granted');
        // Don't clobber a run that already started.
        setPath((prev) => (prev.length ? prev : [c]));
      },
      (err) => {
        setLocationStatus(statusFromError(err));
        setLocationError(err?.message || 'Location unavailable');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [supported]);

  // Explicit retry (event handler → synchronous state updates are fine here).
  const retryLocation = useCallback(() => {
    if (!supported) {
      setLocationStatus('denied');
      return;
    }
    setLocationStatus('pending');
    setLocationError(null);
    requestInitialPosition();
  }, [supported, requestInitialPosition]);

  useEffect(() => {
    requestInitialPosition();
  }, [requestInitialPosition]);

  // ── Continuous watch while recording ───────────────────────────────────────
  useEffect(() => {
    if (!supported) return undefined;

    if (!isRecording) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return undefined;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords || {};
        const acc = Number.isFinite(accuracy) ? accuracy : null;

        const verdict = evaluateFix(
          lastFixRef.current,
          { lat: latitude, lng: longitude, accuracy: acc },
          Date.now(),
        );

        if (verdict.reason === 'invalid') return;

        // Too noisy to trust for distance — surface the reading but skip it.
        if (verdict.reason === 'accuracy') {
          setLocationAccuracy(acc);
          return;
        }

        const c = [latitude, longitude];
        setLocationAccuracy(acc);
        setUserLocation(c);
        setLocationStatus('granted');
        setLocationError(null);

        // 'duplicate' / 'jump' keep the marker fresh but not the route.
        if (verdict.accept) setPath((p) => [...p, c]);
        // Always re-anchor so a rejected jump doesn't wedge future fixes.
        lastFixRef.current = { lat: latitude, lng: longitude, t: Date.now() };
      },
      (err) => {
        // Watch errors are often transient (tunnel, brief timeout). Keep the
        // last known status so a single hiccup doesn't freeze the whole run.
        setLocationError(err?.message || 'Location signal lost');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isRecording, supported]);

  return {
    userLocation,
    setUserLocation,
    startCoords,
    locationStatus,
    locationAccuracy,
    locationError,
    mapCenter,
    path,
    setPath,
    retry: retryLocation,
  };
};
