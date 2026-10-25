import { useState, useRef } from 'react';

export const useRunControls = ({ userLocation, startCoords, metrics, path, splits, resetMetrics, setPath }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPaused, setHasPaused]     = useState(false);
  const [runFinished, setRunFinished] = useState(false);

  const finishedPathRef    = useRef([]);
  const finishedMetricsRef = useRef({});
  const finishedSplitsRef  = useRef([]);

  const handleStartRun = () => {
    const origin = userLocation || startCoords;
    resetMetrics();
    setPath([origin]);
    setHasPaused(false);
    setRunFinished(false);
    setIsRecording(true);
  };

  const handlePauseResume = () => {
    setIsRecording(p => !p);
    setHasPaused(true);
  };

  const handleFinish = () => {
    setIsRecording(false);
    finishedPathRef.current    = [...path];
    finishedMetricsRef.current = { ...metrics };
    finishedSplitsRef.current  = [...splits];
    setRunFinished(true);
  };

  const handleDiscard = (fallbackCoords) => {
    setRunFinished(false);
    resetMetrics();
    setPath([userLocation || fallbackCoords]);
    setHasPaused(false);
  };

  return {
    isRecording,
    hasPaused,
    runFinished,
    finishedPathRef,
    finishedMetricsRef,
    finishedSplitsRef,
    handleStartRun,
    handlePauseResume,
    handleFinish,
    handleDiscard,
  };
};