import React, { useState } from 'react';
import { useToastStore } from '../../../../stores/toastStore.js';
import {
  activityTitle,
  formatShareDate,
  renderShareCanvas,
  shareActivityImage,
} from '../utils/activityShare.js';

// Post-run card: floating white summary sheet over the replayed
// route, accent Save. No logic changes.
const RunSummaryOverlay = ({ metrics, splits, formatTime, route, onSave, onDiscard, isSaving }) => {
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const now = new Date().toISOString();
      const canvas = renderShareCanvas({
        title: activityTitle(now),
        dateStr: formatShareDate(now),
        distanceKm: metrics.distance,
        durationSec: metrics.time,
        pace: metrics.pace,
        route,
      });
      const result = await shareActivityImage(canvas, {
        filename: `vitalis-${activityTitle(now).toLowerCase().replace(/\s+/g, '-')}.png`,
        title: activityTitle(now),
        text: `${activityTitle(now)} — ${(metrics.distance || 0).toFixed(2)} km on Vitalis`,
      });
      useToastStore.getState().addToast(
        result === 'shared' ? 'Shared!' : 'Image downloaded — share it anywhere.',
        'success',
      );
    } catch (err) {
      if (err?.name !== 'AbortError') {
        useToastStore.getState().addToast('Could not create share image.', 'error');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
  <div className="absolute inset-0 z-[500] pointer-events-none">
    {/* Top badge */}
    <div className="absolute top-0 left-0 right-0 pointer-events-auto">
      <div className="flex items-start justify-center pt-3 sm:pt-4 px-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] shadow-[var(--shadow-lg)] rounded-full px-4 sm:px-5 py-2 text-center">
          <p className="text-[length:var(--fs-11)] sm:text-[length:var(--fs-12)] font-bold text-[var(--text-primary)]">
            Nice work — run complete
          </p>
        </div>
      </div>
    </div>

    {/* Bottom sheet */}
    <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
      <div
        className="px-3 sm:px-4 md:px-6"
        style={{ paddingBottom: 'max(5rem, calc(env(safe-area-inset-bottom, 0px) + 5rem))' }}
      >
        <div className="mx-auto w-full max-w-[560px] glass-panel border border-[var(--border-light)] rounded-2xl p-4 sm:p-5">
          <div className="flex">
            <div className="flex-1 min-w-0">
              <p className="text-[length:var(--fs-11)] text-[var(--text-muted)]">Distance</p>
              <p className="text-[length:var(--fs-22)] sm:text-2xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)] leading-tight">
                {(metrics.distance || 0).toFixed(2)}
                <span className="text-[length:var(--fs-12)] font-normal text-[var(--text-muted)] ml-0.5">km</span>
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[length:var(--fs-11)] text-[var(--text-muted)]">Moving Time</p>
              <p className="text-[length:var(--fs-22)] sm:text-2xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)] leading-tight">
                {formatTime(metrics.time)}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[length:var(--fs-11)] text-[var(--text-muted)]">Pace</p>
              <p className="text-[length:var(--fs-22)] sm:text-2xl font-semibold tabular-nums tracking-tight text-[var(--accent-dark)] dark:text-[var(--accent)] leading-tight">
                {metrics.pace || '–'}
              </p>
            </div>
          </div>

          {splits.length > 0 && (
            <div className="mt-3 max-h-[72px] sm:max-h-[80px] overflow-y-auto no-scrollbar border-t border-[var(--border-light)] pt-1">
              {splits.map((s) => (
                <div key={s.km} className="flex justify-between items-center py-1">
                  <span className="text-[length:var(--fs-12)] font-semibold text-[var(--text-muted)]">{s.km} km</span>
                  <span className="text-[length:var(--fs-13)] font-bold tabular-nums text-[var(--text-primary)]">{s.pace}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 sm:gap-3 mt-4">
            <button
              onClick={onDiscard}
              disabled={isSaving}
              className="px-5 py-3 rounded-full text-[length:var(--fs-13)] font-bold text-[var(--text-muted)] hover:text-[var(--error)] transition-colors disabled:opacity-40"
            >
              Discard
            </button>
            <button
              onClick={handleShare}
              disabled={isSaving || sharing}
              aria-label="Share activity"
              className="w-12 h-12 rounded-full border border-[var(--border-light)] flex items-center justify-center text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-95 transition-all disabled:opacity-40 shrink-0 self-center"
            >
              <span className="material-symbols-outlined text-[length:var(--fs-20)]">share</span>
            </button>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex-1 bg-[var(--accent)] text-[var(--text-inverse)] rounded-full py-3 text-[length:var(--fs-14)] font-bold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {isSaving ? 'Saving…' : 'Save Activity'}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default RunSummaryOverlay;
