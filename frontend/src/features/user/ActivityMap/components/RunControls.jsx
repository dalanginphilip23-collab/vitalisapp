import React from 'react';
import Icon from '../../../../components/Icon.jsx';

// Session controls — sized for the stats console on desktop and the floating
// dock on mobile. The parent owns positioning; this component owns intent.
const RunControls = ({
  isRecording,
  hasPaused,
  metricsTime,
  onStart,
  onPauseResume,
  onFinish,
  gpsReady = true,
}) => {
  const idle = !isRecording && !hasPaused && metricsTime === 0;

  if (idle) {
    return (
      <>
        <button type="button" onClick={onStart} className="am-cta am-cta--primary">
          <Icon name="directions_run" />
          Start run
        </button>
        {!gpsReady && (
          <p className="am-gps-warn">
            <Icon name="location_off" />
            GPS required — enable location to start
          </p>
        )}
      </>
    );
  }

  return (
    <div className="am-cta-row">
      <button
        type="button"
        onClick={onPauseResume}
        aria-label={isRecording ? 'Pause run' : 'Resume run'}
        title={isRecording ? 'Pause run' : 'Resume run'}
        className="am-cta am-cta--quiet am-cta--icon"
      >
        <Icon name={isRecording ? 'pause' : 'play_arrow'} />
      </button>
      <button type="button" onClick={onFinish} className="am-cta am-cta--primary">
        <Icon name="flag" />
        Finish
      </button>
    </div>
  );
};

export default RunControls;
